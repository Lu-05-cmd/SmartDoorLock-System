import json
import sqlite3
import tempfile
import threading
import unittest
from contextlib import closing
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server import initialize_database, make_handler


class LocalApiIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temporary_directory.name) / "test.sqlite3"
        initialize_database(self.database_path)
        self.token = "test-token-that-is-long-enough-123"
        self.server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            make_handler(self.database_path, self.token),
        )
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.server_thread.join(timeout=2)
        self.temporary_directory.cleanup()

    def request(self, path, *, method="GET", payload=None, token=None):
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        request = Request(f"{self.base_url}{path}", data=body, headers=headers, method=method)
        try:
            response = urlopen(request, timeout=2)
        except HTTPError as error:
            response = error
        return response.code, json.loads(response.read().decode("utf-8"))

    def test_health_endpoint_is_public(self):
        status, body = self.request("/health")
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "ok")

    def test_private_endpoints_require_bearer_token(self):
        status, body = self.request("/api/v1/status")
        self.assertEqual(status, 401)
        self.assertIn("error", body)

    def test_face_user_patch_supports_browser_preflight(self):
        request = Request(
            f"{self.base_url}/api/v1/users/1",
            headers={
                "Origin": "https://appassets.androidplatform.net",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
            method="OPTIONS",
        )
        with urlopen(request, timeout=2) as response:
            self.assertEqual(response.code, 204)
            self.assertIn("PATCH", response.headers["Access-Control-Allow-Methods"])
            self.assertEqual(response.read(), b"")

    def test_old_heartbeat_is_reported_offline(self):
        with closing(sqlite3.connect(self.database_path)) as connection, connection:
            connection.execute(
                """
                INSERT INTO devices (device_id, ip_address, firmware_version, status, last_seen, created_at)
                VALUES (?, ?, ?, 'online', ?, ?)
                """,
                (
                    "esp32cam-entry",
                    "192.168.1.20",
                    "1.0.0",
                    "2020-01-01T00:00:00+00:00",
                    "2020-01-01T00:00:00+00:00",
                ),
            )

        status, body = self.request("/api/v1/status", token=self.token)
        self.assertEqual(status, 200)
        self.assertEqual(body["devices"][0]["status"], "offline")

    def test_heartbeat_and_event_are_stored_and_returned(self):
        status, body = self.request(
            "/api/v1/devices/heartbeat",
            method="POST",
            token=self.token,
            payload={
                "device_id": "esp32cam-entry",
                "ip_address": "192.168.1.20",
                "firmware_version": "1.0.0",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["device"]["status"], "online")

        status, body = self.request(
            "/api/v1/events",
            method="POST",
            token=self.token,
            payload={
                "device_id": "esp32cam-entry",
                "event_type": "face_recognized",
                "subject": "Test User",
                "result": "authorized",
            },
        )
        self.assertEqual(status, 201)
        self.assertEqual(body["event"]["event_type"], "face_recognized")

        status, body = self.request("/api/v1/status", token=self.token)
        self.assertEqual(status, 200)
        self.assertEqual(len(body["devices"]), 1)
        self.assertEqual(len(body["events"]), 1)
        self.assertEqual(body["events"][0]["subject"], "Test User")

    def test_event_requires_a_known_device_and_supported_type(self):
        status, _ = self.request(
            "/api/v1/events",
            method="POST",
            token=self.token,
            payload={
                "device_id": "unknown-device",
                "event_type": "face_recognized",
                "result": "authorized",
            },
        )
        self.assertEqual(status, 409)

        status, body = self.request(
            "/api/v1/devices/heartbeat",
            method="POST",
            token=self.token,
            payload={"device_id": "esp32cam-entry", "firmware_version": "1.0.0"},
        )
        self.assertEqual(status, 200)

        status, body = self.request(
            "/api/v1/events",
            method="POST",
            token=self.token,
            payload={
                "device_id": "esp32cam-entry",
                "event_type": "delete_everything",
                "result": "unknown",
            },
        )
        self.assertEqual(status, 400)
        self.assertIn("event_type", body["error"])

    def test_face_enrollment_creates_multiple_device_users(self):
        self.request(
            "/api/v1/devices/heartbeat",
            method="POST",
            token=self.token,
            payload={"device_id": "entry-lock", "firmware_version": "1.0.0"},
        )

        for face_id in ("Alice", "Bob"):
            status, _ = self.request(
                "/api/v1/events",
                method="POST",
                token=self.token,
                payload={
                    "device_id": "entry-lock",
                    "event_type": "face_enrolled",
                    "subject": face_id,
                    "result": "enrolled",
                },
            )
            self.assertEqual(status, 201)

        status, body = self.request(
            "/api/v1/users?device_id=entry-lock",
            token=self.token,
        )
        self.assertEqual(status, 200)
        self.assertEqual(
            [(user["face_id"], user["display_name"]) for user in body["users"]],
            [("Alice", "Alice"), ("Bob", "Bob")],
        )
        self.assertTrue(all(user["face_enabled"] for user in body["users"]))

    def test_face_enrollment_sync_updates_the_display_name(self):
        self.request(
            "/api/v1/devices/heartbeat",
            method="POST",
            token=self.token,
            payload={"device_id": "entry-lock", "firmware_version": "1.0.0"},
        )
        self.request(
            "/api/v1/events",
            method="POST",
            token=self.token,
            payload={
                "device_id": "entry-lock",
                "event_type": "face_enrolled",
                "subject": "LEHOANG",
                "result": "enrolled",
            },
        )

        status, body = self.request(
            "/api/v1/users",
            method="POST",
            token=self.token,
            payload={
                "device_id": "entry-lock",
                "face_id": "LEHOANG",
                "display_name": "Lê Hoàng Nam",
            },
        )

        self.assertEqual(status, 200)
        self.assertFalse(body["created"])
        self.assertEqual(body["user"]["display_name"], "Lê Hoàng Nam")
        self.assertTrue(body["user"]["face_enabled"])

    def test_face_access_can_be_renamed_and_disabled(self):
        self.request(
            "/api/v1/devices/heartbeat",
            method="POST",
            token=self.token,
            payload={"device_id": "entry-lock", "firmware_version": "1.0.0"},
        )
        self.request(
            "/api/v1/events",
            method="POST",
            token=self.token,
            payload={
                "device_id": "entry-lock",
                "event_type": "face_enrolled",
                "subject": "camera-alice",
                "result": "enrolled",
            },
        )
        _, users = self.request("/api/v1/users?device_id=entry-lock", token=self.token)
        user_id = users["users"][0]["user_id"]

        status, updated = self.request(
            f"/api/v1/users/{user_id}",
            method="PATCH",
            token=self.token,
            payload={"display_name": "Alice Example", "face_enabled": False},
        )
        self.assertEqual(status, 200)
        self.assertEqual(updated["user"]["display_name"], "Alice Example")
        self.assertFalse(updated["user"]["face_enabled"])

        status, decision = self.request(
            "/api/v1/face/authorize",
            method="POST",
            token=self.token,
            payload={"device_id": "entry-lock", "face_id": "camera-alice"},
        )
        self.assertEqual(status, 403)
        self.assertFalse(decision["authorized"])
        self.assertTrue(decision["managed"])

    def test_camera_face_sync_is_idempotent_and_preserves_app_settings(self):
        self.request(
            "/api/v1/devices/heartbeat",
            method="POST",
            token=self.token,
            payload={"device_id": "entry-lock", "firmware_version": "1.0.0"},
        )

        status, created = self.request(
            "/api/v1/users",
            method="POST",
            token=self.token,
            payload={"device_id": "entry-lock", "face_id": "camera-alice"},
        )
        self.assertEqual(status, 201)
        self.assertTrue(created["created"])
        self.assertEqual(created["user"]["display_name"], "camera-alice")

        user_id = created["user"]["user_id"]
        self.request(
            f"/api/v1/users/{user_id}",
            method="PATCH",
            token=self.token,
            payload={"display_name": "Alice Example", "face_enabled": False},
        )
        status, existing = self.request(
            "/api/v1/users",
            method="POST",
            token=self.token,
            payload={"device_id": "entry-lock", "face_id": "camera-alice"},
        )
        self.assertEqual(status, 200)
        self.assertFalse(existing["created"])
        self.assertEqual(existing["user"]["display_name"], "Alice Example")
        self.assertFalse(existing["user"]["face_enabled"])

    def test_unmanaged_device_keeps_local_face_authorization(self):
        self.request(
            "/api/v1/devices/heartbeat",
            method="POST",
            token=self.token,
            payload={"device_id": "legacy-lock", "firmware_version": "1.0.0"},
        )

        status, body = self.request(
            "/api/v1/face/authorize",
            method="POST",
            token=self.token,
            payload={"device_id": "legacy-lock", "face_id": "Existing Face"},
        )
        self.assertEqual(status, 200)
        self.assertTrue(body["authorized"])
        self.assertFalse(body["managed"])


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Local SQLite API bridge for the SmartDoorLock app and ESP32-CAM."""

from __future__ import annotations

import hmac
import json
import os
import re
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

API_VERSION = 1
MAX_BODY_BYTES = 16_384
MAX_EVENT_LIMIT = 50
EVENT_TYPES = {
    "face_recognized",
    "face_enrolled",
    "face_denied",
    "door_unlocked",
}
IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def validate_identifier(value: object, field: str) -> str:
    if not isinstance(value, str) or not IDENTIFIER_PATTERN.fullmatch(value):
        raise ValueError(f"{field} must contain 1-64 letters, digits, dots, underscores, colons, or hyphens.")
    return value


def validate_payload_string(
    payload: dict[str, object],
    field: str,
    *,
    required: bool = True,
    max_length: int = 120,
) -> str | None:
    value = payload.get(field)
    if value is None and not required:
        return None
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string.")
    value = value.strip()
    if required and not value:
        raise ValueError(f"{field} is required.")
    if len(value) > max_length:
        raise ValueError(f"{field} must be at most {max_length} characters.")
    return value or None


def initialize_database(database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                ip_address TEXT,
                firmware_version TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('online', 'offline')),
                last_seen TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL REFERENCES devices(device_id),
                event_type TEXT NOT NULL,
                subject TEXT,
                result TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

                        CREATE TABLE IF NOT EXISTS face_users (
                                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                                device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
                                face_id TEXT NOT NULL,
                                display_name TEXT NOT NULL,
                                face_enabled INTEGER NOT NULL DEFAULT 1 CHECK (face_enabled IN (0, 1)),
                                created_at TEXT NOT NULL,
                                updated_at TEXT NOT NULL,
                                UNIQUE (device_id, face_id)
                        );

            CREATE INDEX IF NOT EXISTS idx_events_created_at
              ON events(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_events_device_created_at
              ON events(device_id, created_at DESC);
                        CREATE INDEX IF NOT EXISTS idx_face_users_device
                            ON face_users(device_id, display_name);
            """
        )


def record_heartbeat(
    database_path: Path,
    *,
    device_id: str,
    ip_address: str | None,
    firmware_version: str,
) -> dict[str, object]:
    seen_at = utc_now()
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            """
            INSERT INTO devices (device_id, ip_address, firmware_version, status, last_seen, created_at)
            VALUES (?, ?, ?, 'online', ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET
                ip_address = excluded.ip_address,
                firmware_version = excluded.firmware_version,
                status = 'online',
                last_seen = excluded.last_seen
            """,
            (device_id, ip_address, firmware_version, seen_at, seen_at),
        )
        row = connection.execute(
            "SELECT device_id, ip_address, firmware_version, status, last_seen FROM devices WHERE device_id = ?",
            (device_id,),
        ).fetchone()
    return dict(row)


def record_event(
    database_path: Path,
    *,
    device_id: str,
    event_type: str,
    subject: str | None,
    result: str,
) -> dict[str, object]:
    created_at = utc_now()
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        if event_type == "face_enrolled" and subject:
            connection.execute(
                """
                INSERT INTO face_users
                    (device_id, face_id, display_name, face_enabled, created_at, updated_at)
                VALUES (?, ?, ?, 1, ?, ?)
                ON CONFLICT(device_id, face_id) DO UPDATE SET
                    updated_at = excluded.updated_at
                """,
                (device_id, subject, subject, created_at, created_at),
            )
        cursor = connection.execute(
            """
            INSERT INTO events (device_id, event_type, subject, result, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (device_id, event_type, subject, result, created_at),
        )
        row = connection.execute(
            """
            SELECT event_id, device_id, event_type, subject, result, created_at
            FROM events WHERE event_id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    return dict(row)


def read_face_users(database_path: Path, device_id: str) -> list[dict[str, object]]:
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT user_id, device_id, face_id, display_name, face_enabled, created_at, updated_at
            FROM face_users WHERE device_id = ? ORDER BY display_name COLLATE NOCASE, user_id
            """,
            (device_id,),
        ).fetchall()
    users = [dict(row) for row in rows]
    for user in users:
        user["face_enabled"] = bool(user["face_enabled"])
    return users


def sync_face_user(
    database_path: Path,
    *,
    device_id: str,
    face_id: str,
    display_name: str | None,
) -> tuple[dict[str, object], bool]:
    timestamp = utc_now()
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        existing = connection.execute(
            "SELECT user_id FROM face_users WHERE device_id = ? AND face_id = ?",
            (device_id, face_id),
        ).fetchone()
        cursor = connection.execute(
            """
            INSERT INTO face_users
                (device_id, face_id, display_name, face_enabled, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(device_id, face_id) DO UPDATE SET
                display_name = excluded.display_name,
                updated_at = excluded.updated_at
            WHERE ? IS NOT NULL AND face_users.display_name != excluded.display_name
            """,
            (device_id, face_id, display_name or face_id, timestamp, timestamp, display_name),
        )
        row = connection.execute(
            """
            SELECT user_id, device_id, face_id, display_name, face_enabled, created_at, updated_at
            FROM face_users WHERE device_id = ? AND face_id = ?
            """,
            (device_id, face_id),
        ).fetchone()
    user = dict(row)
    user["face_enabled"] = bool(user["face_enabled"])
    return user, existing is None and cursor.rowcount == 1


def update_face_user(
    database_path: Path,
    user_id: int,
    *,
    display_name: str | None,
    face_enabled: bool | None,
) -> dict[str, object] | None:
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.row_factory = sqlite3.Row
        existing = connection.execute(
            "SELECT display_name, face_enabled FROM face_users WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        if existing is None:
            return None

        updated_name = display_name if display_name is not None else existing["display_name"]
        updated_enabled = int(face_enabled) if face_enabled is not None else existing["face_enabled"]
        connection.execute(
            """
            UPDATE face_users
            SET display_name = ?, face_enabled = ?, updated_at = ?
            WHERE user_id = ?
            """,
            (updated_name, updated_enabled, utc_now(), user_id),
        )
        row = connection.execute(
            """
            SELECT user_id, device_id, face_id, display_name, face_enabled, created_at, updated_at
            FROM face_users WHERE user_id = ?
            """,
            (user_id,),
        ).fetchone()
    user = dict(row)
    user["face_enabled"] = bool(user["face_enabled"])
    return user


def authorize_face_access(
    database_path: Path,
    *,
    device_id: str,
    face_id: str,
) -> dict[str, object]:
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.row_factory = sqlite3.Row
        device = connection.execute(
            "SELECT 1 FROM devices WHERE device_id = ?",
            (device_id,),
        ).fetchone()
        if device is None:
            return {"authorized": False, "managed": True}

        managed = connection.execute(
            "SELECT 1 FROM face_users WHERE device_id = ? LIMIT 1",
            (device_id,),
        ).fetchone() is not None
        if not managed:
            return {"authorized": True, "managed": False}

        user = connection.execute(
            """
            SELECT user_id, display_name
            FROM face_users
            WHERE device_id = ? AND face_id = ? AND face_enabled = 1
            """,
            (device_id, face_id),
        ).fetchone()
    if user is None:
        return {"authorized": False, "managed": True}
    return {
        "authorized": True,
        "managed": True,
        "user_id": user["user_id"],
        "display_name": user["display_name"],
    }


def read_status(database_path: Path, event_limit: int = 10) -> dict[str, object]:
    limit = min(max(event_limit, 1), MAX_EVENT_LIMIT)
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.row_factory = sqlite3.Row
        stale_before = (datetime.now(timezone.utc) - timedelta(seconds=90)).isoformat(timespec="seconds")
        connection.execute(
            "UPDATE devices SET status = 'offline' WHERE last_seen < ?",
            (stale_before,),
        )
        devices = connection.execute(
            """
            SELECT device_id, ip_address, firmware_version, status, last_seen
            FROM devices ORDER BY device_id
            """
        ).fetchall()
        events = connection.execute(
            """
            SELECT event_id, device_id, event_type, subject, result, created_at
            FROM events ORDER BY event_id DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return {"devices": [dict(row) for row in devices], "events": [dict(row) for row in events]}


def make_handler(database_path: Path, api_token: str) -> type[BaseHTTPRequestHandler]:
    class SmartDoorHandler(BaseHTTPRequestHandler):
        server_version = "SmartDoorLocalAPI/1"

        def _send_json(self, status: int, body: dict[str, object]) -> None:
            encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
            self.end_headers()
            self.wfile.write(encoded)

        def _read_json(self) -> dict[str, object]:
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError as error:
                raise ValueError("Content-Length must be an integer.") from error
            if content_length < 1 or content_length > MAX_BODY_BYTES:
                raise ValueError(f"Request body must be between 1 and {MAX_BODY_BYTES} bytes.")
            try:
                payload = json.loads(self.rfile.read(content_length))
            except (json.JSONDecodeError, UnicodeDecodeError) as error:
                raise ValueError("Request body must be valid JSON.") from error
            if not isinstance(payload, dict):
                raise ValueError("Request body must be a JSON object.")
            return payload

        def _authorized(self) -> bool:
            scheme, _, supplied_token = self.headers.get("Authorization", "").partition(" ")
            return scheme.lower() == "bearer" and hmac.compare_digest(supplied_token, api_token)

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
            self.send_header("Access-Control-Max-Age", "600")
            self.end_headers()

        def do_GET(self) -> None:
            parsed_url = urlparse(self.path)
            path = parsed_url.path
            if path == "/health":
                self._send_json(200, {"status": "ok", "service": "smartdoor-local-api", "api_version": API_VERSION})
                return
            if path not in {"/api/v1/status", "/api/v1/devices", "/api/v1/events", "/api/v1/users"}:
                self._send_json(404, {"error": "Endpoint not found."})
                return
            if not self._authorized():
                self._send_json(401, {"error": "Bearer token is missing or invalid."})
                return

            if path == "/api/v1/users":
                device_ids = parse_qs(parsed_url.query).get("device_id", [])
                if len(device_ids) != 1:
                    self._send_json(400, {"error": "device_id query parameter is required."})
                    return
                try:
                    device_id = validate_identifier(device_ids[0], "device_id")
                except ValueError as error:
                    self._send_json(400, {"error": str(error)})
                    return
                self._send_json(200, {"users": read_face_users(database_path, device_id)})
                return

            status = read_status(database_path)
            if path.endswith("/devices"):
                self._send_json(200, {"devices": status["devices"]})
            elif path.endswith("/events"):
                self._send_json(200, {"events": status["events"]})
            else:
                self._send_json(200, status)

        def do_POST(self) -> None:
            if urlparse(self.path).path not in {
                "/api/v1/devices/heartbeat",
                "/api/v1/events",
                "/api/v1/face/authorize",
                "/api/v1/users",
            }:
                self._send_json(404, {"error": "Endpoint not found."})
                return
            if not self._authorized():
                self._send_json(401, {"error": "Bearer token is missing or invalid."})
                return

            try:
                payload = self._read_json()
                device_id = validate_identifier(payload.get("device_id"), "device_id")
                path = urlparse(self.path).path
                if path == "/api/v1/face/authorize":
                    face_id = validate_payload_string(payload, "face_id", max_length=80)
                    decision = authorize_face_access(
                        database_path,
                        device_id=device_id,
                        face_id=face_id or "",
                    )
                    self._send_json(200 if decision["authorized"] else 403, decision)
                    return

                if path.endswith("/heartbeat"):
                    ip_address = validate_payload_string(
                        payload,
                        "ip_address",
                        required=False,
                        max_length=45,
                    )
                    firmware_version = validate_payload_string(
                        payload,
                        "firmware_version",
                        max_length=40,
                    )
                    device = record_heartbeat(
                        database_path,
                        device_id=device_id,
                        ip_address=ip_address,
                        firmware_version=firmware_version or "unknown",
                    )
                    self._send_json(200, {"device": device})
                    return

                if path == "/api/v1/users":
                    face_id = validate_payload_string(payload, "face_id", max_length=80)
                    display_name = validate_payload_string(
                        payload,
                        "display_name",
                        required=False,
                        max_length=80,
                    )
                    try:
                        user, created = sync_face_user(
                            database_path,
                            device_id=device_id,
                            face_id=face_id or "",
                            display_name=display_name,
                        )
                    except sqlite3.IntegrityError:
                        self._send_json(409, {"error": "Device must send a heartbeat before syncing faces."})
                        return
                    self._send_json(201 if created else 200, {"user": user, "created": created})
                    return

                event_type = validate_payload_string(payload, "event_type", max_length=40)
                if event_type not in EVENT_TYPES:
                    raise ValueError("event_type is not supported.")
                subject = validate_payload_string(
                    payload,
                    "subject",
                    required=False,
                    max_length=80,
                )
                if event_type == "face_enrolled" and subject is None:
                    raise ValueError("subject is required for face_enrolled events.")
                result = validate_payload_string(payload, "result", max_length=40)
                try:
                    event = record_event(
                        database_path,
                        device_id=device_id,
                        event_type=event_type or "",
                        subject=subject,
                        result=result or "",
                    )
                except sqlite3.IntegrityError as error:
                    self._send_json(409, {"error": "Device must send a heartbeat before reporting events."})
                    return
                self._send_json(201, {"event": event})
            except ValueError as error:
                self._send_json(400, {"error": str(error)})
            except sqlite3.Error:
                self.log_error("Database operation failed while handling %s", self.path)
                self._send_json(500, {"error": "Database operation failed."})

        def do_PATCH(self) -> None:
            path = urlparse(self.path).path
            prefix = "/api/v1/users/"
            if not path.startswith(prefix) or not path[len(prefix):].isdigit():
                self._send_json(404, {"error": "Endpoint not found."})
                return
            if not self._authorized():
                self._send_json(401, {"error": "Bearer token is missing or invalid."})
                return

            try:
                payload = self._read_json()
                display_name = validate_payload_string(
                    payload,
                    "display_name",
                    required=False,
                    max_length=80,
                )
                face_enabled = payload.get("face_enabled")
                if face_enabled is not None and not isinstance(face_enabled, bool):
                    raise ValueError("face_enabled must be a boolean.")
                if display_name is None and face_enabled is None:
                    raise ValueError("Provide display_name or face_enabled to update.")

                user = update_face_user(
                    database_path,
                    int(path[len(prefix):]),
                    display_name=display_name,
                    face_enabled=face_enabled,
                )
                if user is None:
                    self._send_json(404, {"error": "Face user not found."})
                    return
                self._send_json(200, {"user": user})
            except ValueError as error:
                self._send_json(400, {"error": str(error)})
            except sqlite3.Error:
                self.log_error("Database operation failed while handling %s", self.path)
                self._send_json(500, {"error": "Database operation failed."})

        def log_message(self, format: str, *args: object) -> None:
            super().log_message(format, *args)

    return SmartDoorHandler


def main() -> None:
    token = os.environ.get("SMARTDOOR_API_TOKEN", "").strip()
    if len(token) < 24:
        raise SystemExit("Set SMARTDOOR_API_TOKEN to a random value of at least 24 characters before starting the API.")

    database_path = Path(
        os.environ.get(
            "SMARTDOOR_DATABASE",
            str(Path(__file__).resolve().parent / "smartdoor.sqlite3"),
        )
    ).expanduser()
    initialize_database(database_path)
    host = os.environ.get("SMARTDOOR_API_HOST", "0.0.0.0")
    port = int(os.environ.get("SMARTDOOR_API_PORT", "8766"))
    server = ThreadingHTTPServer((host, port), make_handler(database_path, token))
    print(f"SmartDoor local API listening on http://{host}:{port}")
    print(f"SQLite database: {database_path}")
    print("Face templates and images are never copied into this database.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping SmartDoor local API.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

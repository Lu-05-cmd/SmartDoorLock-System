package com.facedoor.lock;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.net.Uri;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;

import java.net.URI;
import java.net.URISyntaxException;

public class MainActivity extends Activity {
    private static final String PREFERENCES = "device_settings";
    private static final String HOST_KEY = "esp32_host";
    private static final String LOGIN_URL = "https://appassets.androidplatform.net/assets/login.html";
    private static final String SIGNUP_URL = "https://appassets.androidplatform.net/assets/signup.html";
    private static final String HOME_URL = "https://appassets.androidplatform.net/assets/home.html";
    private static final String ACTIVITY_URL = "https://appassets.androidplatform.net/assets/activity.html";
    private static final String SETTINGS_URL = "https://appassets.androidplatform.net/assets/settings.html";

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private String connectedHost;
    private String deviceAuthority;
    private String connectionMessage = "Nhập địa chỉ IP được in trên Serial Monitor.";
    private boolean deviceReachable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
        }
        getWindow().setStatusBarColor(Color.rgb(248, 249, 255));
        getWindow().setNavigationBarColor(Color.rgb(248, 249, 255));
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        SharedPreferences preferences = getSharedPreferences(PREFERENCES, MODE_PRIVATE);
        String savedAuthority = preferences.getString(HOST_KEY, "");
        if (!savedAuthority.isEmpty()) {
            restoreDeviceAddress(savedAuthority);
        }

        webView = new WebView(this);
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setAllowFileAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setAllowContentAccess(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = assetLoader.shouldInterceptRequest(request.getUrl());
                return response != null ? response : super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (isHomePage(url)) {
                    updateDashboard();
                } else if (isDevicePage(url)) {
                    deviceReachable = true;
                    connectionMessage = "Đã truy cập ESP32-CAM tại " + deviceAuthority + ".";
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame() && isDevicePage(request.getUrl().toString())) {
                    deviceReachable = false;
                    connectionMessage = "Không thể kết nối ESP32-CAM. Kiểm tra Wi-Fi và địa chỉ IP.";
                }
            }
        });
        setContentView(webView);
        webView.loadUrl(LOGIN_URL);
    }

    private boolean handleNavigation(Uri target) {
        if ("facedoor".equals(target.getScheme())) {
            if ("connect".equals(target.getHost())) {
                connectDevice(target.getQueryParameter("host"));
            } else if ("open-control".equals(target.getHost())) {
                openDeviceControl();
            }
            return true;
        }
        if (isAppPage(target.toString())) {
            return false;
        }
        return !isDevicePage(target.toString());
    }

    private void connectDevice(String input) {
        input = input == null ? "" : input.trim();
        if (input.isEmpty()) {
            connectionMessage = "Hãy nhập địa chỉ IP hoặc hostname của ESP32.";
            updateDashboard();
            return;
        }

        String address = input.contains("://") ? input : "http://" + input;
        try {
            URI uri = new URI(address);
            if (!"http".equalsIgnoreCase(uri.getScheme())
                    || uri.getHost() == null
                    || (uri.getPort() != -1 && uri.getPort() != 80)
                    || (uri.getPath() != null && !uri.getPath().isEmpty()
                        && !"/".equals(uri.getPath()))
                    || uri.getUserInfo() != null
                    || uri.getRawQuery() != null
                    || uri.getRawFragment() != null) {
                throw new URISyntaxException(address, "Unsupported ESP32 address");
            }

            connectedHost = uri.getHost();
            deviceAuthority = uri.getRawAuthority();
            getSharedPreferences(PREFERENCES, MODE_PRIVATE).edit()
                    .putString(HOST_KEY, deviceAuthority).apply();
            deviceReachable = false;
            connectionMessage = "Đang kết nối đến " + deviceAuthority + "...";
            webView.loadUrl(deviceUrl());
        } catch (URISyntaxException error) {
            connectionMessage = "Địa chỉ không hợp lệ. Nhập IP hoặc hostname của ESP32.";
            updateDashboard();
        }
    }

    private void restoreDeviceAddress(String authority) {
        try {
            URI uri = new URI("http://" + authority);
            if (uri.getHost() != null && uri.getUserInfo() == null
                    && (uri.getPort() == -1 || uri.getPort() == 80)) {
                connectedHost = uri.getHost();
                deviceAuthority = uri.getRawAuthority();
                connectionMessage = "Đã lưu địa chỉ " + deviceAuthority + ".";
            }
        } catch (URISyntaxException ignored) {
            connectedHost = null;
            deviceAuthority = null;
        }
    }

    private void openDeviceControl() {
        if (deviceAuthority == null) {
            connectionMessage = "Nhập địa chỉ IP ESP32 trước khi mở bảng điều khiển.";
            updateDashboard();
            return;
        }
        deviceReachable = false;
        connectionMessage = "Đang kết nối đến " + deviceAuthority + "...";
        webView.loadUrl(deviceUrl());
    }

    private String deviceUrl() {
        return "http://" + deviceAuthority + "/";
    }

    private boolean isLoginPage(String url) {
        return isPageUrl(url, LOGIN_URL);
    }

    private boolean isSignupPage(String url) {
        return isPageUrl(url, SIGNUP_URL);
    }

    private boolean isHomePage(String url) {
        return isPageUrl(url, HOME_URL);
    }

    private boolean isActivityPage(String url) {
        return isPageUrl(url, ACTIVITY_URL);
    }

    private boolean isSettingsPage(String url) {
        return isPageUrl(url, SETTINGS_URL);
    }

    private boolean isAppPage(String url) {
        return isLoginPage(url) || isSignupPage(url) || isHomePage(url)
                || isActivityPage(url) || isSettingsPage(url);
    }

    private boolean isPageUrl(String url, String pageUrl) {
        return pageUrl.equals(url) || (url != null && url.startsWith(pageUrl + "#"));
    }

    private boolean isDevicePage(String url) {
        if (url == null || connectedHost == null) {
            return false;
        }
        Uri uri = Uri.parse(url);
        return "http".equals(uri.getScheme())
                && connectedHost.equalsIgnoreCase(uri.getHost());
    }

    private void updateDashboard() {
        if (webView == null || !isHomePage(webView.getUrl())) {
            return;
        }
        String host = JSONObject.quote(deviceAuthority == null ? "" : deviceAuthority);
        String message = JSONObject.quote(connectionMessage);
        String script = "window.renderConnectionState && window.renderConnectionState("
                + host + "," + deviceReachable + "," + message + ");";
        webView.evaluateJavascript(script, null);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
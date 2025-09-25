# Twitch VLESS Extension

This repository contains a Chrome extension and a native messaging host that gate a VLESS proxy behind a Twitch follow check. The steps below walk through configuring the OAuth client, registering the native host and loading the extension in Chrome.

## 1. Prerequisites

* [Google Chrome](https://www.google.com/chrome/) 114 or newer.
* Node.js 18+ (required for the native host helper) and npm.
* [xray-core](https://github.com/XTLS/Xray-core) installed locally. The default path is `/usr/local/bin/xray`; override by setting the `XRAY_PATH` environment variable when launching the native host.
* Access to a Twitch account that can register OAuth applications.

## 2. Configure Twitch OAuth

1. Load the extension once to discover its ID:
   * Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and choose the `extension/` folder from this repo. Ignore sign-in errors for now.
   * Copy the generated extension ID from the card (e.g. `abcdefghijklmnopabcdefghijklmnop`).
2. In the [Twitch developer console](https://dev.twitch.tv/console/apps), create a new application:
   * **OAuth Redirect URL**: `https://<extension-id>.chromiumapp.org/` (replace with the ID from the previous step).
   * **Category**: Website Integration (any category that allows user read follows scope).
3. Note the **Client ID** and the broadcaster ID that users must follow. The broadcaster ID can be retrieved from the [Get Users](https://dev.twitch.tv/docs/api/reference#get-users) API.
4. Update `extension/config.js`:
   * Replace `REPLACE_WITH_TWITCH_CLIENT_ID` with the Twitch Client ID.
   * Replace `REPLACE_WITH_TWITCH_BROADCASTER_ID` with the numeric broadcaster ID the user must follow.
   * Adjust the proxy settings if your local xray instance uses a different port.

After saving the file reload the extension from `chrome://extensions`.

## 3. Register the Native Messaging Host

The extension communicates with a Node.js helper (`native-host/vless_host.js`) through Chrome's native messaging. Install it on the machine that runs Chrome.

1. Install dependencies and make the helper executable:

   ```bash
   cd native-host
   npm install --omit=dev
   chmod +x vless_host.js
   ```

2. Place the host manifest where Chrome expects it, replacing `__EXTENSION_ID__` with your real extension ID and pointing `path` to the helper:

   * **macOS**: copy `manifests/com.example.vless_proxy.json` to `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`.
   * **Linux**: copy the same file to `~/.config/google-chrome/NativeMessagingHosts/`.
   * **Windows**: use `manifests/com.example.vless_proxy_win.json` and add the registry key described inside.

   Example for Linux:

   ```bash
   EXT_ID=<your_extension_id>
   mkdir -p ~/.config/google-chrome/NativeMessagingHosts
   sed "s/__EXTENSION_ID__/$EXT_ID/" manifests/com.example.vless_proxy.json > ~/.config/google-chrome/NativeMessagingHosts/com.example.vless_proxy.json
   ln -sf $(pwd)/vless_host.js /usr/local/bin/vless_host
   ```

3. Ensure `XRAY_PATH` points to the xray binary if it lives somewhere other than `/usr/local/bin/xray`.

The helper listens for `apply_config` and `stop` actions from the extension popup and starts/stops `xray` with the provided profile.

## 4. Load the Extension in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` directory.
4. After modifying `config.js` or any extension file, press **Reload** on the extension card.

The popup shows a red warning until all required values in `config.js` are filled in. Once configured, sign in with Twitch, ensure you follow the configured channel, and enable the PAC proxy toggle. Use the **Start xray** button to push the VLESS profile to the native host.

## 5. Troubleshooting

* If Twitch sign-in fails, double-check the redirect URI in the Twitch console matches the extension ID and that `chrome.identity` has permission to launch popups (Chrome asks once per sign-in attempt).
* If starting xray fails, confirm the native host manifest points at the helper executable and that the helper can execute the xray binary (`chmod +x` or adjust `XRAY_PATH`).
* View extension logs via `chrome://extensions` → **Service Worker** → **Inspect** for background messages.
* Native host logs print to stderr; launch Chrome from a terminal to capture them or wrap the helper in a systemd service that logs output.

## 6. Packaging

When you're ready to distribute the extension privately, zip the `extension/` folder (excluding local secrets) and use Chrome's **Pack extension** option. Remember that publishing to the Chrome Web Store requires additional review and Twitch secrets should not be embedded in a publicly distributed extension.


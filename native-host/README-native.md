macOS/Linux:

npm i --omit=dev

chmod +x vless_host.js && sudo ln -sf $(pwd)/vless_host.js /usr/local/bin/vless_host

Install host manifest to:

macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.example.vless_proxy.json

Linux: ~/.config/google-chrome/NativeMessagingHosts/com.example.vless_proxy.json

Set XRAY_PATH if not /usr/local/bin/xray.

Windows:

Build to exe (pkg or nexe) and set path accordingly.

Add registry key:
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.example.vless_proxy = path to JSON manifest.



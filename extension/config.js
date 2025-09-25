export const CONFIG = {
  // Twitch OAuth
  TWITCH_CLIENT_ID: "REPLACE_WITH_TWITCH_CLIENT_ID",
  // Register this in Twitch console:
  TWITCH_REDIRECT_URI: "https://__EXTENSION_ID__.chromiumapp.org/",
  TWITCH_SCOPES: ["user:read:follows"],

  // Twitch gate (must follow this channel to enable proxy)
  TARGET_BROADCASTER_ID: "REPLACE_WITH_TWITCH_BROADCASTER_ID", // numeric

  // Local proxy parameters (xray-core output)
  LOCAL_PROXY: { scheme: "socks5", host: "127.0.0.1", port: 1080 },

  // Native messaging host name
  NATIVE_APP: "com.example.vless_proxy",

  // Defaults
  BYPASS_LIST: ["<local>", "localhost", "127.0.0.1"],
};



import { CONFIG } from "./config.js";

const TWITCH_AUTH = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_TOKEN = "https://id.twitch.tv/oauth2/token";
const TWITCH_API = "https://api.twitch.tv/helix";

async function sha256(input) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return new Uint8Array(digest);
}
function base64url(bytes) {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function rand(n = 96) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return base64url(a);
}

async function withSessionStore() {
  // prefer session storage so tokens die when browser closes
  const supportsSession = !!chrome.storage?.session;
  const store = supportsSession ? chrome.storage.session : chrome.storage.local;
  return store;
}

export const TwitchAuth = {
  async signIn() {
    const store = await withSessionStore();
    const code_verifier = rand(64);
    const cv_bytes = new TextEncoder().encode(code_verifier);
    const code_challenge = base64url(await sha256(cv_bytes));

    const params = new URLSearchParams({
      client_id: CONFIG.TWITCH_CLIENT_ID,
      redirect_uri: CONFIG.TWITCH_REDIRECT_URI,
      response_type: "code",
      scope: CONFIG.TWITCH_SCOPES.join(" "),
      code_challenge_method: "S256",
      code_challenge
    });

    const authUrl = `${TWITCH_AUTH}?${params.toString()}`;

    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    const url = new URL(redirectUrl);
    const code = url.searchParams.get("code");
    if (!code) throw new Error("No code returned");

    const tokenParams = new URLSearchParams({
      client_id: CONFIG.TWITCH_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: CONFIG.TWITCH_REDIRECT_URI,
      code_verifier
    });

    const tokenRes = await fetch(TWITCH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString()
    });
    const token = await tokenRes.json();
    if (!token.access_token) throw new Error("Token exchange failed");

    await store.set({ twitch_token: token });
    return token;
  },

  async signOut() {
    const store = await withSessionStore();
    await store.remove("twitch_token");
  },

  async ensure() {
    const store = await withSessionStore();
    const { twitch_token } = await store.get("twitch_token");
    return twitch_token;
  },

  async getUser(auth) {
    const res = await fetch(`${TWITCH_API}/users`, {
      headers: {
        "Client-Id": CONFIG.TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${auth.access_token}`
      }
    });
    const data = await res.json();
    return data?.data?.[0];
  },

  async getFollowedChannels(auth, user_id) {
    const url = new URL(`${TWITCH_API}/channels/followed`);
    url.searchParams.set("user_id", user_id);
    let out = [];
    let cursor;

    do {
      if (cursor) url.searchParams.set("after", cursor);
      const res = await fetch(url.toString(), {
        headers: {
          "Client-Id": CONFIG.TWITCH_CLIENT_ID,
          "Authorization": `Bearer ${auth.access_token}`
        }
      });
      const data = await res.json();
      out = out.concat(data?.data || []);
      cursor = data?.pagination?.cursor;
    } while (cursor);

    return out;
  }
};



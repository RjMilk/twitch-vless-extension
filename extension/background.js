import { CONFIG } from "./config.js";
import { TwitchAuth } from "./oauth.js";

const STORAGE_KEY = "allowedDomains";

function dedupe(arr) { return [...new Set(arr.map(s => s.trim()).filter(Boolean))]; }
function normalize(list) {
  return list.map(x => x
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim());
}

async function getDomains() {
  const o = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  return o[STORAGE_KEY];
}
async function setDomains(list) {
  const clean = dedupe(normalize(list));
  await chrome.storage.local.set({ [STORAGE_KEY]: clean });
  await applyPAC(); // refresh PAC after change
}

function buildPAC(domains) {
  const PROXY = `${CONFIG.LOCAL_PROXY.scheme.toUpperCase()} ${CONFIG.LOCAL_PROXY.host}:${CONFIG.LOCAL_PROXY.port}; DIRECT`;
  const pac = `
function FindProxyForURL(url, host) {
  var BYPASS = ${JSON.stringify(CONFIG.BYPASS_LIST)};
  for (var i=0;i<BYPASS.length;i++){ if (shExpMatch(host, BYPASS[i])) return "DIRECT"; }

  var rules = ${JSON.stringify(domains)};
  for (var j=0;j<rules.length;j++){
    var rule = rules[j];
    // wildcard
    if (rule.indexOf("*.") === 0) {
      var base = rule.slice(2);
      if (dnsDomainIs(host, base)) return "${PROXY}";
      continue;
    }
    if (host === rule || dnsDomainIs(host, "." + rule) || dnsDomainIs(host, rule)) {
      return "${PROXY}";
    }
  }
  return "DIRECT";
}`;
  return pac;
}

async function applyPAC() {
  const domains = await getDomains();
  const pacScript = buildPAC(domains);
  await chrome.proxy.settings.set({
    value: { mode: "pac_script", pacScript: { data: pacScript } },
    scope: "regular"
  });
}

async function disableProxy() {
  await chrome.proxy.settings.clear({ scope: "regular" });
}

async function requireFollowing() {
  const auth = await TwitchAuth.ensure();
  if (!auth?.access_token) return { ok: false, reason: "not_signed_in" };

  const me = await TwitchAuth.getUser(auth);
  if (!me?.id) return { ok: false, reason: "no_user" };

  // Get channels user follows, check target broadcaster
  const follows = await TwitchAuth.getFollowedChannels(auth, me.id);
  const ok = follows.some(ch => ch.broadcaster_id === CONFIG.TARGET_BROADCASTER_ID);
  return ok ? { ok: true, me } : { ok: false, reason: "not_following", me };
}

chrome.runtime.onInstalled.addListener(async () => {
  const o = await chrome.storage.local.get(STORAGE_KEY);
  if (!o[STORAGE_KEY]) await setDomains([]);
  chrome.contextMenus.create({
    id: "add-current-domain",
    title: "Route this domain via VLESS",
    contexts: ["page", "selection", "link"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "add-current-domain" || !tab?.url) return;
  try {
    const u = new URL(tab.url);
    const list = await getDomains();
    list.push(u.hostname);
    await setDomains(list);
  } catch {}
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "GET_DOMAINS") {
      sendResponse({ ok: true, domains: await getDomains() });
    } else if (msg.type === "SET_DOMAINS") {
      await setDomains(msg.domains || []);
      sendResponse({ ok: true });
    } else if (msg.type === "ENABLE_PAC") {
      const gate = await requireFollowing();
      if (!gate.ok) return sendResponse({ ok: false, gate });
      await applyPAC();
      sendResponse({ ok: true, gate });
    } else if (msg.type === "DISABLE_PROXY") {
      await disableProxy();
      sendResponse({ ok: true });
    } else if (msg.type === "TWITCH_SIGNIN") {
      const auth = await TwitchAuth.signIn();
      sendResponse({ ok: !!auth?.access_token });
    } else if (msg.type === "TWITCH_SIGNOUT") {
      await TwitchAuth.signOut();
      sendResponse({ ok: true });
    } else if (msg.type === "TWITCH_STATUS") {
      const gate = await requireFollowing();
      sendResponse({ ok: gate.ok, gate });
    } else if (msg.type === "XRAY_APPLY_CONFIG") {
      // Gate start under follow requirement
      const gate = await requireFollowing();
      if (!gate.ok) return sendResponse({ ok: false, gate });

      try {
        const res = await chrome.runtime.sendNativeMessage(CONFIG.NATIVE_APP, {
          action: "apply_config",
          profile: msg.profile // {server, port, uuid, flow, tls, sni, transport...}
        });
        sendResponse(res);
      } catch (err) {
        sendResponse({ success: false, error: err?.message || String(err) });
      }
    } else if (msg.type === "XRAY_STOP") {
      try {
        const res = await chrome.runtime.sendNativeMessage(CONFIG.NATIVE_APP, { action: "stop" });
        sendResponse(res);
      } catch (err) {
        sendResponse({ success: false, error: err?.message || String(err) });
      }
    }
  })();
  return true;
});



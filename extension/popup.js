import { CONFIG } from "./config.js";

const $ = s => document.querySelector(s);
const ta = $("#domains");
const enabled = $("#enabled");
const pill = $("#twitchStatus");
const signin = $("#signin");
const signout = $("#signout");
const startBtn = $("#startXray");
const stopBtn = $("#stopXray");
const configWarning = $("#configWarning");

function hasPlaceholder(value) {
  return typeof value === "string" && /REPLACE_WITH/.test(value);
}

function updateConfigState() {
  const missing = [];
  if (!CONFIG.TWITCH_CLIENT_ID || hasPlaceholder(CONFIG.TWITCH_CLIENT_ID)) {
    missing.push("TWITCH_CLIENT_ID");
  }
  if (!CONFIG.TARGET_BROADCASTER_ID || hasPlaceholder(CONFIG.TARGET_BROADCASTER_ID)) {
    missing.push("TARGET_BROADCASTER_ID");
  }

  const ok = missing.length === 0;
  if (configWarning) {
    configWarning.hidden = ok;
    if (!ok) {
      configWarning.textContent = `Перед использованием заполните ${missing.join(", ")}`;
    }
  }

  [signin, signout, startBtn, stopBtn].forEach(el => { if (el) el.disabled = !ok; });
  if (enabled) {
    enabled.disabled = !ok;
    if (!ok) enabled.checked = false;
  }
  return ok;
}

updateConfigState();

function setPill(state, text) {
  pill.classList.remove("ok","warn");
  if (state === "ok") pill.classList.add("ok");
  if (state === "warn") pill.classList.add("warn");
  pill.textContent = text;
}

async function load() {
  const res = await chrome.runtime.sendMessage({ type: "GET_DOMAINS" });
  ta.value = (res.domains || []).join("\n");

  updateConfigState();

  chrome.proxy.settings.get({ incognito: false }, details => {
    enabled.checked = details?.value?.mode === "pac_script";
  });

  await refreshGate();
}

async function refreshGate() {
  const st = await chrome.runtime.sendMessage({ type: "TWITCH_STATUS" });
  if (!st?.gate) { setPill("warn", "Не вошли в Twitch"); return; }

  if (st.gate.ok) {
    setPill("ok", "Подписка подтверждена ✅");
  } else {
    if (st.gate.reason === "not_signed_in") setPill("warn", "Не вошли в Twitch");
    else if (st.gate.reason === "not_following") setPill("warn", "Нет подписки на канал");
    else setPill("warn", "Заблокировано");
  }
}

$("#signin").onclick = async () => {
  const ok = await chrome.runtime.sendMessage({ type: "TWITCH_SIGNIN" });
  await refreshGate();
  if (!ok) alert("Вход не удался");
};
$("#signout").onclick = async () => {
  await chrome.runtime.sendMessage({ type: "TWITCH_SIGNOUT" });
  await refreshGate();
};

$("#save").onclick = async () => {
  const list = ta.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  await chrome.runtime.sendMessage({ type: "SET_DOMAINS", domains: list });
  if (enabled.checked) await chrome.runtime.sendMessage({ type: "ENABLE_PAC" });
};

$("#clear").onclick = async () => {
  ta.value = "";
  await chrome.runtime.sendMessage({ type: "SET_DOMAINS", domains: [] });
};

$("#addCurrent").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  const u = new URL(tab.url);
  const list = ta.value.split(/\r?\n/).filter(Boolean);
  if (!list.includes(u.hostname)) list.push(u.hostname);
  ta.value = list.join("\n");
};

enabled.onchange = async () => {
  if (enabled.checked) {
    const res = await chrome.runtime.sendMessage({ type: "ENABLE_PAC" });
    if (!res?.ok) {
      enabled.checked = false;
      alert("Прокси заблокирован: войдите в Twitch и подпишитесь на канал.");
    }
  } else {
    await chrome.runtime.sendMessage({ type: "DISABLE_PROXY" });
  }
};

$("#startXray").onclick = async () => {
  const profile = {
    server: "your-vless-server.example",
    port: 443,
    uuid: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    flow: "",
    tls: true,
    sni: "your-sni.example",
    transport: { type: "ws", path: "/vless", host: "your-sni.example" }
  };
  const res = await chrome.runtime.sendMessage({ type: "XRAY_APPLY_CONFIG", profile });
  if (!res?.success) alert("Запуск xray не удался: " + (res?.error || "unknown"));
};

$("#stopXray").onclick = async () => {
  await chrome.runtime.sendMessage({ type: "XRAY_STOP" });
};

load();



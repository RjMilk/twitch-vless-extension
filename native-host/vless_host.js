#!/usr/bin/env node
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

let xrayProc = null;
const TMP_CFG = path.join(require("os").tmpdir(), "xray-config.json");
const XRAY_PATH = process.env.XRAY_PATH || "/usr/local/bin/xray"; // set per OS

function writeMessage(obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}

function readMessage() {
  const header = Buffer.alloc(4);
  fs.readSync(0, header, 0, 4, null);
  const len = header.readUInt32LE(0);
  const body = Buffer.alloc(len);
  fs.readSync(0, body, 0, len, null);
  return JSON.parse(body.toString());
}

function xrayConfigFromProfile(p) {
  return {
    "log": { "loglevel": "warning" },
    "inbounds": [{
      "tag": "socks-in",
      "port": 1080,
      "listen": "127.0.0.1",
      "protocol": "socks",
      "settings": { "udp": true }
    }],
    "outbounds": [{
      "protocol": "vless",
      "settings": { "vnext": [{
        "address": p.server,
        "port": p.port,
        "users": [{ "id": p.uuid, "encryption": "none", "flow": p.flow || "" }]
      }]},
      "streamSettings": {
        "network": p.transport?.type || "tcp",
        "security": p.tls ? "tls" : "none",
        "tlsSettings": p.tls ? { "serverName": p.sni, "allowInsecure": false } : undefined,
        "wsSettings": p.transport?.type === "ws" ? {
          "path": p.transport.path,
          "headers": { "Host": p.transport.host }
        } : undefined
      }
    }]
  };
}

function applyConfig(profile) {
  const cfg = xrayConfigFromProfile(profile);
  fs.writeFileSync(TMP_CFG, JSON.stringify(cfg, null, 2));
  if (xrayProc) { try { xrayProc.kill(); } catch(_){} xrayProc = null; }
  xrayProc = spawn(XRAY_PATH, ["-c", TMP_CFG], { stdio: "ignore" });
  xrayProc.on("exit", (code) => {
    // no-op
  });
  return { success: true };
}

function stopXray() {
  if (xrayProc) { try { xrayProc.kill(); } catch(_){} xrayProc = null; }
  return { success: true };
}

function main() {
  while (true) {
    try {
      const msg = readMessage();
      if (msg.action === "apply_config") writeMessage(applyConfig(msg.profile));
      else if (msg.action === "stop") writeMessage(stopXray());
      else writeMessage({ success: false, error: "unknown_action" });
    } catch (e) {
      writeMessage({ success: false, error: String(e) });
    }
  }
}
main();



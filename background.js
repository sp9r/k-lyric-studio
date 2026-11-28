const lrcCache = new Map();
const trCache = new Map();
const TR_ENDPOINT = "https://translate.googleapis.com/translate_a/single";

// The review studio embeds YouTube players inside an extension page. YouTube refuses embeds that
// carry no http(s) Referer (error 153), so requests for the embed frame made by this extension's own
// pages get a fixed Referer. Pages of other sites are not touched.
async function ensureEmbedRefererRule() {
  try {
    if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) return;
    const host = new URL(chrome.runtime.getURL("")).hostname;
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [9001],
      addRules: [
        {
          id: 9001,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [{ header: "Referer", operation: "set", value: "https://github.com/sp9r/k-lyric-studio" }]
          },
          condition: {
            requestDomains: ["youtube-nocookie.com"],
            resourceTypes: ["sub_frame"],
            initiatorDomains: [host]
          }
        }
      ]
    });
  } catch (e) {
    console.warn("[K-Lyric] embed referer rule:", e && e.message);
  }
}
ensureEmbedRefererRule();
if (chrome.runtime && chrome.runtime.onInstalled) chrome.runtime.onInstalled.addListener(ensureEmbedRefererRule);
if (chrome.runtime && chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(ensureEmbedRefererRule);

function hasHangul(s) {
  return /[\uAC00-\uD7A3]/.test(String(s || ""));
}

async function fetchLrclibLyrics(query, durationSec, artistHint) {
  const cleanQ = String(query || "").trim();
  if (!cleanQ) return { ok: false, error: "検索語が空です" };

  const normArtist = String(artistHint || "")
    .replace(/\s*-\s*Topic$/i, "")
    .trim()
    .toLowerCase();
  const cacheKey = `${cleanQ}|${Math.round(durationSec || 0)}|${normArtist}`;
  if (lrcCache.has(cacheKey)) {
    return lrcCache.get(cacheKey);
  }

  try {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanQ)}`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) {
      return { ok: false, error: `LRCLIB HTTP ${resp.status}` };
    }
    const list = await resp.json();
    if (!Array.isArray(list) || !list.length) {
      return { ok: false, error: "該当する同期歌詞が見つかりません" };
    }

    const targetDur = Number(durationSec) || 0;
    const scored = list
      .filter((item) => item && (item.syncedLyrics || item.plainLyrics))
      .map((item) => {
        let score = 0;
        if (item.syncedLyrics) score += 50;
        if (hasHangul(item.syncedLyrics || item.plainLyrics)) score += 40;
        const itemDur = Number(item.duration) || 0;
        if (itemDur > 0 && itemDur < 20 && (!targetDur || targetDur >= 40)) {
          score -= 100;
        } else if (targetDur >= 30 && itemDur > 0 && Math.abs(itemDur - targetDur) > 45) {
          score -= 80;
        } else if (targetDur && itemDur) {
          const diff = Math.abs(itemDur - targetDur);
          if (diff <= 5) score += 20;
          else if (diff <= 15) score += 10;
        }
        if (normArtist) {
          const itemArtist = String(item.artistName || "").toLowerCase();
          if (itemArtist && (itemArtist.includes(normArtist) || (normArtist.length >= 2 && normArtist.includes(itemArtist)))) {
            score += 15;
          }
        }
        const durDiff = targetDur && itemDur ? Math.abs(itemDur - targetDur) : 9999;
        return { item, score, durDiff };
      })
      .sort((a, b) => (b.score - a.score) || (a.durDiff - b.durDiff));

    if (!scored.length) {
      return { ok: false, error: "利用可能な歌詞データがありません" };
    }
    if (scored[0].score < 0) {
      return { ok: false, error: "条件に合う歌詞が見つかりません" };
    }

    const top = scored[0].item;
    const result = {
      ok: true,
      trackName: top.trackName || "",
      artistName: top.artistName || "",
      duration: top.duration || 0,
      syncedLyrics: top.syncedLyrics || "",
      plainLyrics: top.plainLyrics || ""
    };
    lrcCache.set(cacheKey, result);
    return result;
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

async function fetchCaptionJson3(baseUrl) {
  if (!baseUrl) return { ok: false, error: "URLが空です" };
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("fmt", "json3");
    const resp = await fetch(u.toString());
    if (!resp.ok) return { ok: false, error: `Subtitle HTTP ${resp.status}` };
    const data = await resp.json();
    return { ok: true, json3: data };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

async function gtxTranslate(text, sl = "ko", tl = "ja") {
  const resp = await fetch(TR_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: `client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`
  });
  if (!resp.ok) throw new Error(`翻訳 HTTP ${resp.status}`);
  const data = await resp.json();
  return (Array.isArray(data && data[0]) ? data[0] : [])
    .map((seg) => (seg && typeof seg[0] === "string" ? seg[0] : ""))
    .join("")
    .replace(/\n$/, "");
}

// Translates many lines with as few requests as possible; returns an array the same length.
async function translateLines(lines) {
  const src = (Array.isArray(lines) ? lines : []).map((l) => String(l || "").replace(/\s+/g, " ").trim());
  const out = src.map((l) => (trCache.has(l) ? trCache.get(l) : ""));
  const todo = src.map((l, i) => i).filter((i) => src[i] && !trCache.has(src[i]));
  const chunks = [];
  let cur = [];
  let len = 0;
  for (const i of todo) {
    if (cur.length && len + src[i].length > 1500) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(i);
    len += src[i].length + 1;
  }
  if (cur.length) chunks.push(cur);
  try {
    for (const chunk of chunks) {
      let parts = (await gtxTranslate(chunk.map((i) => src[i]).join("\n"))).split("\n");
      if (parts.length !== chunk.length) {
        // Line breaks were merged; translate one by one so lines stay matched.
        parts = [];
        for (const i of chunk) parts.push(await gtxTranslate(src[i]));
      }
      chunk.forEach((i, k) => {
        const v = String(parts[k] || "").trim();
        out[i] = v;
        trCache.set(src[i], v);
      });
    }
    return { ok: true, lines: out };
  } catch (err) {
    return { ok: false, lines: out, error: String(err && err.message ? err.message : err) };
  }
}

async function callBridge(baseUrl, path, payload) {
  try {
    const endpoint = String(baseUrl || "http://127.0.0.1:8788").replace(/\/+$/, "") + path;
    const resp = await fetch(endpoint, {
      method: payload ? "POST" : "GET",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined
    });
    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  if (msg.type === "kls:fetch-lrclib") {
    fetchLrclibLyrics(msg.query, msg.duration, msg.artist || "").then(sendResponse);
    return true;
  }

  if (msg.type === "kls:fetch-caption") {
    fetchCaptionJson3(msg.baseUrl).then(sendResponse);
    return true;
  }

  if (msg.type === "kls:translate") {
    translateLines(msg.lines).then(sendResponse);
    return true;
  }

  if (msg.type === "kls:bridge-health") {
    callBridge(msg.bridgeUrl, "/api/health", null).then(sendResponse);
    return true;
  }

  if (msg.type === "kls:bridge-explain") {
    callBridge(msg.bridgeUrl, "/api/explain", msg.payload).then(sendResponse);
    return true;
  }

  if (msg.type === "kls:bridge-transcribe") {
    callBridge(msg.bridgeUrl, "/api/transcribe", msg.payload).then(sendResponse);
    return true;
  }

  if (msg.type === "kls:open-studio") {
    const tab = ["card", "cloze", "list", "freq"].includes(msg.tab) ? `#${msg.tab}` : "";
    chrome.tabs.create({ url: chrome.runtime.getURL(`studio.html${tab}`) });
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "kls:open-page") {
    const page = msg.page === "options" ? "options.html" : "studio.html";
    const hash = page === "studio.html" && ["card", "cloze", "list", "freq"].includes(msg.tab) ? `#${msg.tab}` : "";
    chrome.tabs.create({ url: chrome.runtime.getURL(`${page}${hash}`) });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

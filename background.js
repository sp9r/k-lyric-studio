const lrcCache = new Map();

function hasHangul(s) {
  return /[\uAC00-\uD7A3]/.test(String(s || ""));
}

async function fetchLrclibLyrics(query, durationSec) {
  const cleanQ = String(query || "").trim();
  if (!cleanQ) return { ok: false, error: "検索語が空です" };

  const cacheKey = `${cleanQ}|${Math.round(durationSec || 0)}`;
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

    const scored = list
      .filter((item) => item && (item.syncedLyrics || item.plainLyrics))
      .map((item) => {
        let score = 0;
        if (item.syncedLyrics) score += 50;
        if (hasHangul(item.syncedLyrics || item.plainLyrics)) score += 40;
        if (durationSec && item.duration) {
          const diff = Math.abs(Number(item.duration) - Number(durationSec));
          if (diff <= 5) score += 20;
          else if (diff <= 15) score += 10;
        }
        return { item, score };
      })
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      return { ok: false, error: "利用可能な歌詞データがありません" };
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
    fetchLrclibLyrics(msg.query, msg.duration).then(sendResponse);
    return true;
  }

  if (msg.type === "kls:fetch-caption") {
    fetchCaptionJson3(msg.baseUrl).then(sendResponse);
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

  if (msg.type === "kls:open-page") {
    const page = msg.page === "options" ? "options.html" : "studio.html";
    chrome.tabs.create({ url: chrome.runtime.getURL(page) });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

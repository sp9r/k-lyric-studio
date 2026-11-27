(function () {
  if (window.__kLyricPageHookInstalled) return;
  window.__kLyricPageHookInstalled = true;

  function isAdText(s) {
    return /広告|ad\s*will\s*play|video\s*will\s*play\s*after/i.test(String(s || ""));
  }

  function collectMetadata() {
    const isMusic = location.hostname === "music.youtube.com";
    let videoId = "";
    let title = "";
    let author = "";
    let channelId = "";
    let durationSec = 0;
    let isAd = false;
    let captionTracks = [];

    let stale = false;
    try {
      const player = document.getElementById("movie_player");
      let currentId = "";
      let vd = null;
      try {
        vd = player?.getVideoData?.();
        currentId = vd?.video_id || "";
      } catch (_) {}
      try {
        isAd = Boolean(vd?.isAd || player?.getAdState?.() === 1 || player?.classList?.contains("ad-showing"));
      } catch (_) {}
      if (player && typeof player.getPlayerResponse === "function") {
        const resp = player.getPlayerResponse();
        // Right after a song change the player response can still describe the previous track.
        if (currentId && resp?.videoDetails?.videoId && resp.videoDetails.videoId !== currentId) {
          stale = true;
        }
        if (resp && resp.videoDetails && !stale) {
          videoId = resp.videoDetails.videoId || "";
          title = resp.videoDetails.title || "";
          author = resp.videoDetails.author || "";
          channelId = resp.videoDetails.channelId || "";
          durationSec = Number(resp.videoDetails.lengthSeconds) || 0;
        }
        const tracks = stale ? null : resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (Array.isArray(tracks)) {
          captionTracks = tracks.map((t) => ({
            baseUrl: t.baseUrl,
            languageCode: t.languageCode,
            kind: t.kind || "",
            name: t.name?.simpleText || t.name?.runs?.map((r) => r.text).join("") || t.languageCode
          }));
        }
      }
      if (!durationSec && player && typeof player.getDuration === "function") {
        const d = Number(player.getDuration());
        if (Number.isFinite(d) && d > 20) durationSec = Math.round(d);
      }
    } catch (_) {
      // Ignore cross-frame or unready player errors
    }

    if (!videoId) {
      try {
        const vd = document.getElementById("movie_player")?.getVideoData?.();
        if (vd && vd.video_id) {
          videoId = vd.video_id;
          title = title || vd.title || "";
          author = author || vd.author || "";
        }
      } catch (_) {}
    }
    if (!videoId) {
      const sp = new URLSearchParams(location.search);
      videoId = sp.get("v") || "";
    }

    if (isMusic) {
      const titleEl = document.querySelector("ytmusic-player-bar .title");
      const subEl = document.querySelector("ytmusic-player-bar .byline");
      const barTitle = titleEl?.textContent?.trim() || "";
      const barAuthor = subEl?.textContent?.split("•")[0]?.trim() || "";
      if (!title && barTitle && !isAdText(barTitle)) {
        title = barTitle;
      }
      if (!title) {
        const docTitle = document.title.replace(/\s*-\s*YouTube Music$/, "").trim();
        if (docTitle && docTitle !== "YouTube Music" && !isAdText(docTitle)) title = docTitle;
      }
      if (!author && barAuthor && !isAdText(barAuthor)) {
        author = barAuthor;
      }
    }

    if (!title && !isMusic) {
      const h1 = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, #title h1");
      title = h1?.textContent?.trim() || document.title.replace(/\s*-\s*YouTube$/, "").trim();
    }

    if (!author && !isMusic) {
      const ch = document.querySelector("#owner #channel-name a, ytd-channel-name a");
      author = ch?.textContent?.trim() || "";
    }

    return {
      stale,
      isAd,
      source: "kls-page-hook",
      isMusic,
      url: location.href,
      videoId,
      title,
      author,
      channelId,
      durationSec,
      captionTracks
    };
  }

  let lastEmittedSig = "";

  function metaSig(meta) {
    return `${meta.videoId}|${meta.title}|${meta.author}|${meta.captionTracks.length}|${meta.durationSec}`;
  }

  function emit(attempt = 0) {
    const meta = collectMetadata();
    if (meta.stale && attempt < 8) {
      setTimeout(() => emit(attempt + 1), 500);
      return;
    }
    lastEmittedSig = metaSig(meta);
    window.postMessage(meta, "*");
  }

  // YouTube Music changes songs (queue, autoplay, next button, clicks from home) without
  // firing yt-navigate-finish, and metadata/tracks can arrive slightly after the video_id.
  setInterval(() => {
    const meta = collectMetadata();
    if (!meta.videoId || meta.stale) return;
    if (meta.isAd && !meta.title) return;
    const sig = metaSig(meta);
    if (sig !== lastEmittedSig) {
      lastEmittedSig = sig;
      setTimeout(() => emit(0), 250);
    }
  }, 1000);

  function bindVideoHooks() {
    const v = document.querySelector("#movie_player video, video.html5-main-video, video");
    if (!v || v.__klsHooked) return;
    v.__klsHooked = true;
    v.addEventListener("loadedmetadata", () => setTimeout(() => emit(0), 300));
    v.addEventListener("emptied", () => setTimeout(() => emit(0), 500));
  }
  setInterval(bindVideoHooks, 2000);
  bindVideoHooks();

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.source === "kls-request-meta") {
      emit(0);
    }
  });

  window.addEventListener("yt-navigate-finish", () => setTimeout(() => emit(0), 350));
  window.addEventListener("yt-page-data-updated", () => setTimeout(() => emit(0), 350));
  setTimeout(() => emit(0), 500);
  // ---- Captions through the player -------------------------------------------------
  // Caption downloads now need the player's proof-of-origin token ("pot"); a plain fetch of
  // a track's baseUrl returns an empty body. Instead, switch the player's own captions on
  // for a moment (hidden) and read the response the player receives. The signed URL it used
  // is also kept, so the Japanese track can be fetched with the same token.
  const capturedTimedtext = {};
  const timedtextBodies = {};

  function ttKey(v, lang, tlang) {
    return `${v}|${String(lang || "").split("-")[0]}|${tlang || ""}`;
  }

  function rememberTimedtext(url, text) {
    try {
      const u = new URL(url, location.href);
      if (!u.pathname.endsWith("/api/timedtext")) return;
      const v = u.searchParams.get("v");
      if (!v) return;
      if (u.searchParams.get("pot")) capturedTimedtext[v] = u.toString();
      if (!text) return;
      const json = typeof text === "string" ? JSON.parse(text) : text;
      if (json && Array.isArray(json.events) && json.events.length) {
        timedtextBodies[ttKey(v, u.searchParams.get("lang"), u.searchParams.get("tlang"))] = json;
      }
    } catch (_) {}
  }

  // Watch caption responses only; nothing is changed.
  try {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      try { this.__klsUrl = String(url); } catch (_) {}
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      if (this.__klsUrl && this.__klsUrl.includes("/api/timedtext")) {
        this.addEventListener("load", () => {
          try {
            let body = "";
            if (this.responseType === "" || this.responseType === "text") body = this.responseText;
            else if (this.responseType === "json") body = this.response;
            rememberTimedtext(this.responseURL || this.__klsUrl, body);
          } catch (_) {}
        });
      }
      return origSend.apply(this, arguments);
    };
    const origFetch = window.fetch;
    window.fetch = function (input) {
      const p = origFetch.apply(this, arguments);
      try {
        const url = typeof input === "string" ? input : input && input.url;
        if (url && String(url).includes("/api/timedtext")) {
          p.then((r) => r.clone().text()).then((t) => rememberTimedtext(String(url), t)).catch(() => {});
        }
      } catch (_) {}
      return p;
    };
  } catch (_) {}

  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name && entry.name.includes("/api/timedtext")) rememberTimedtext(entry.name);
      }
    });
    po.observe({ type: "resource", buffered: true });
  } catch (_) {}

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function signedUrl(baseUrl, captured, extra) {
    const out = new URL(baseUrl, location.href);
    const cap = new URL(captured);
    const skip = new Set(["lang", "kind", "tlang", "fmt", "name"]);
    for (const [k, v] of cap.searchParams) {
      if (!skip.has(k) && !out.searchParams.has(k)) out.searchParams.set(k, v);
    }
    out.searchParams.set("fmt", "json3");
    for (const [k, v] of Object.entries(extra || {})) out.searchParams.set(k, v);
    return out.toString();
  }

  async function fetchJson3(url) {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text) return null;
      const json = JSON.parse(text);
      return json && Array.isArray(json.events) && json.events.length ? json : null;
    } catch (_) {
      return null;
    }
  }

  async function waitFor(fn, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(250);
    }
    return fn();
  }

  // Run `work` with the player's captions module available but its text hidden, then put the
  // user's own caption choice (and YouTube's remembered "captions on" flag) back.
  async function withHiddenCaptions(player, work) {
    const STICKY = "yt-player-sticky-caption";
    let stickyBefore = null;
    try { stickyBefore = localStorage.getItem(STICKY); } catch (_) {}
    let prevTrack = null;
    try { prevTrack = player.getOption("captions", "track"); } catch (_) {}
    const hide = document.createElement("style");
    hide.textContent = ".ytp-caption-window-container{visibility:hidden!important}";
    document.documentElement.appendChild(hide);
    try {
      try { player.loadModule("captions"); } catch (_) {}
      return await work();
    } finally {
      try {
        if (prevTrack && prevTrack.languageCode) player.setOption("captions", "track", prevTrack);
        else {
          player.setOption("captions", "track", {});
          try { player.unloadModule("captions"); } catch (_) {}
        }
      } catch (_) {}
      try {
        if (stickyBefore === null) localStorage.removeItem(STICKY);
        else localStorage.setItem(STICKY, stickyBefore);
      } catch (_) {}
      setTimeout(() => hide.remove(), 300);
    }
  }

  async function playerTrackList(player) {
    return (await waitFor(() => {
      try {
        const list = player.getOption("captions", "tracklist") || [];
        return list.length ? list : null;
      } catch (_) {
        return null;
      }
    }, 8000)) || [];
  }

  // Select a track in the player and wait for its response to come through.
  async function loadViaPlayer(player, videoId, track, tlang) {
    const key = ttKey(videoId, track.languageCode, tlang);
    if (timedtextBodies[key]) return timedtextBodies[key];
    const sel = tlang ? { ...track, translationLanguage: { languageCode: tlang, languageName: "日本語" } } : track;
    try { player.setOption("captions", "track", sel); } catch (_) {}
    return waitFor(() => timedtextBodies[key], 6000);
  }

  let captionBusy = Promise.resolve();

  async function handleCaptionRequest(reqId, videoId) {
    const reply = (data) => window.postMessage({ source: "kls-page-captions", reqId, videoId, ...data }, "*");
    try {
      const player = await waitFor(() => {
        const p = document.getElementById("movie_player");
        return p && typeof p.setOption === "function" ? p : null;
      }, 8000);
      if (!player) return reply({ ok: false, error: "no player", retry: true });
      // While an ad plays the captions module belongs to the ad; switching tracks then does
      // nothing and the request used to give up. Wait for the video itself.
      const adOver = await waitFor(() => !player.classList.contains("ad-showing"), 45000);
      if (!adOver) return reply({ ok: false, error: "ad still playing", retry: true });
      const currentId = () => {
        try { return player.getVideoData?.()?.video_id || ""; } catch (_) { return ""; }
      };
      if (currentId() && currentId() !== videoId) return reply({ ok: false, error: "video changed" });
      // The response (and its track list) can arrive a moment after the page changes.
      const resp = await waitFor(() => {
        const r = player.getPlayerResponse?.();
        return r && r.videoDetails?.videoId === videoId ? r : null;
      }, 8000) || player.getPlayerResponse?.();
      if (!resp || resp.videoDetails?.videoId !== videoId) return reply({ ok: false, error: "player not ready", retry: true });
      const tracks = resp.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      const pick = (list, lang) =>
        list.find((t) => String(t.languageCode).startsWith(lang) && t.kind !== "asr") ||
        list.find((t) => String(t.languageCode).startsWith(lang));
      const koTrack = pick(tracks, "ko");
      if (!koTrack) return reply({ ok: false, error: "no korean track" });
      const jaTrack = pick(tracks, "ja");

      const result = await withHiddenCaptions(player, async () => {
        const list = await playerTrackList(player);
        const koP = pick(list, "ko");
        const jaP = pick(list, "ja");
        if (!koP) return { ok: false, error: "player has no korean track", retry: true };
        let ko = await loadViaPlayer(player, videoId, koP);
        const captured = capturedTimedtext[videoId];
        if (!ko && captured) ko = await fetchJson3(signedUrl(koTrack.baseUrl, captured));
        if (!ko) return { ok: false, error: "korean captions empty", retry: true };
        let ja = null;
        if (captured) {
          ja = jaTrack
            ? await fetchJson3(signedUrl(jaTrack.baseUrl, captured))
            : await fetchJson3(signedUrl(koTrack.baseUrl, captured, { tlang: "ja" }));
        }
        if (!ja) ja = jaP ? await loadViaPlayer(player, videoId, jaP) : await loadViaPlayer(player, videoId, koP, "ja");
        return { ok: true, ko, ja };
      });
      reply(result);
    } catch (err) {
      reply({ ok: false, error: String(err) });
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "kls-request-captions") return;
    const { reqId, videoId } = event.data;
    // One at a time: two requests switching caption tracks would fight each other.
    captionBusy = captionBusy.then(() => handleCaptionRequest(reqId, videoId));
  });
})();

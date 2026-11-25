(function () {
  if (window.__kLyricPageHookInstalled) return;
  window.__kLyricPageHookInstalled = true;

  function collectMetadata() {
    const isMusic = location.hostname === "music.youtube.com";
    let videoId = "";
    let title = "";
    let author = "";
    let captionTracks = [];

    let stale = false;
    try {
      const player = document.getElementById("movie_player");
      let currentId = "";
      try {
        currentId = player?.getVideoData?.()?.video_id || "";
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

    if (!title && isMusic) {
      const titleEl = document.querySelector("ytmusic-player-bar .title");
      const subEl = document.querySelector("ytmusic-player-bar .byline");
      title = titleEl?.textContent?.trim() || document.title.replace(/\s*-\s*YouTube Music$/, "").trim();
      author = subEl?.textContent?.split("•")[0]?.trim() || "";
    }

    if (!title) {
      const h1 = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, #title h1");
      title = h1?.textContent?.trim() || document.title.replace(/\s*-\s*YouTube$/, "").trim();
    }

    if (!author) {
      const ch = document.querySelector("#owner #channel-name a, ytd-channel-name a");
      author = ch?.textContent?.trim() || "";
    }

    return {
      stale,
      source: "kls-page-hook",
      isMusic,
      url: location.href,
      videoId,
      title,
      author,
      captionTracks
    };
  }

  let lastEmittedId = null;

  function emit(attempt = 0) {
    const meta = collectMetadata();
    if (meta.stale && attempt < 8) {
      setTimeout(() => emit(attempt + 1), 500);
      return;
    }
    lastEmittedId = meta.videoId;
    window.postMessage(meta, "*");
  }

  // YouTube Music changes songs (queue, autoplay, next button, clicks from home) without
  // firing yt-navigate-finish, so watch the player's current video id directly.
  setInterval(() => {
    let id = "";
    try {
      id = document.getElementById("movie_player")?.getVideoData?.()?.video_id || "";
    } catch (_) {}
    if (id && id !== lastEmittedId) {
      lastEmittedId = id;
      setTimeout(() => emit(0), 400);
    }
  }, 1000);

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.source === "kls-request-meta") {
      emit(0);
    }
  });

  window.addEventListener("yt-navigate-finish", () => setTimeout(() => emit(0), 350));
  window.addEventListener("yt-page-data-updated", () => setTimeout(() => emit(0), 350));
  setTimeout(() => emit(0), 500);
})();

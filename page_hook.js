(function () {
  if (window.__kLyricPageHookInstalled) return;
  window.__kLyricPageHookInstalled = true;

  function collectMetadata() {
    const isMusic = location.hostname === "music.youtube.com";
    let videoId = "";
    let title = "";
    let author = "";
    let captionTracks = [];

    try {
      const player = document.getElementById("movie_player");
      if (player && typeof player.getPlayerResponse === "function") {
        const resp = player.getPlayerResponse();
        if (resp && resp.videoDetails) {
          videoId = resp.videoDetails.videoId || "";
          title = resp.videoDetails.title || "";
          author = resp.videoDetails.author || "";
        }
        const tracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
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
      source: "kls-page-hook",
      isMusic,
      url: location.href,
      videoId,
      title,
      author,
      captionTracks
    };
  }

  function emit() {
    window.postMessage(collectMetadata(), "*");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.source === "kls-request-meta") {
      emit();
    }
  });

  window.addEventListener("yt-navigate-finish", () => setTimeout(emit, 350));
  window.addEventListener("yt-page-data-updated", () => setTimeout(emit, 350));
  setTimeout(emit, 500);
})();

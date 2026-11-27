// Korean vocabulary frequency log across watched YouTube (captions ON) and YouTube Music videos.
// Deduplicates by videoId so rewatching the same video never inflates counts, filters to Korean
// tracks/videos, and stores timestamped URLs with video titles for quick playback jumps.
(function (root, factory) {
  const hangulApi =
    typeof module === "object" && module.exports
      ? require("./hangul.js")
      : root.KLyricHangul;
  const dictApi =
    typeof module === "object" && module.exports
      ? require("./dictionary.js")
      : root.KLyricDict;
  const api = factory(hangulApi, dictApi);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.KLyricVocabLog = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function (Hangul, Dict) {
  const HANGUL_RE = /[\uAC00-\uD7A3]/;
  const HANGUL_RUN_RE = /[\uAC00-\uD7A3]+/g;
  const WORD_SPLIT_RE = /[\s,.;:!?'"()\[\]{}<>/\\|~`@#$%^&*+=_\-—…·「」『』【】〈〉《》、。！？]+/;
  const MAX_OCCURRENCES_PER_VIDEO = 3;
  const MAX_OCCURRENCES_PER_WORD = 60;
  const MIN_SEC_GAP_SAME_VIDEO = 15;

  function hydrateOccurrence(occ, videosMap) {
    if (!occ || typeof occ !== "object") return occ;
    const vid = String(occ.videoId || "").trim();
    const vrec = vid && videosMap && videosMap[vid] ? videosMap[vid] : null;
    const isMusic = occ.isMusic !== undefined ? Boolean(occ.isMusic) : Boolean(vrec && vrec.site === "music");
    const title = occ.title || (vrec && vrec.title) || vid || "YouTube";
    const sec = Math.max(0, Math.floor(Number(occ.sec) || 0));
    const url = occ.url || (vid ? buildTimestampUrl(vid, sec, isMusic) : "");
    return {
      ...occ,
      videoId: vid,
      title,
      isMusic,
      sec,
      url
    };
  }

  function normalizeStore(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const videos = src.videos && typeof src.videos === "object" && !Array.isArray(src.videos) ? { ...src.videos } : {};
    const rawWords = src.words && typeof src.words === "object" && !Array.isArray(src.words) ? src.words : {};
    const words = {};
    for (const [k, w] of Object.entries(rawWords)) {
      if (!w || typeof w !== "object") continue;
      if (Array.isArray(w.occurrences)) {
        const needsHydrate = w.occurrences.some((o) => o && (!o.url || !o.title));
        words[k] = needsHydrate
          ? { ...w, occurrences: w.occurrences.map((o) => hydrateOccurrence(o, videos)) }
          : w;
      } else {
        words[k] = w;
      }
    }
    return {
      version: 1,
      videos,
      words
    };
  }

  function compactForStorage(rawStore) {
    const store = normalizeStore(rawStore);
    const compactVideos = {};
    for (const [vid, rec] of Object.entries(store.videos)) {
      if (!rec || typeof rec !== "object") continue;
      compactVideos[vid] = {
        videoId: rec.videoId || vid,
        title: rec.title || "",
        author: rec.author || "",
        site: rec.site || "youtube",
        recordedAt: rec.recordedAt || 0,
        uniqueWords: rec.uniqueWords || 0,
        wordCounts: rec.wordCounts && typeof rec.wordCounts === "object" ? rec.wordCounts : {}
      };
    }

    const compactWords = {};
    for (const [k, w] of Object.entries(store.words)) {
      if (!w || typeof w !== "object") continue;
      const occs = Array.isArray(w.occurrences) ? w.occurrences : [];
      const compactOccs = occs.map((occ) => {
        if (!occ || typeof occ !== "object") return occ;
        const vid = String(occ.videoId || "").trim();
        const sec = Math.max(0, Math.floor(Number(occ.sec) || 0));
        const ctx = String(occ.context || "").slice(0, 120);
        const jaCtx = String(occ.jaContext || "").slice(0, 120);
        if (vid && compactVideos[vid]) {
          const out = { videoId: vid, sec };
          if (occ.surface) out.surface = occ.surface;
          if (ctx) out.context = ctx;
          if (jaCtx) out.jaContext = jaCtx;
          return out;
        }
        const out = { ...occ, sec };
        if (ctx) out.context = ctx;
        else delete out.context;
        if (jaCtx) out.jaContext = jaCtx;
        else delete out.jaContext;
        return out;
      });
      compactWords[k] = { ...w, occurrences: compactOccs };
    }

    return {
      version: 1,
      videos: compactVideos,
      words: compactWords
    };
  }

  function buildTimestampUrl(videoId, sec, isMusic) {
    const vid = String(videoId || "").trim();
    if (!vid) return "";
    const host = isMusic ? "music.youtube.com" : "www.youtube.com";
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    return `https://${host}/watch?v=${encodeURIComponent(vid)}&t=${s}s`;
  }

  function isKoreanContent(cues) {
    const list = Array.isArray(cues) ? cues : [];
    let totalTokens = 0;
    let koreanTokens = 0;
    const uniqueKorean = new Set();
    for (const cue of list) {
      const line = String(cue && cue.ko ? cue.ko : "").trim();
      if (!line) continue;
      for (const raw of line.split(WORD_SPLIT_RE)) {
        if (!raw) continue;
        totalTokens += 1;
        if (HANGUL_RE.test(raw)) {
          koreanTokens += 1;
          const clean = (raw.match(HANGUL_RUN_RE) || []).join("");
          if (clean) uniqueKorean.add(clean);
        }
      }
    }
    if (uniqueKorean.size < 2 || koreanTokens < 2) return false;
    const ratio = totalTokens > 0 ? koreanTokens / totalTokens : 0;
    return ratio >= 0.15 || (uniqueKorean.size >= 4 && ratio >= 0.05);
  }

  function shouldRecord(activationResult, settings, meta, cues) {
    if (!settings || settings.enabled === false) return false;
    if (!activationResult || !activationResult.active) return false;
    if (!meta || !meta.videoId) return false;
    if (!meta.isMusic && settings.showOverlay === false) return false;
    if (!Array.isArray(cues) || cues.length === 0) return false;
    return isKoreanContent(cues);
  }

  function extractKoreanTokens(cues, meta) {
    const list = Array.isArray(cues) ? cues : [];
    const byKey = new Map();
    const isMusic = Boolean(meta && meta.isMusic);
    const videoId = String((meta && meta.videoId) || "").trim();
    const title = String((meta && meta.title) || videoId || "YouTube").trim();

    for (const cue of list) {
      const text = String(cue && cue.ko ? cue.ko : "").trim();
      if (!text) continue;
      const sec = Math.max(0, Math.floor(Number(cue.start) || 0));
      for (const raw of text.split(WORD_SPLIT_RE)) {
        if (!raw || !HANGUL_RE.test(raw)) continue;
        const clean = (raw.match(HANGUL_RUN_RE) || []).join("");
        if (!clean) continue;

        const analysis = Dict && Dict.analyzeToken ? Dict.analyzeToken(clean) : { clean, lemma: clean, matched: false };
        const key = (analysis.matched && analysis.lemma ? analysis.lemma : clean).trim();
        if (!key || !HANGUL_RE.test(key)) continue;

        let entry = byKey.get(key);
        if (!entry) {
          const p = Hangul && Hangul.phoneticizeHangul ? Hangul.phoneticizeHangul(key) : {};
          const keyInfo = Dict && Dict.analyzeToken ? Dict.analyzeToken(key) : analysis;
          const meaning =
            (keyInfo.matched ? keyInfo.meaning : "") ||
            (analysis.matched ? analysis.meaning : "") ||
            "";
          entry = {
            key,
            lemma: key,
            surfaceSample: clean,
            meaning,
            pos: (keyInfo.matched ? keyInfo.pos : analysis.pos) || "語句",
            pronouncedHangul: p.pronouncedHangul || key,
            katakana: p.katakana || "",
            romanized: p.romanized || "",
            count: 0,
            occurrences: []
          };
          byKey.set(key, entry);
        }
        entry.count += 1;
        const alreadyNear = entry.occurrences.some(
          (o) => Math.abs(o.sec - sec) < MIN_SEC_GAP_SAME_VIDEO
        );
        if (!alreadyNear && entry.occurrences.length < MAX_OCCURRENCES_PER_VIDEO) {
          entry.occurrences.push({
            videoId,
            title,
            isMusic,
            sec,
            url: buildTimestampUrl(videoId, sec, isMusic),
            surface: clean,
            context: text,
            jaContext: String(cue.ja || "").trim()
          });
        }
      }
    }
    return Array.from(byKey.values());
  }

  function recordVideo(rawStore, meta, cues, nowMs = Date.now()) {
    const store = normalizeStore(rawStore);
    const videoId = String((meta && meta.videoId) || "").trim();
    if (!videoId) return { store, added: false, reason: "no_video", newWords: 0 };
    if (store.videos[videoId]) {
      return { store, added: false, reason: "already_recorded", newWords: 0 };
    }
    if (!isKoreanContent(cues)) {
      return { store, added: false, reason: "not_korean", newWords: 0 };
    }

    const extracted = extractKoreanTokens(cues, meta);
    if (!extracted.length) {
      return { store, added: false, reason: "no_words", newWords: 0 };
    }

    const isMusic = Boolean(meta && meta.isMusic);
    const title = String((meta && meta.title) || videoId).trim();
    store.videos[videoId] = {
      videoId,
      title,
      author: String((meta && meta.author) || "").trim(),
      site: isMusic ? "music" : "youtube",
      recordedAt: nowMs,
      uniqueWords: extracted.length,
      wordKeys: extracted.map((e) => e.key),
      wordCounts: Object.fromEntries(extracted.map((e) => [e.key, e.count]))
    };

    let newWords = 0;
    for (const item of extracted) {
      const prev = store.words[item.key];
      if (!prev) newWords += 1;
      const base = prev
        ? { ...prev, occurrences: Array.isArray(prev.occurrences) ? prev.occurrences.slice() : [] }
        : {
            key: item.key,
            lemma: item.lemma,
            surfaceSample: item.surfaceSample,
            meaning: item.meaning,
            pos: item.pos,
            pronouncedHangul: item.pronouncedHangul,
            katakana: item.katakana,
            romanized: item.romanized,
            videoCount: 0,
            totalCount: 0,
            lastSeenAt: 0,
            occurrences: []
          };

      base.videoCount += 1;
      base.totalCount += item.count;
      base.lastSeenAt = nowMs;
      if (!base.meaning && item.meaning) base.meaning = item.meaning;
      for (const occ of item.occurrences) {
        const dup = base.occurrences.some((x) => x.videoId === occ.videoId && x.sec === occ.sec);
        if (!dup) base.occurrences.push(occ);
      }
      if (base.occurrences.length > MAX_OCCURRENCES_PER_WORD) {
        base.occurrences = base.occurrences.slice(-MAX_OCCURRENCES_PER_WORD);
      }
      store.words[item.key] = base;
    }

    return { store, added: true, reason: "recorded", newWords, uniqueWords: extracted.length };
  }

  function removeVideo(rawStore, videoId) {
    const store = normalizeStore(rawStore);
    const vid = String(videoId || "").trim();
    const rec = store.videos[vid];
    if (!rec) return { store, removed: false };

    const counts = rec.wordCounts && typeof rec.wordCounts === "object" ? rec.wordCounts : {};
    for (const [key, cnt] of Object.entries(counts)) {
      const w = store.words[key];
      if (!w) continue;
      const next = {
        ...w,
        videoCount: Math.max(0, (Number(w.videoCount) || 0) - 1),
        totalCount: Math.max(0, (Number(w.totalCount) || 0) - (Number(cnt) || 0)),
        occurrences: (Array.isArray(w.occurrences) ? w.occurrences : []).filter((o) => o.videoId !== vid)
      };
      if (next.videoCount <= 0 || next.totalCount <= 0) {
        delete store.words[key];
      } else {
        store.words[key] = next;
      }
    }
    delete store.videos[vid];
    return { store, removed: true };
  }

  function findSavedCard(savedCards, wordEntry) {
    if (!savedCards || !wordEntry) return null;
    if (savedCards[wordEntry.key]) return savedCards[wordEntry.key];
    if (wordEntry.surfaceSample && savedCards[wordEntry.surfaceSample]) return savedCards[wordEntry.surfaceSample];
    const all = Object.values(savedCards);
    return all.find((c) => c && (c.lemma === wordEntry.key || c.surface === wordEntry.key)) || null;
  }

  function rankWords(rawStore, savedCards, options = {}) {
    const store = normalizeStore(rawStore);
    const sort = options.sort || "total";
    const filter = options.filter || "all";
    const query = String(options.query || "").trim().toLowerCase();

    const rows = Object.values(store.words)
      .map((w) => {
        const card = findSavedCard(savedCards, w);
        return {
          ...w,
          occurrences: Array.isArray(w.occurrences) ? w.occurrences : [],
          saved: Boolean(card),
          mastered: Boolean(card && card.mastered)
        };
      })
      .filter((w) => {
        if (filter === "unlearned" && w.saved) return false;
        if (filter === "saved" && !w.saved) return false;
        if (filter === "mastered" && !w.mastered) return false;
        if (!query) return true;
        const occTitles = w.occurrences.map((o) => o.title || "").join(" ");
        const hay = `${w.key} ${w.surfaceSample || ""} ${w.katakana || ""} ${w.romanized || ""} ${w.meaning || ""} ${occTitles}`.toLowerCase();
        return hay.includes(query);
      });

    rows.sort((a, b) => {
      if (sort === "recent") {
        return (b.lastSeenAt || 0) - (a.lastSeenAt || 0) || (b.totalCount || 0) - (a.totalCount || 0) || (b.videoCount || 0) - (a.videoCount || 0);
      }
      if (sort === "videos") {
        return (
          (b.videoCount || 0) - (a.videoCount || 0) ||
          (b.totalCount || 0) - (a.totalCount || 0) ||
          (b.lastSeenAt || 0) - (a.lastSeenAt || 0)
        );
      }
      return (
        (b.totalCount || 0) - (a.totalCount || 0) ||
        (b.videoCount || 0) - (a.videoCount || 0) ||
        (b.lastSeenAt || 0) - (a.lastSeenAt || 0)
      );
    });
    return rows;
  }

  function toStudyCard(wordEntry, existingCard, nowMs = Date.now()) {
    const occs = Array.isArray(wordEntry && wordEntry.occurrences) ? wordEntry.occurrences : [];
    const first = occs[0] || {};
    const prev = existingCard || {};
    const prevOccs = Array.isArray(prev.occurrences) && prev.occurrences.length
      ? prev.occurrences
      : prev.sourceUrl
        ? [{ videoId: "", title: prev.sourceTitle || "YouTube", sec: prev.timestampSec || 0, url: prev.sourceUrl }]
        : [];
    const mergedOccs = mergeOccurrences(prevOccs, occs);
    const key = String((wordEntry && wordEntry.key) || (prev && prev.surface) || "").trim();
    return {
      id: prev.id || `card-${key}`,
      surface: key,
      lemma: (wordEntry && wordEntry.lemma) || prev.lemma || key,
      pos: (wordEntry && wordEntry.pos) || prev.pos || "語句",
      meaning: prev.meaning || (wordEntry && wordEntry.meaning) || "",
      endingLabel: prev.endingLabel || "",
      endingMeaning: prev.endingMeaning || "",
      pronouncedHangul: (wordEntry && wordEntry.pronouncedHangul) || prev.pronouncedHangul || key,
      katakana: (wordEntry && wordEntry.katakana) || prev.katakana || "",
      romanized: (wordEntry && wordEntry.romanized) || prev.romanized || "",
      appliedRules: prev.appliedRules || [],
      context: prev.context || first.context || key,
      jaContext: prev.jaContext || first.jaContext || "",
      sourceTitle: prev.sourceTitle || first.title || "YouTube",
      sourceUrl: prev.sourceUrl || first.url || "",
      timestampSec: prev.timestampSec !== undefined ? prev.timestampSec : (first.sec || 0),
      occurrences: mergedOccs,
      reps: prev.reps || 0,
      intervalDays: prev.intervalDays || 0,
      ease: prev.ease || 2.5,
      lapses: prev.lapses || 0,
      streak: prev.streak || 0,
      mastered: Boolean(prev.mastered),
      dueAt: prev.dueAt || 0,
      savedAt: prev.savedAt || nowMs
    };
  }

  function mergeOccurrences(listA, listB) {
    const out = [];
    for (const item of [...(Array.isArray(listA) ? listA : []), ...(Array.isArray(listB) ? listB : [])]) {
      if (!item || !item.url) continue;
      if (!out.some((x) => x.url === item.url)) out.push(item);
    }
    return out.slice(-MAX_OCCURRENCES_PER_WORD);
  }

  return {
    normalizeStore,
    hydrateOccurrence,
    compactForStorage,
    buildTimestampUrl,
    isKoreanContent,
    shouldRecord,
    extractKoreanTokens,
    recordVideo,
    removeVideo,
    findSavedCard,
    rankWords,
    toStudyCard,
    mergeOccurrences
  };
});

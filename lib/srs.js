(function (root, factory) {
  const hangulApi =
    typeof module === "object" && module.exports
      ? require("./hangul.js")
      : root.KLyricHangul;
  const api = factory(hangulApi);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.KLyricSRS = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function (Hangul) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MAX_INTERVAL_DAYS = 30;
  const REFRESHER_MIN_AGE_MS = 24 * 60 * 60 * 1000;

  function gradeCard(card, grade, nowMs = Date.now()) {
    const g = Math.max(1, Math.min(4, Number(grade) || 3));
    const prev = card || {};
    let reps = Number(prev.reps) || 0;
    let intervalDays = Number(prev.intervalDays) || 0;
    let ease = Number(prev.ease) || 2.5;
    let lapses = Number(prev.lapses) || 0;
    let streak = Number(prev.streak) || 0;

    if (g === 1) {
      reps = 0;
      intervalDays = 0;
      lapses += 1;
      streak = 0;
      ease = Math.max(1.3, ease - 0.2);
      return {
        ...prev,
        reps,
        intervalDays,
        ease: Number(ease.toFixed(2)),
        lapses,
        streak,
        mastered: false,
        lastGrade: g,
        lastReviewedAt: nowMs,
        dueAt: nowMs + 10 * 60 * 1000
      };
    }

    if (g === 2) {
      reps += 1;
      intervalDays = reps === 1 ? 1 : Math.max(1, Math.round(intervalDays * 1.2));
      ease = Math.max(1.3, ease - 0.14);
      streak = 0;
    } else if (g === 3) {
      reps += 1;
      if (reps === 1) intervalDays = 1;
      else if (reps === 2) intervalDays = 4;
      else intervalDays = Math.max(4, Math.round(intervalDays * ease));
      streak += 1;
    } else {
      reps += 1;
      if (reps === 1) intervalDays = 4;
      else if (reps === 2) intervalDays = 7;
      else intervalDays = Math.max(7, Math.round(intervalDays * ease * 1.3));
      ease = Math.min(3.0, ease + 0.15);
      streak += 1;
    }

    intervalDays = Math.min(MAX_INTERVAL_DAYS, intervalDays);

    return {
      ...prev,
      reps,
      intervalDays,
      ease: Number(ease.toFixed(2)),
      lapses,
      streak,
      mastered: streak >= 3 || Boolean(prev.mastered && g >= 3),
      lastGrade: g,
      lastReviewedAt: nowMs,
      dueAt: nowMs + intervalDays * DAY_MS
    };
  }

  function isDue(card, nowMs = Date.now()) {
    if (!card) return false;
    return (Number(card.dueAt) || 0) <= nowMs;
  }

  function buildStudyQueue(savedCards, vocabLog, options = {}) {
    const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
    const newLimit = options.newLimit !== undefined ? Math.max(0, Number(options.newLimit)) : 30;
    const interleaveEvery = Math.max(1, Number(options.interleaveEvery) || 4);
    const refresherMinAgeMs = options.refresherMinAgeMs !== undefined ? Math.max(0, Number(options.refresherMinAgeMs)) : REFRESHER_MIN_AGE_MS;
    const g = typeof globalThis !== "undefined" ? globalThis : self;
    const dictApi = options.dictApi || (g && g.KLyricDict) || null;
    const vocabLogApi = options.vocabLogApi || (g && g.KLyricVocabLog) || null;

    const savedList = Array.isArray(savedCards)
      ? savedCards.filter(Boolean)
      : Object.values(savedCards && typeof savedCards === "object" ? savedCards : {}).filter(Boolean);
    const savedMap = Array.isArray(savedCards)
      ? Object.fromEntries(savedList.map((c) => [c.surface, c]).filter(([k]) => k))
      : (savedCards && typeof savedCards === "object" ? savedCards : {});
    const wordsMap = (vocabLog && vocabLog.words && typeof vocabLog.words === "object") ? vocabLog.words : {};

    function lookupFreq(card) {
      if (!card) return { totalCount: 0, videoCount: 0, entry: null };
      const candidates = [card.lemma, card.surface];
      if (dictApi && typeof dictApi.analyzeToken === "function" && card.surface) {
        try {
          const a = dictApi.analyzeToken(card.surface);
          if (a && a.lemma) candidates.push(a.lemma);
        } catch (_) {}
      }
      for (const k of candidates) {
        if (k && wordsMap[k]) {
          const entry = wordsMap[k];
          return {
            totalCount: Number(entry.totalCount) || 0,
            videoCount: Number(entry.videoCount) || 0,
            entry
          };
        }
      }
      return { totalCount: 0, videoCount: 0, entry: null };
    }

    function freqTier(totalCount) {
      return totalCount > 0 ? Math.floor(Math.log2(totalCount + 1)) : 0;
    }

    // A. Due unmastered saved cards
    const activePool = savedList
      .filter((c) => !c.mastered && isDue(c, nowMs))
      .map((c) => {
        const freq = lookupFreq(c);
        const reviewKind = (Number(c.lapses) || 0) > 0
          ? "lapsed"
          : (Number(c.reps) || 0) > 0
            ? "learning"
            : "new_saved";
        return {
          ...c,
          _freqTotal: freq.totalCount,
          _freqVideos: freq.videoCount,
          _fromFreq: false,
          _reviewKind: reviewKind
        };
      });

    // B. High-frequency unlearned candidates from vocabLog
    const unlearnedWords = [];
    if (newLimit > 0) {
      for (const w of Object.values(wordsMap)) {
        if (!w || !w.key) continue;
        if (savedMap[w.key] || (w.surfaceSample && savedMap[w.surfaceSample])) continue;
        if (savedList.some((c) => c.lemma === w.key || c.surface === w.key)) continue;
        unlearnedWords.push(w);
      }
      unlearnedWords.sort((a, b) =>
        (b.totalCount || 0) - (a.totalCount || 0) ||
        (b.videoCount || 0) - (a.videoCount || 0) ||
        (b.lastSeenAt || 0) - (a.lastSeenAt || 0)
      );
    }

    const freqPool = unlearnedWords.slice(0, newLimit).map((w) => {
      let baseCard;
      if (vocabLogApi && typeof vocabLogApi.toStudyCard === "function") {
        baseCard = vocabLogApi.toStudyCard(w, null, nowMs);
      } else {
        const occs = Array.isArray(w.occurrences) ? w.occurrences : [];
        const first = occs[0] || {};
        baseCard = {
          id: `card-${w.key}`,
          surface: w.key,
          lemma: w.lemma || w.key,
          pos: w.pos || "語句",
          meaning: w.meaning || "",
          endingLabel: "",
          endingMeaning: "",
          pronouncedHangul: w.pronouncedHangul || w.key,
          katakana: w.katakana || "",
          romanized: w.romanized || "",
          appliedRules: [],
          context: first.context || w.key,
          jaContext: first.jaContext || "",
          sourceTitle: first.title || "YouTube",
          sourceUrl: first.url || "",
          timestampSec: first.sec || 0,
          occurrences: occs,
          reps: 0,
          intervalDays: 0,
          ease: 2.5,
          lapses: 0,
          streak: 0,
          mastered: false,
          dueAt: 0,
          savedAt: nowMs
        };
      }
      return {
        ...baseCard,
        _freqTotal: Number(w.totalCount) || 0,
        _freqVideos: Number(w.videoCount) || 0,
        _fromFreq: true,
        _reviewKind: "freq_new"
      };
    });

    const primaryPool = activePool.concat(freqPool);
    primaryPool.sort((a, b) => {
      const tierDiff = freqTier(b._freqTotal) - freqTier(a._freqTotal);
      if (tierDiff !== 0) return tierDiff;
      const aLapsed = (Number(a.lapses) || 0) > 0 ? 1 : 0;
      const bLapsed = (Number(b.lapses) || 0) > 0 ? 1 : 0;
      if (bLapsed !== aLapsed) return bLapsed - aLapsed;
      if (b._freqTotal !== a._freqTotal) return b._freqTotal - a._freqTotal;
      const aFrom = a._fromFreq ? 1 : 0;
      const bFrom = b._fromFreq ? 1 : 0;
      if (aFrom !== bFrom) return aFrom - bFrom;
      if (b._freqVideos !== a._freqVideos) return b._freqVideos - a._freqVideos;
      return (Number(a.dueAt) || 0) - (Number(b.dueAt) || 0);
    });

    // C. Mastered review pool (due + periodic oldest-reviewed refresher)
    const dueMastered = [];
    const refresherMastered = [];
    for (const c of savedList) {
      if (!c.mastered) continue;
      const freq = lookupFreq(c);
      if (isDue(c, nowMs)) {
        dueMastered.push({
          ...c,
          _freqTotal: freq.totalCount,
          _freqVideos: freq.videoCount,
          _fromFreq: false,
          _reviewKind: "due_mastered"
        });
      } else if (nowMs - (Number(c.lastReviewedAt) || 0) >= refresherMinAgeMs) {
        refresherMastered.push({
          ...c,
          _freqTotal: freq.totalCount,
          _freqVideos: freq.videoCount,
          _fromFreq: false,
          _reviewKind: "refresher"
        });
      }
    }
    dueMastered.sort((a, b) => (Number(a.dueAt) || 0) - (Number(b.dueAt) || 0) || b._freqTotal - a._freqTotal);
    refresherMastered.sort((a, b) => (Number(a.lastReviewedAt) || 0) - (Number(b.lastReviewedAt) || 0) || b._freqTotal - a._freqTotal);

    const refresherCap = Math.max(2, Math.ceil(primaryPool.length / interleaveEvery));
    const masteredPool = dueMastered.concat(refresherMastered.slice(0, refresherCap));

    const queue = [];
    let mIdx = 0;
    for (let i = 0; i < primaryPool.length; i++) {
      queue.push(primaryPool[i]);
      if ((i + 1) % interleaveEvery === 0 && mIdx < masteredPool.length) {
        queue.push(masteredPool[mIdx++]);
      }
    }
    while (mIdx < masteredPool.length) {
      const m = masteredPool[mIdx++];
      if (m._reviewKind === "due_mastered" || primaryPool.length === 0) {
        queue.push(m);
      }
    }

    if (!queue.length && savedList.length) {
      const fallback = savedList.map((c) => {
        const freq = lookupFreq(c);
        return {
          ...c,
          _freqTotal: freq.totalCount,
          _freqVideos: freq.videoCount,
          _fromFreq: false,
          _reviewKind: c.mastered ? "refresher" : "learning"
        };
      });
      fallback.sort((a, b) => b._freqTotal - a._freqTotal || (Number(a.dueAt) || 0) - (Number(b.dueAt) || 0));
      return fallback;
    }

    return queue;
  }

  function formatReadingAll(card) {
    if (!card) return "";
    const pron = card.pronouncedHangul || card.surface || "";
    const kana = card.katakana || "";
    const rom = card.romanized || "";
    const parts = [];
    if (pron) parts.push(`[${pron}]`);
    if (kana) parts.push(kana);
    if (rom) parts.push(rom);
    return parts.join(" · ");
  }

  function buildClozeQuestion(item, allItems, seed = 0) {
    const target = String(item?.surface || "").trim();
    const line = String(item?.context || target).trim();
    const promptLine = line.includes(target) && target
      ? line.replace(target, "(　　　)")
      : `(　　　) — ${item?.meaning || ""}`;

    const pool = (Array.isArray(allItems) ? allItems : [])
      .map((x) => String(x?.surface || "").trim())
      .filter((w) => w && w !== target);
    const uniqueDistractors = Array.from(new Set(pool));

    // Deterministic rotation when seed provided so tests are reproducible
    const distractors = [];
    for (let i = 0; i < uniqueDistractors.length && distractors.length < 3; i++) {
      distractors.push(uniqueDistractors[(i + seed) % uniqueDistractors.length]);
    }
    const fallback = ["사랑해", "괜찮아", "진짜", "오늘"];
    for (const f of fallback) {
      if (distractors.length >= 3) break;
      if (f !== target && !distractors.includes(f)) distractors.push(f);
    }

    const choices = [target, ...distractors.slice(0, 3)];
    // Deterministic shuffle by seed
    const rot = seed % choices.length;
    const ordered = choices.slice(rot).concat(choices.slice(0, rot));

    return {
      target,
      promptLine,
      jaContext: item?.jaContext || item?.meaning || "",
      choices: ordered,
      correct: target
    };
  }

  function normRoman(raw) {
    return String(raw || "").toLowerCase().replace(/[\s\-·.!?]/g, "");
  }

  function normKana(raw) {
    return String(raw || "").trim().replace(/[\s・·]/g, "");
  }

  function checkStudyAnswer(input, item) {
    const raw = String(input || "").trim();
    if (!raw || !item) return { correct: false, matchType: "empty" };

    const cleanRaw = raw.replace(/\s+/g, "");
    if (item.surface && cleanRaw === String(item.surface).replace(/\s+/g, "")) {
      return { correct: true, matchType: "surface" };
    }
    if (item.lemma && cleanRaw === String(item.lemma).replace(/\s+/g, "")) {
      return { correct: true, matchType: "lemma" };
    }
    if (item.pronouncedHangul && cleanRaw === String(item.pronouncedHangul).replace(/\s+/g, "")) {
      return { correct: true, matchType: "pronounced" };
    }
    if (item.romanized && normRoman(raw) === normRoman(item.romanized)) {
      return { correct: true, matchType: "roman" };
    }
    if (item.katakana && normKana(raw) === normKana(item.katakana)) {
      return { correct: true, matchType: "katakana" };
    }
    if (item.meaning) {
      const meanings = String(item.meaning)
        .replace(/（[^）]*）/g, "")
        .split(/[/／・、,，]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (meanings.includes(raw.toLowerCase())) {
        return { correct: true, matchType: "meaning" };
      }
    }
    return { correct: false, matchType: "mismatch" };
  }

  function exportCardsToTsv(cards) {
    const header = [
      "surface",
      "lemma",
      "pronouncedHangul",
      "katakana",
      "romanized",
      "meaning",
      "endingLabel",
      "context",
      "sourceTitle",
      "timestampSec"
    ].join("\t");
    const rows = (Array.isArray(cards) ? cards : []).map((c) =>
      [
        c.surface || "",
        c.lemma || "",
        c.pronouncedHangul || "",
        c.katakana || "",
        c.romanized || "",
        c.meaning || "",
        c.endingLabel || "",
        c.context || "",
        c.sourceTitle || "",
        String(c.timestampSec || 0)
      ]
        .map((v) => String(v).replace(/[\t\r\n]+/g, " "))
        .join("\t")
    );
    return [header, ...rows].join("\n");
  }

  function parseImportText(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return [];
    if (text.startsWith("[") || text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.cards) ? parsed.cards : [];
        return list.filter((x) => x && x.surface);
      } catch (_) {
        return [];
      }
    }
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(/\t|,/);
      if (i === 0 && cols[0].trim().toLowerCase() === "surface") continue;
      const surface = (cols[0] || "").trim();
      if (!surface) continue;
      const p = Hangul ? Hangul.phoneticizeHangul(surface) : null;
      out.push({
        id: `import-${surface}-${i}`,
        surface,
        lemma: (cols[1] || surface).trim(),
        pronouncedHangul: (cols[2] || (p ? p.pronouncedHangul : surface)).trim(),
        katakana: (cols[3] || (p ? p.katakana : "")).trim(),
        romanized: (cols[4] || (p ? p.romanized : "")).trim(),
        meaning: (cols[5] || "").trim(),
        endingLabel: (cols[6] || "").trim(),
        context: (cols[7] || surface).trim(),
        sourceTitle: (cols[8] || "インポート").trim(),
        timestampSec: Number(cols[9]) || 0,
        reps: 0,
        intervalDays: 0,
        ease: 2.5,
        lapses: 0,
        streak: 0,
        mastered: false,
        dueAt: 0
      });
    }
    return out;
  }

  return {
    MAX_INTERVAL_DAYS,
    gradeCard,
    isDue,
    buildStudyQueue,
    formatReadingAll,
    buildClozeQuestion,
    checkStudyAnswer,
    exportCardsToTsv,
    parseImportText
  };
});

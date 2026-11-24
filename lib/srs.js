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
    gradeCard,
    isDue,
    formatReadingAll,
    buildClozeQuestion,
    checkStudyAnswer,
    exportCardsToTsv,
    parseImportText
  };
});

// Kanji for Sino-Korean words, taken from the line's Japanese translation.
// A kanji word is shown over a Korean word only when it appears in the translation and every
// kanji is read as the hangul syllable under it (運命 = 운명). Guessing kanji from a dictionary
// alone gets native words wrong (사랑 has the rare hanja word 舍廊 but means 愛), so a word
// the translation does not back up stays without kanji.
(function (root, factory) {
  const api = factory(root.KLyricHanjaReadings || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KLyricHanja = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function (READINGS) {
  const BASE = 0xac00;
  const I_LIKE = new Set([2, 6, 7, 12, 17, 20]); // ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ
  const MIN_LEN = 2;
  const MAX_LEN = 4;
  // Endings of 하다 / 되다 (직진해 = 直進 + 해). A translation can put a kanji with the same
  // reading there (直進海), so they never end a word of three or more syllables.
  const VERB_TAILS = new Set(["하", "해", "했", "할", "한", "합", "함", "히", "돼", "된", "될", "됐", "되"]);

  function parts(syl) {
    const c = syl.charCodeAt(0) - BASE;
    return { l: Math.floor(c / 588), v: Math.floor((c % 588) / 28), t: c % 28 };
  }

  function build(l, v, t) {
    return String.fromCharCode(BASE + l * 588 + v * 28 + t);
  }

  // A reading plus its word-initial forms (리 -> 이, 락 -> 낙, 녀 -> 여).
  function forms(reading) {
    const out = [reading];
    const { l, v, t } = parts(reading);
    if (l === 5) out.push(build(I_LIKE.has(v) ? 11 : 2, v, t));
    if (l === 2 && I_LIKE.has(v)) out.push(build(11, v, t));
    return out;
  }

  function readsAs(kanji, syllable) {
    const r = READINGS[kanji];
    if (!r) return false;
    for (const reading of r) {
      if (forms(reading).includes(syllable)) return true;
    }
    return false;
  }

  function kanjiRuns(ja) {
    const text = String(ja || "").replace(/(.)々/g, "$1$1");
    return text.match(/[一-鿿]{2,}/g) || [];
  }

  function findKanji(syllables, runs) {
    for (const run of runs) {
      for (let i = 0; i + syllables.length <= run.length; i++) {
        let ok = true;
        for (let k = 0; k < syllables.length && ok; k++) ok = readsAs(run[i + k], syllables[k]);
        if (ok) return run.slice(i, i + syllables.length);
      }
    }
    return "";
  }

  // tokens: output of KLyricHangul.alignReading. Sets unit.hanja on matched syllables and
  // returns how many words got kanji.
  function annotate(tokens, ja) {
    const runs = kanjiRuns(ja);
    if (!runs.length) return 0;
    let found = 0;
    for (const token of tokens || []) {
      const units = token.units || [];
      let i = 0;
      while (i < units.length) {
        if (!units[i].isHangul) {
          i++;
          continue;
        }
        let end = i;
        while (end < units.length && units[end].isHangul) end++;
        // Longest match first inside this run of hangul.
        let matched = 0;
        for (let len = Math.min(MAX_LEN, end - i); len >= MIN_LEN && !matched; len--) {
          const syllables = units.slice(i, i + len).map((u) => u.surface);
          if (len >= 3 && VERB_TAILS.has(syllables[len - 1])) continue;
          const kanji = findKanji(syllables, runs);
          if (kanji) {
            for (let k = 0; k < len; k++) units[i + k].hanja = kanji[k];
            matched = len;
            found++;
          }
        }
        i += matched || 1;
      }
    }
    return found;
  }

  return { annotate, readsAs, kanjiRuns };
});

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.KLyricHangul = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  const CHOSEONG = [
    "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
    "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
  ];
  const JUNGSEONG = [
    "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ",
    "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"
  ];
  const JONGSEONG = [
    "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ",
    "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ",
    "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
  ];

  // Double coda split for liaison: [stayCoda, moveOnset]
  const LIAISON_SPLIT = {
    "ㄱ": ["", "ㄱ"],
    "ㄲ": ["", "ㄲ"],
    "ㄳ": ["ㄱ", "ㅆ"],
    "ㄴ": ["", "ㄴ"],
    "ㄵ": ["ㄴ", "ㅈ"],
    "ㄷ": ["", "ㄷ"],
    "ㄹ": ["", "ㄹ"],
    "ㄺ": ["ㄹ", "ㄱ"],
    "ㄻ": ["ㄹ", "ㅁ"],
    "ㄼ": ["ㄹ", "ㅂ"],
    "ㄽ": ["ㄹ", "ㅆ"],
    "ㄾ": ["ㄹ", "ㅌ"],
    "ㄿ": ["ㄹ", "ㅍ"],
    "ㅁ": ["", "ㅁ"],
    "ㅂ": ["", "ㅂ"],
    "ㅄ": ["ㅂ", "ㅆ"],
    "ㅅ": ["", "ㅅ"],
    "ㅆ": ["", "ㅆ"],
    "ㅈ": ["", "ㅈ"],
    "ㅊ": ["", "ㅊ"],
    "ㅋ": ["", "ㅋ"],
    "ㅌ": ["", "ㅌ"],
    "ㅍ": ["", "ㅍ"]
  };

  // Representative coda before another consonant or word end
  const CODA_REP = {
    "": "",
    "ㄱ": "ㄱ", "ㄲ": "ㄱ", "ㅋ": "ㄱ", "ㄳ": "ㄱ", "ㄺ": "ㄱ",
    "ㄴ": "ㄴ", "ㄵ": "ㄴ", "ㄶ": "ㄴ",
    "ㄷ": "ㄷ", "ㅅ": "ㄷ", "ㅆ": "ㄷ", "ㅈ": "ㄷ", "ㅊ": "ㄷ", "ㅌ": "ㄷ", "ㅎ": "ㄷ",
    "ㄹ": "ㄹ", "ㄼ": "ㄹ", "ㄽ": "ㄹ", "ㄾ": "ㄹ", "ㅀ": "ㄹ",
    "ㅁ": "ㅁ", "ㄻ": "ㅁ",
    "ㅂ": "ㅂ", "ㅍ": "ㅂ", "ㅄ": "ㅂ", "ㄿ": "ㅂ",
    "ㅇ": "ㅇ"
  };

  const TENSE_MAP = {
    "ㄱ": "ㄲ",
    "ㄷ": "ㄸ",
    "ㅂ": "ㅃ",
    "ㅅ": "ㅆ",
    "ㅈ": "ㅉ"
  };

  const ASPIRATED_MAP = {
    "ㄱ": "ㅋ",
    "ㄷ": "ㅌ",
    "ㅂ": "ㅍ",
    "ㅈ": "ㅊ"
  };

  const ROMAN_CHO = {
    "ㄱ": "g", "ㄲ": "kk", "ㄴ": "n", "ㄷ": "d", "ㄸ": "tt",
    "ㄹ": "r", "ㅁ": "m", "ㅂ": "b", "ㅃ": "pp", "ㅅ": "s",
    "ㅆ": "ss", "ㅇ": "", "ㅈ": "j", "ㅉ": "jj", "ㅊ": "ch",
    "ㅋ": "k", "ㅌ": "t", "ㅍ": "p", "ㅎ": "h"
  };

  const ROMAN_JUNG = {
    "ㅏ": "a", "ㅐ": "ae", "ㅑ": "ya", "ㅒ": "yae", "ㅓ": "eo",
    "ㅔ": "e", "ㅕ": "yeo", "ㅖ": "ye", "ㅗ": "o", "ㅘ": "wa",
    "ㅙ": "wae", "ㅚ": "oe", "ㅛ": "yo", "ㅜ": "u", "ㅝ": "wo",
    "ㅞ": "we", "ㅟ": "wi", "ㅠ": "yu", "ㅡ": "eu", "ㅢ": "ui", "ㅣ": "i"
  };

  const ROMAN_JONG = {
    "": "",
    "ㄱ": "k", "ㄲ": "k", "ㅋ": "k", "ㄳ": "k", "ㄺ": "k",
    "ㄴ": "n", "ㄵ": "n", "ㄶ": "n",
    "ㄷ": "t", "ㅅ": "t", "ㅆ": "t", "ㅈ": "t", "ㅊ": "t", "ㅌ": "t", "ㅎ": "t",
    "ㄹ": "l", "ㄼ": "l", "ㄽ": "l", "ㄾ": "l", "ㅀ": "l",
    "ㅁ": "m", "ㄻ": "m",
    "ㅂ": "p", "ㅍ": "p", "ㅄ": "p", "ㄿ": "p",
    "ㅇ": "ng"
  };

  // Katakana onset families by vowel index (21 vowels)
  // Vowels order: ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ
  const KANA_ROWS = {
    "ㅇ": ["ア", "エ", "ヤ", "イェ", "オ", "エ", "ヨ", "イェ", "オ", "ワ", "ウェ", "ウェ", "ヨ", "ウ", "ウォ", "ウェ", "ウィ", "ユ", "ウ", "ウィ", "イ"],
    "ㄱ": ["カ", "ケ", "キャ", "キェ", "コ", "ケ", "キョ", "キェ", "コ", "クァ", "クェ", "クェ", "キョ", "ク", "クォ", "クェ", "クィ", "キュ", "ク", "クィ", "キ"],
    "ㄱ_v": ["ガ", "ゲ", "ギャ", "ギェ", "ゴ", "ゲ", "ギョ", "ギェ", "ゴ", "グァ", "グェ", "グェ", "ギョ", "グ", "グォ", "グェ", "グィ", "ギュ", "グ", "グィ", "ギ"],
    "ㄴ": ["ナ", "ネ", "ニャ", "ニェ", "ノ", "ネ", "ニョ", "ニェ", "ノ", "ヌァ", "ヌェ", "ヌェ", "ニョ", "ヌ", "ヌォ", "ヌェ", "ヌィ", "ニュ", "ヌ", "ヌィ", "ニ"],
    "ㄷ": ["タ", "テ", "テャ", "ティェ", "ト", "テ", "テョ", "ティェ", "ト", "トァ", "トェ", "トェ", "チョ", "トゥ", "トォ", "トェ", "トゥィ", "テュ", "トゥ", "トゥィ", "ティ"],
    "ㄷ_v": ["ダ", "デ", "デャ", "ディェ", "ド", "デ", "デョ", "ディェ", "ド", "ドァ", "ドェ", "ドェ", "ジョ", "ドゥ", "ドォ", "ドェ", "ドゥィ", "デュ", "ドゥ", "ドゥィ", "ディ"],
    "ㄹ": ["ラ", "レ", "リャ", "リェ", "ロ", "レ", "リョ", "リェ", "ロ", "ルァ", "ルェ", "ルェ", "リョ", "ル", "ルォ", "ルェ", "ルィ", "リュ", "ル", "ルィ", "リ"],
    "ㅁ": ["マ", "メ", "ミャ", "ミェ", "モ", "メ", "ミョ", "ミェ", "モ", "ムァ", "ムェ", "ムェ", "ミョ", "ム", "ムォ", "ムェ", "ムィ", "ミュ", "ム", "ムィ", "ミ"],
    "ㅂ": ["パ", "ペ", "ピャ", "ピェ", "ポ", "ペ", "ピョ", "ピェ", "ポ", "プァ", "プェ", "プェ", "ピョ", "プ", "プォ", "プェ", "プィ", "ピュ", "プ", "プィ", "ピ"],
    "ㅂ_v": ["バ", "ベ", "ビャ", "ビェ", "ボ", "ベ", "ビョ", "ビェ", "ボ", "ブァ", "ブェ", "ブェ", "ビョ", "ブ", "ブォ", "ブェ", "ブィ", "ビュ", "ブ", "ブィ", "ビ"],
    "ㅅ": ["サ", "セ", "シャ", "シェ", "ソ", "セ", "ショ", "シェ", "ソ", "スァ", "スェ", "スェ", "ショ", "ス", "スォ", "スェ", "スィ", "シュ", "ス", "スィ", "シ"],
    "ㅈ": ["チャ", "チェ", "チャ", "チェ", "チョ", "チェ", "チョ", "チェ", "チョ", "チュァ", "チュェ", "チュェ", "チョ", "チュ", "チュォ", "チュェ", "チュィ", "チュ", "チュ", "チュィ", "チ"],
    "ㅈ_v": ["ジャ", "ジェ", "ジャ", "ジェ", "ジョ", "ジェ", "ジョ", "ジェ", "ジョ", "ジュァ", "ジュェ", "ジュェ", "ジョ", "ジュ", "ジュォ", "ジュェ", "ジュィ", "ジュ", "ジュ", "ジュィ", "ジ"],
    "ㅊ": ["チャ", "チェ", "チャ", "チェ", "チョ", "チェ", "チョ", "チェ", "チョ", "チュァ", "チュェ", "チュェ", "チョ", "チュ", "チュォ", "チュェ", "チュィ", "チュ", "チュ", "チュィ", "チ"],
    "ㅋ": ["カ", "ケ", "キャ", "キェ", "コ", "ケ", "キョ", "キェ", "コ", "クァ", "クェ", "クェ", "キョ", "ク", "クォ", "クェ", "クィ", "キュ", "ク", "クィ", "キ"],
    "ㅌ": ["タ", "テ", "テャ", "ティェ", "ト", "テ", "テョ", "ティェ", "ト", "トァ", "トェ", "トェ", "チョ", "トゥ", "トォ", "トェ", "トゥィ", "テュ", "トゥ", "トゥィ", "ティ"],
    "ㅍ": ["パ", "ペ", "ピャ", "ピェ", "ポ", "ペ", "ピョ", "ピェ", "ポ", "プァ", "プェ", "プェ", "ピョ", "プ", "プォ", "プェ", "プィ", "ピュ", "プ", "プィ", "ピ"],
    "ㅎ": ["ハ", "ヘ", "ヒャ", "ヒェ", "ホ", "ヘ", "ヒョ", "ヒェ", "ホ", "ファ", "フェ", "フェ", "ヒョ", "フ", "フォ", "フェ", "フィ", "ヒュ", "フ", "フィ", "ヒ"]
  };

  function isHangulSyllable(ch) {
    if (!ch) return false;
    const code = ch.charCodeAt(0);
    return code >= 0xac00 && code <= 0xd7a3;
  }

  function decompose(ch) {
    const code = ch.charCodeAt(0) - 0xac00;
    const choIdx = Math.floor(code / (21 * 28));
    const jungIdx = Math.floor((code % (21 * 28)) / 28);
    const jongIdx = code % 28;
    return {
      cho: CHOSEONG[choIdx],
      jung: JUNGSEONG[jungIdx],
      jong: JONGSEONG[jongIdx],
      jungIdx
    };
  }

  function compose(cho, jung, jong) {
    const ci = CHOSEONG.indexOf(cho);
    const ji = JUNGSEONG.indexOf(jung);
    const ki = JONGSEONG.indexOf(jong || "");
    if (ci < 0 || ji < 0 || ki < 0) return "";
    return String.fromCharCode(0xac00 + ci * 21 * 28 + ji * 28 + ki);
  }

  function applyPairRules(cur, next, rulesSet) {
    const c = cur.jong;
    const nCho = next.cho;
    const nJung = next.jung;

    if (!c) return;

    // 1. Palatalization (ㄷ/ㅌ/ㄾ + 이/히)
    if ((c === "ㄷ" || c === "ㅌ" || c === "ㄾ") && nJung === "ㅣ" && (nCho === "ㅇ" || nCho === "ㅎ")) {
      if (c === "ㄷ" && nCho === "ㅇ") {
        cur.jong = "";
        next.cho = "ㅈ";
      } else if (c === "ㄾ") {
        cur.jong = "ㄹ";
        next.cho = "ㅊ";
      } else {
        cur.jong = "";
        next.cho = "ㅊ";
      }
      rulesSet.add("口蓋音化");
      return;
    }

    // 2. ㅎ weakening/deletion before ㅇ (+ liaison of remaining ㄴ/ㄹ)
    if ((c === "ㅎ" || c === "ㄶ" || c === "ㅀ") && nCho === "ㅇ") {
      if (c === "ㄶ") {
        cur.jong = "";
        next.cho = "ㄴ";
      } else if (c === "ㅀ") {
        cur.jong = "";
        next.cho = "ㄹ";
      } else {
        cur.jong = "";
      }
      rulesSet.add("ㅎ弱化");
      return;
    }

    // 3. Aspiration (ㅎ + ㄱ/ㄷ/ㅂ/ㅈ or ㄱ/ㄷ/ㅂ/ㅈ + ㅎ)
    if ((c === "ㅎ" || c === "ㄶ" || c === "ㅀ") && ASPIRATED_MAP[nCho]) {
      cur.jong = c === "ㄶ" ? "ㄴ" : c === "ㅀ" ? "ㄹ" : "";
      next.cho = ASPIRATED_MAP[nCho];
      rulesSet.add("激音化");
      return;
    }
    if (nCho === "ㅎ") {
      if (c === "ㄵ") {
        cur.jong = "ㄴ";
        next.cho = "ㅊ";
        rulesSet.add("激音化");
        return;
      }
      const rep = CODA_REP[c];
      if (rep === "ㄱ" || rep === "ㄷ" || rep === "ㅂ") {
        cur.jong = (c === "ㄺ" || c === "ㄼ" || c === "ㄿ") ? "ㄹ" : "";
        next.cho = ASPIRATED_MAP[rep];
        rulesSet.add("激音化");
        return;
      }
    }

    // 4. Liaison when next onset is ㅇ
    if (nCho === "ㅇ" && LIAISON_SPLIT[c]) {
      const [stay, move] = LIAISON_SPLIT[c];
      cur.jong = stay;
      next.cho = move;
      rulesSet.add("連音化");
      return;
    }

    // 5. Liquidization (ㄴ+ㄹ / ㄹ+ㄴ -> ㄹ+ㄹ)
    if ((c === "ㄴ" && nCho === "ㄹ") || (c === "ㄹ" && nCho === "ㄴ")) {
      cur.jong = "ㄹ";
      next.cho = "ㄹ";
      rulesSet.add("流音化");
      return;
    }

    // 6. Nasalization
    const rep = CODA_REP[c];
    if (nCho === "ㄴ" || nCho === "ㅁ") {
      if (rep === "ㄱ") {
        cur.jong = "ㅇ";
        rulesSet.add("鼻音化");
        return;
      }
      if (rep === "ㄷ") {
        cur.jong = "ㄴ";
        rulesSet.add("鼻音化");
        return;
      }
      if (rep === "ㅂ") {
        cur.jong = "ㅁ";
        rulesSet.add("鼻音化");
        return;
      }
    }
    if (nCho === "ㄹ") {
      if (rep === "ㅁ" || rep === "ㅇ") {
        next.cho = "ㄴ";
        rulesSet.add("鼻音化");
        return;
      }
      if (rep === "ㄱ") {
        cur.jong = "ㅇ";
        next.cho = "ㄴ";
        rulesSet.add("鼻音化");
        return;
      }
      if (rep === "ㅂ") {
        cur.jong = "ㅁ";
        next.cho = "ㄴ";
        rulesSet.add("鼻音化");
        return;
      }
    }

    // 7. Tensification (ㄱ/ㄷ/ㅂ rep + ㄱ/ㄷ/ㅂ/ㅅ/ㅈ)
    if ((rep === "ㄱ" || rep === "ㄷ" || rep === "ㅂ") && TENSE_MAP[nCho]) {
      if (rep !== c) cur.jong = rep;
      next.cho = TENSE_MAP[nCho];
      rulesSet.add("濃音化");
      return;
    }

    // Final simplification for double coda before other consonants
    if (rep !== c && (c === "ㄳ" || c === "ㄵ" || c === "ㄺ" || c === "ㄻ" || c === "ㄼ" || c === "ㄽ" || c === "ㄾ" || c === "ㄿ" || c === "ㅄ" || c === "ㄶ" || c === "ㅀ")) {
      cur.jong = rep;
    }
  }

  function syllableToKatakana(syl, idx, prevSyl) {
    const c = syl.cho;
    const ji = syl.jungIdx;
    let baseKey = c;
    let prefix = "";

    if (c === "ㄲ" || c === "ㄸ" || c === "ㅃ" || c === "ㅆ" || c === "ㅉ") {
      const plain = { "ㄲ": "ㄱ", "ㄸ": "ㄷ", "ㅃ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ" }[c];
      baseKey = plain;
      if (idx > 0 && (!prevSyl || !prevSyl.jong || prevSyl.jong === "ㅇ" || prevSyl.jong === "ㄴ" || prevSyl.jong === "ㅁ" || prevSyl.jong === "ㄹ")) {
        prefix = "ッ";
      }
    } else if (idx > 0 && (c === "ㄱ" || c === "ㄷ" || c === "ㅂ" || c === "ㅈ")) {
      const prevJong = prevSyl ? CODA_REP[prevSyl.jong] : "";
      if (!prevJong || prevJong === "ㄴ" || prevJong === "ㅁ" || prevJong === "ㅇ" || prevJong === "ㄹ") {
        baseKey = c + "_v";
      }
    }

    const row = KANA_ROWS[baseKey] || KANA_ROWS["ㅇ"];
    let kana = prefix + row[ji];

    const coda = CODA_REP[syl.jong];
    if (coda === "ㄱ") kana += "ク";
    else if (coda === "ㄴ" || coda === "ㅇ") kana += "ン";
    else if (coda === "ㄷ") kana += "ッ";
    else if (coda === "ㄹ") kana += "ル";
    else if (coda === "ㅁ") kana += "ム";
    else if (coda === "ㅂ") kana += "プ";

    return kana;
  }

  function syllableToRoman(syl, prevSyl) {
    let cho = ROMAN_CHO[syl.cho] ?? "";
    if (syl.cho === "ㄹ" && prevSyl && CODA_REP[prevSyl.jong] === "ㄹ") {
      cho = "l";
    }
    const jung = ROMAN_JUNG[syl.jung] ?? "";
    const jong = ROMAN_JONG[syl.jong] ?? "";
    return cho + jung + jong;
  }

  function processHangulWord(word) {
    const chars = Array.from(word);
    const syls = chars.map(decompose);
    const rulesSet = new Set();

    for (let i = 0; i < syls.length - 1; i++) {
      applyPairRules(syls[i], syls[i + 1], rulesSet);
    }

    // Simplify trailing double coda at word end
    if (syls.length > 0) {
      const last = syls[syls.length - 1];
      const rep = CODA_REP[last.jong];
      if (rep !== last.jong && (last.jong === "ㄳ" || last.jong === "ㄵ" || last.jong === "ㄶ" || last.jong === "ㄺ" || last.jong === "ㄻ" || last.jong === "ㄼ" || last.jong === "ㄽ" || last.jong === "ㄾ" || last.jong === "ㄿ" || last.jong === "ㅀ" || last.jong === "ㅄ")) {
        last.jong = rep;
      }
    }

    const syllables = syls.map((s, i) => {
      const prev = i > 0 ? syls[i - 1] : null;
      return {
        surface: chars[i],
        pron: compose(s.cho, s.jung, s.jong),
        kana: syllableToKatakana(s, i, prev),
        roman: syllableToRoman(s, prev)
      };
    });
    const pronouncedHangul = syllables.map((s) => s.pron).join("");
    const katakana = syllables.map((s) => s.kana).join("");
    const romanized = syllables.map((s) => s.roman).join("-");

    return {
      surface: word,
      pronouncedHangul,
      katakana,
      romanized,
      syllables,
      appliedRules: Array.from(rulesSet)
    };
  }

  // Splits a line into words, and each word into display units that line up 1:1:
  // one unit per hangul syllable (with its pronounced form, katakana, and romanization),
  // and one unit per non-hangul run (English, numbers, punctuation) with empty readings.
  function alignReading(text) {
    return String(text || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((tok) => {
        const units = [];
        const segments = tok.match(/[가-힣]+|[^가-힣]+/g) || [tok];
        for (const seg of segments) {
          if (/^[가-힣]+$/.test(seg)) {
            for (const s of processHangulWord(seg).syllables) {
              units.push({ ...s, isHangul: true });
            }
          } else {
            units.push({ surface: seg, pron: seg, kana: "", roman: "", isHangul: false });
          }
        }
        return { surface: tok, hasHangul: units.some((u) => u.isHangul), units };
      });
  }

  function phoneticizeHangul(text) {
    const raw = String(text || "");
    // Normalize common spaced phrase aspiration like "못 해" -> handled smoothly while keeping word tokens
    const parts = raw.split(/(\s+)/);
    const wordOutputs = [];
    const rulesAll = new Set();

    const tokens = parts
      .filter((p) => p.length > 0)
      .map((part) => {
        if (/^\s+$/.test(part)) {
          return { surface: part, isSpace: true };
        }
        // Extract hangul runs inside token (keep surrounding punctuation)
        let pronHangul = "";
        let kana = "";
        let roman = "";
        let hasHangul = false;
        const segments = part.match(/[\uAC00-\uD7A3]+|[^\uAC00-\uD7A3]+/g) || [part];
        const segRules = [];

        for (const seg of segments) {
          if (/^[\uAC00-\uD7A3]+$/.test(seg)) {
            hasHangul = true;
            const res = processHangulWord(seg);
            pronHangul += res.pronouncedHangul;
            kana += res.katakana;
            roman += (roman && !roman.endsWith("-") ? "-" : "") + res.romanized;
            for (const r of res.appliedRules) {
              rulesAll.add(r);
              segRules.push(r);
            }
          } else {
            pronHangul += seg;
            if (/^[A-Za-z0-9]+$/.test(seg)) {
              kana += seg;
              roman += (roman ? " " : "") + seg;
            }
          }
        }

        const item = {
          surface: part,
          isSpace: false,
          hasHangul,
          pronouncedHangul: pronHangul,
          katakana: kana,
          romanized: roman,
          appliedRules: Array.from(new Set(segRules))
        };
        if (hasHangul) wordOutputs.push(item);
        return item;
      });

    return {
      surface: raw,
      pronouncedHangul: tokens.map((t) => (t.isSpace ? t.surface : t.pronouncedHangul)).join(""),
      katakana: wordOutputs.map((t) => t.katakana).filter(Boolean).join(" "),
      romanized: wordOutputs.map((t) => t.romanized).filter(Boolean).join(" "),
      appliedRules: Array.from(rulesAll),
      tokens
    };
  }

  function formatReading(text, mode = "hybrid") {
    const m = String(mode || "hybrid");
    if (m === "off") return "";
    const p = typeof text === "object" && text !== null && "katakana" in text ? text : phoneticizeHangul(text);
    if (!p.katakana && !p.romanized) return "";
    if (m === "katakana") return p.katakana;
    if (m === "roman") return p.romanized;
    if (m === "hangul") return `[${p.pronouncedHangul}]`;
    return `${p.katakana} · ${p.romanized}`;
  }

  function parseLrcTimestamp(tag) {
    const m = String(tag).match(/(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?/);
    if (!m) return null;
    const min = Number(m[1]);
    const sec = Number(m[2]);
    const fracRaw = m[3] || "0";
    const frac = fracRaw.length === 3 ? Number(fracRaw) / 1000 : Number(fracRaw.padEnd(2, "0")) / 100;
    return min * 60 + sec + frac;
  }

  function parseLrc(lrcText, fallbackDuration = 4.0) {
    const lines = String(lrcText || "").split(/\r?\n/);
    const entries = [];
    for (const rawLine of lines) {
      const tags = [];
      let rest = rawLine;
      const re = /^\[(\d{1,3}:\d{2}(?:[.:]\d{1,3})?)\]/;
      let match;
      while ((match = rest.match(re))) {
        const t = parseLrcTimestamp(match[1]);
        if (t !== null) tags.push(t);
        rest = rest.slice(match[0].length);
      }
      const text = rest.trim();
      if (!tags.length || !text) continue;
      for (const start of tags) {
        entries.push({ start, text });
      }
    }
    entries.sort((a, b) => a.start - b.start);
    return entries.map((e, i) => {
      const nextStart = i + 1 < entries.length ? entries[i + 1].start : e.start + fallbackDuration;
      const end = Math.max(e.start + 0.6, Math.min(nextStart, e.start + 12));
      return {
        id: i,
        start: Number(e.start.toFixed(3)),
        end: Number(end.toFixed(3)),
        ko: e.text,
        ja: ""
      };
    });
  }

  function parseYouTubeJson3(json3) {
    if (!json3 || !Array.isArray(json3.events)) return [];
    const raw = [];
    for (const ev of json3.events) {
      if (!Array.isArray(ev.segs)) continue;
      const text = ev.segs.map((s) => s.utf8 || "").join("").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const start = (ev.tStartMs || 0) / 1000;
      const dur = Math.max(0.6, (ev.dDurationMs || 2800) / 1000);
      raw.push({
        start: Number(start.toFixed(3)),
        end: Number((start + dur).toFixed(3)),
        text
      });
    }
    raw.sort((a, b) => a.start - b.start);
    return raw.map((c, i) => ({
      id: i,
      start: c.start,
      end: i + 1 < raw.length ? Math.min(c.end, Math.max(c.start + 0.5, raw[i + 1].start)) : c.end,
      text: c.text
    }));
  }

  function mergeDualSubtitles(koCues, jaCues) {
    const jaList = Array.isArray(jaCues) ? jaCues : [];
    return (Array.isArray(koCues) ? koCues : []).map((ko, idx) => {
      let bestJa = "";
      let bestOverlap = 0;
      const koText = ko.ko ?? ko.text ?? "";
      for (const ja of jaList) {
        const overlap = Math.min(ko.end, ja.end) - Math.max(ko.start, ja.start);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestJa = ja.ja ?? ja.text ?? "";
        }
      }
      if (!bestJa && jaList.length) {
        const mid = (ko.start + ko.end) / 2;
        let minDist = 2.0;
        for (const ja of jaList) {
          const jMid = (ja.start + ja.end) / 2;
          const dist = Math.abs(mid - jMid);
          if (dist < minDist) {
            minDist = dist;
            bestJa = ja.ja ?? ja.text ?? "";
          }
        }
      }
      return {
        id: idx,
        start: ko.start,
        end: ko.end,
        ko: koText,
        ja: ko.ja || bestJa
      };
    });
  }

  function applyOffset(cues, offsetSec) {
    const delta = Number(offsetSec) || 0;
    return (Array.isArray(cues) ? cues : []).map((c) => ({
      ...c,
      start: Number(Math.max(0, c.start + delta).toFixed(3)),
      end: Number(Math.max(0.5, c.end + delta).toFixed(3))
    }));
  }

  function cleanTrackQuery(rawTitle, rawChannel) {
    let title = String(rawTitle || "")
      .replace(/[\(\[\【〈《「『][^)\]\】〉》」』]*(Official|MV|M\/V|Music Video|Lyric|Audio|Performance|Stage|Live|Color Coded|4K|HD|Fancam|직캠|안무|가사|한글|발음|日本語|字幕|和訳|歌詞|カナルビ|ルビ)[^)\]\】〉》」』]*[\)\]\】〉》」』]/gi, " ")
      // Korean-name asides such as "ILLIT (아일릿)" only hurt the lyric search
      .replace(/\(\s*[가-힣\s]+\s*\)/g, " ")
      .replace(/["“”]/g, " ")
      .replace(/(?<![A-Za-z])['‘’]|['‘’](?![A-Za-z])/g, " ")
      .replace(/[‘’]/g, "'")
      .replace(/\b(Official|MV|M\/V|Music Video|Lyric Video|Lyrics|Color Coded)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const channel = String(rawChannel || "")
      .replace(/\s*-\s*Topic$/i, "")
      .replace(/\bOfficial\b/gi, "")
      .trim();
    if (!title) return channel;
    if (channel && !title.toLowerCase().includes(channel.toLowerCase()) && !title.includes(" - ")) {
      return `${channel} ${title}`;
    }
    return title;
  }

  function hasHangulText(text) {
    return /[\uAC00-\uD7A3]/.test(String(text || ""));
  }

  return {
    isHangulSyllable,
    decompose,
    compose,
    phoneticizeHangul,
    alignReading,
    formatReading,
    parseLrc,
    parseYouTubeJson3,
    mergeDualSubtitles,
    applyOffset,
    cleanTrackQuery,
    hasHangulText
  };
});

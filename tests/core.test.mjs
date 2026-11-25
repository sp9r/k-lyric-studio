import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Hangul = require("../lib/hangul.js");
const Dict = require("../lib/dictionary.js");
const SRS = require("../lib/srs.js");

test("applies 7 Korean phonological rules accurately", () => {
  const palatal = Hangul.phoneticizeHangul("같이");
  assert.equal(palatal.pronouncedHangul, "가치");
  assert.ok(palatal.appliedRules.includes("口蓋音化"));

  const hWeak = Hangul.phoneticizeHangul("좋아해");
  assert.equal(hWeak.pronouncedHangul, "조아해");
  assert.ok(hWeak.appliedRules.includes("ㅎ弱化"));

  const aspir = Hangul.phoneticizeHangul("어떡해");
  assert.equal(aspir.pronouncedHangul, "어떠캐");
  assert.ok(aspir.appliedRules.includes("激音化"));

  const nasal = Hangul.phoneticizeHangul("없는");
  assert.equal(nasal.pronouncedHangul, "엄는");
  assert.ok(nasal.appliedRules.includes("鼻音化"));

  const liquid = Hangul.phoneticizeHangul("설날");
  assert.equal(liquid.pronouncedHangul, "설랄");
  assert.ok(liquid.appliedRules.includes("流音化"));

  const tense = Hangul.phoneticizeHangul("학교");
  assert.equal(tense.pronouncedHangul, "학꾜");
  assert.ok(tense.appliedRules.includes("濃音化"));

  const liaison = Hangul.phoneticizeHangul("있으면");
  assert.equal(liaison.pronouncedHangul, "이쓰면");
  assert.ok(liaison.appliedRules.includes("連音化"));
});

test("formats katakana + romanized hybrid readings and 5 display modes", () => {
  const p = Hangul.phoneticizeHangul("설레잖아");
  assert.equal(p.pronouncedHangul, "설레자나");
  assert.equal(p.romanized, "seol-le-ja-na");
  assert.equal(p.katakana, "ソルレジャナ");

  assert.equal(Hangul.formatReading(p, "hybrid"), "ソルレジャナ · seol-le-ja-na");
  assert.equal(Hangul.formatReading(p, "katakana"), "ソルレジャナ");
  assert.equal(Hangul.formatReading(p, "roman"), "seol-le-ja-na");
  assert.equal(Hangul.formatReading(p, "hangul"), "[설레자나]");
  assert.equal(Hangul.formatReading(p, "off"), "");
});

test("parses LRC, YouTube JSON3, merges dual subtitles, and applies offset", () => {
  const lrc = "[00:38.00] 이번엔 정말 좋아해\n[00:42.50] 내 맘이 너한테 설레잖아";
  const cues = Hangul.parseLrc(lrc);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 38);
  assert.equal(cues[1].start, 42.5);

  const shifted = Hangul.applyOffset(cues, 1.5);
  assert.equal(shifted[0].start, 39.5);

  const koJson = {
    events: [{ tStartMs: 10000, dDurationMs: 3000, segs: [{ utf8: "우리 같이 가자" }] }]
  };
  const jaJson = {
    events: [{ tStartMs: 10200, dDurationMs: 2800, segs: [{ utf8: "私たち一緒に行こう" }] }]
  };
  const ko = Hangul.parseYouTubeJson3(koJson);
  const ja = Hangul.parseYouTubeJson3(jaJson);
  const merged = Hangul.mergeDualSubtitles(ko, ja);
  assert.equal(merged[0].ko, "우리 같이 가자");
  assert.equal(merged[0].ja, "私たち一緒に行こう");

  assert.equal(Hangul.cleanTrackQuery("ILLIT (아일릿) 'Magnetic' Official MV", "HYBE LABELS"), "HYBE LABELS ILLIT Magnetic");
});

test("analyzes Korean inflections, irregular stems, particles, and coverage stats", () => {
  const a1 = Dict.analyzeToken("설레잖아");
  assert.equal(a1.matched, true);
  assert.equal(a1.lemma, "설레다");
  assert.equal(a1.endingLabel, "-잖아");

  const a2 = Dict.analyzeToken("힘들었어");
  assert.equal(a2.matched, true);
  assert.equal(a2.lemma, "힘들다");
  assert.equal(a2.endingLabel, "-었어");

  const a3 = Dict.analyzeToken("고마워");
  assert.equal(a3.matched, true);
  assert.equal(a3.lemma, "고맙다");

  const a4 = Dict.analyzeToken("마음이");
  assert.equal(a4.matched, true);
  assert.equal(a4.lemma, "마음");
  assert.equal(a4.endingLabel, "-이");

  const cues = [{ ko: "설레잖아 같이 고마워" }];
  const saved = {
    "설레잖아": { surface: "설레잖아", mastered: true },
    "같이": { surface: "같이", mastered: false }
  };
  const cov = Dict.computeVocabularyStats(cues, saved);
  assert.equal(cov.total, 3);
  assert.equal(cov.known, 1);
  assert.equal(cov.learning, 1);
  assert.equal(cov.unseen, 1);
});

test("handles SM-2 SRS grading, cloze quiz, answer matching, and TSV roundtrip", () => {
  const deck = Dict.buildStarterDeck();
  assert.ok(deck.length >= 20);

  let card = { ...deck[0] };
  card = SRS.gradeCard(card, 3, 1000);
  assert.equal(card.intervalDays, 1);
  assert.equal(card.mastered, false);

  card = SRS.gradeCard(card, 3, 2000);
  assert.equal(card.intervalDays, 4);
  card = SRS.gradeCard(card, 4, 3000);
  assert.equal(card.mastered, true);

  const cloze = SRS.buildClozeQuestion(deck[0], deck, 1);
  assert.ok(cloze.promptLine.includes("(　　　)"));
  assert.equal(cloze.choices.length, 4);
  assert.ok(cloze.choices.includes(deck[0].surface));

  assert.equal(SRS.checkStudyAnswer("seol-le-ja-na", deck[0]).correct, true);
  assert.equal(SRS.checkStudyAnswer("ソルレジャナ", deck[0]).correct, true);

  const tsv = SRS.exportCardsToTsv(deck.slice(0, 3));
  const parsed = SRS.parseImportText(tsv);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].surface, deck[0].surface);
});

test("aligns readings 1:1 with each hangul syllable and leaves non-hangul runs blank", () => {
  require("../lib/aligned.js");
  const Aligned = globalThis.KLyricAligned;
  const tokens = Hangul.alignReading("같이 lub-dub 뭐지?");
  assert.equal(tokens.length, 3);
  assert.deepEqual(
    tokens[0].units.map((u) => [u.surface, u.pron, u.kana, u.roman]),
    [["같", "가", "カ", "ga"], ["이", "치", "チ", "chi"]]
  );
  assert.equal(tokens[1].hasHangul, false);
  assert.equal(tokens[1].units[0].kana, "");
  assert.deepEqual(tokens[2].units.map((u) => u.surface), ["뭐", "지", "?"]);
  // Joined per-syllable readings must equal the whole-word readings.
  const p = Hangul.phoneticizeHangul("설레잖아");
  const units = Hangul.alignReading("설레잖아")[0].units;
  assert.equal(units.map((u) => u.kana).join(""), p.katakana);
  assert.equal(units.map((u) => u.roman).join("-"), p.romanized);
  assert.deepEqual(Aligned.rowsForMode("hybrid"), ["kana", "roman"]);
  assert.deepEqual(Aligned.rowsForMode("off"), []);
  const html = Aligned.renderLine("같이", "hangul");
  assert.match(html, /kls-al-pron is-changed">치</);
});

const Act = require("../lib/activation.js");

test("activation: YouTube shows only on allowed channels / keywords", () => {
  const act = Act.normalize(null);
  const illit = { isMusic: false, videoId: "a1", title: "ILLIT (아일릿) 'SUPER ILLIT' EP.1", author: "ILLIT", channelId: "UCEpFoWeCMCo5z3EvWaz6hQQ" };
  const other = { isMusic: false, videoId: "b2", title: "料理動画", author: "誰か", channelId: "UCxxx" };
  const hybe = { isMusic: false, videoId: "c3", title: "ILLIT (아일릿) 'Magnetic' Official MV", author: "HYBE LABELS", channelId: "UC3IZKseVpdzPSBaWxBxundA" };
  assert.equal(Act.evaluate(act, illit).active, true);
  assert.equal(Act.evaluate(act, other).active, false);
  assert.equal(Act.evaluate(act, hybe).active, true, "keyword ILLIT in the title");
});

test("activation: YouTube Music shows everywhere except blocked", () => {
  const song = { isMusic: true, videoId: "m1", title: "Some song", author: "Some artist" };
  let act = Act.normalize(null);
  assert.equal(Act.evaluate(act, song).active, true);
  act = Act.blockHere(act, song, "video");
  assert.equal(Act.evaluate(act, song).active, false);
  act = Act.allowHere(act, song, "video");
  assert.equal(Act.evaluate(act, song).active, true, "allowing again removes the block");
});

test("activation: allow / block this channel on YouTube", () => {
  const vid = { isMusic: false, videoId: "z9", title: "vlog", author: "NewJeans", channelId: "UCnj" };
  let act = Act.normalize(null);
  act = Act.allowHere(act, vid, "channel");
  assert.equal(Act.evaluate(act, vid).active, true);
  assert.equal(Act.evaluate(act, { ...vid, videoId: "z10" }).active, true, "other video, same channel");
  act = Act.blockHere(act, vid, "video");
  assert.equal(Act.evaluate(act, vid).active, false, "block beats allow");
  assert.equal(Act.evaluate(act, { ...vid, videoId: "z10" }).active, true);
  act = Act.removeRule(act, "youtube", "block", 0);
  assert.equal(Act.evaluate(act, vid).active, true);
});

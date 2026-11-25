// Builds ruby-style HTML where every reading sits directly under the hangul syllable it belongs to.
// Each row (katakana, romanization, pronounced hangul) is a separate line. Kanji for Sino-Korean
// words (from KLyricHanja) sit in a row above the hangul.
(function (root, factory) {
  const api = factory(root.KLyricHangul, root.KLyricHanja);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KLyricAligned = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function (Hangul, Hanja) {
  const ROWS_BY_MODE = {
    hybrid: ["kana", "roman"],
    katakana: ["kana"],
    roman: ["roman"],
    hangul: ["pron"],
    off: []
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rowsForMode(mode) {
    return ROWS_BY_MODE[mode] || ROWS_BY_MODE.hybrid;
  }

  function renderUnit(unit, rows, hanjaRow) {
    const top = hanjaRow ? `<span class="kls-al-hanja">${unit.hanja ? escapeHtml(unit.hanja) : "&nbsp;"}</span>` : "";
    const cells = rows
      .map((row) => {
        const val = unit.isHangul ? unit[row] : "";
        const changed = row === "pron" && unit.isHangul && unit.pron !== unit.surface;
        return `<span class="kls-al-${row}${changed ? " is-changed" : ""}">${val ? escapeHtml(val) : "&nbsp;"}</span>`;
      })
      .join("");
    return `<span class="kls-al-col${unit.isHangul ? "" : " is-plain"}">${top}<span class="kls-al-ko">${escapeHtml(unit.surface)}</span>${cells}</span>`;
  }

  // Inner HTML for one word: a row of syllable columns. hanjaRow adds the kanji row (empty
  // where there is no kanji) so all words of a line keep their hangul on the same level.
  function renderWord(token, rows, hanjaRow) {
    // Words with no hangul (English lines, ad-libs) get no empty reading rows.
    const useRows = token.hasHangul ? rows : [];
    const dataWord = token.hasHangul ? ` data-word="${escapeHtml(token.surface)}"` : "";
    return `<span class="kls-al-word${token.hasHangul ? "" : " is-plain"}"${dataWord}>${token.units.map((u) => renderUnit(u, useRows, hanjaRow)).join("")}</span>`;
  }

  // Tokens of a line, with kanji filled in from the Japanese translation when wanted.
  // Returns { tokens, hanjaRow }.
  function lineTokens(text, ja, withHanja) {
    const tokens = Hangul.alignReading(text);
    const hanjaRow = Boolean(withHanja && ja && Hanja && Hanja.annotate(tokens, ja) > 0);
    return { tokens, hanjaRow };
  }

  // Whole line as non-interactive words.
  function renderLine(text, mode, opts) {
    const rows = rowsForMode(mode);
    const { tokens, hanjaRow } = lineTokens(text, opts && opts.ja, opts && opts.hanja);
    return `<span class="kls-al-line">${tokens.map((t) => renderWord(t, rows, hanjaRow)).join("")}</span>`;
  }

  return { rowsForMode, renderWord, renderLine, lineTokens, escapeHtml };
});

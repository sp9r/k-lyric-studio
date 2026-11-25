// Builds ruby-style HTML where every reading sits directly under the hangul syllable it belongs to.
// Each row (katakana, romanization, pronounced hangul) is a separate line.
(function (root, factory) {
  const api = factory(root.KLyricHangul);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KLyricAligned = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function (Hangul) {
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

  function renderUnit(unit, rows) {
    const cells = rows
      .map((row) => {
        const val = unit.isHangul ? unit[row] : "";
        const changed = row === "pron" && unit.isHangul && unit.pron !== unit.surface;
        return `<span class="kls-al-${row}${changed ? " is-changed" : ""}">${val ? escapeHtml(val) : "&nbsp;"}</span>`;
      })
      .join("");
    return `<span class="kls-al-col${unit.isHangul ? "" : " is-plain"}"><span class="kls-al-ko">${escapeHtml(unit.surface)}</span>${cells}</span>`;
  }

  // Inner HTML for one word: a row of syllable columns.
  function renderWord(token, rows) {
    // Words with no hangul (English lines, ad-libs) get no empty reading rows.
    const useRows = token.hasHangul ? rows : [];
    return `<span class="kls-al-word${token.hasHangul ? "" : " is-plain"}">${token.units.map((u) => renderUnit(u, useRows)).join("")}</span>`;
  }

  // Whole line as non-interactive words.
  function renderLine(text, mode) {
    const rows = rowsForMode(mode);
    return `<span class="kls-al-line">${Hangul.alignReading(text)
      .map((t) => renderWord(t, rows))
      .join("")}</span>`;
  }

  return { rowsForMode, renderWord, renderLine, escapeHtml };
});

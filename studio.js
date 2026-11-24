(function () {
  const Dict = window.KLyricDict;
  const SRS = window.KLyricSRS;

  function hasChromeStorage() {
    return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  }

  function storageGet(keys) {
    if (hasChromeStorage()) {
      return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
    }
    const out = {};
    for (const k of keys) {
      try {
        const v = localStorage.getItem(`kls:${k}`);
        if (v !== null) out[k] = JSON.parse(v);
      } catch (_) {}
    }
    return Promise.resolve(out);
  }

  function storageSet(obj) {
    if (hasChromeStorage()) {
      return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
    }
    for (const [k, v] of Object.entries(obj)) {
      localStorage.setItem(`kls:${k}`, JSON.stringify(v));
    }
    return Promise.resolve();
  }

  function formatSec(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function speakKo(text) {
    if (!text || typeof speechSynthesis === "undefined") return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ko-KR";
      u.rate = 0.88;
      speechSynthesis.speak(u);
    } catch (_) {}
  }

  const state = {
    tab: "card",
    savedCards: {},
    settings: { theme: "system" },
    queue: [],
    idx: 0,
    revealed: false,
    clozeIdx: 0,
    clozeAnswered: null
  };

  function buildQueue() {
    const all = Object.values(state.savedCards);
    const due = all.filter((c) => SRS.isDue(c));
    state.queue = due.length ? due : all;
    if (state.idx >= state.queue.length) state.idx = 0;
  }

  function renderStats() {
    const all = Object.values(state.savedCards);
    const total = all.length;
    const due = all.filter((c) => SRS.isDue(c)).length;
    const mastered = all.filter((c) => c.mastered).length;
    document.getElementById("studio-stats").textContent = `登録 ${total} / 復習待ち ${due} / 習得 ${mastered}`;
    const mPct = total ? Math.round((mastered / total) * 100) : 0;
    const lPct = total ? Math.max(0, 100 - mPct) : 0;
    document.getElementById("s-bar-mastered").style.width = `${mPct}%`;
    document.getElementById("s-bar-learning").style.width = `${lPct}%`;
  }

  function renderTabs() {
    document.querySelectorAll("[data-stab]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.stab === state.tab);
    });
    ["card", "cloze", "list"].forEach((t) => {
      document.getElementById(`pane-${t}`).classList.toggle("kls-hidden", state.tab !== t);
    });
  }

  function renderCardPane() {
    const item = state.queue[state.idx];
    if (!item) {
      document.getElementById("card-surface").textContent = "登録カードがありません";
      document.getElementById("card-context").textContent = "「単語一覧・管理」からスターター24語を追加するか、動画から単語を保存してください。";
      return;
    }

    document.getElementById("card-source-badge").textContent = `${item.sourceTitle || "出典"} · ${formatSec(item.timestampSec)}`;
    const vLink = document.getElementById("btn-card-video");
    if (item.sourceUrl) {
      vLink.href = item.sourceUrl;
      vLink.classList.remove("kls-hidden");
    } else {
      vLink.classList.add("kls-hidden");
    }

    document.getElementById("card-surface").textContent = item.surface;
    document.getElementById("card-context").textContent = item.context || "";
    document.getElementById("card-answer").classList.toggle("kls-hidden", !state.revealed);
    document.getElementById("card-reading").textContent = SRS.formatReadingAll(item);
    document.getElementById("card-meaning").textContent = item.meaning || "";
    document.getElementById("card-morph").textContent = `基本形: ${item.lemma || item.surface}${item.endingLabel ? ` ・ ${item.endingLabel} (${item.endingMeaning})` : ""}`;
    document.getElementById("card-ja-ctx").textContent = item.jaContext ? `文脈訳: ${item.jaContext}` : "";
  }

  function renderClozePane() {
    const all = Object.values(state.savedCards);
    if (!all.length) return;
    const item = all[state.clozeIdx % all.length];
    const q = SRS.buildClozeQuestion(item, all, state.clozeIdx);
    document.getElementById("cloze-source").textContent = `${item.sourceTitle || "出典"} · ${formatSec(item.timestampSec)}`;
    document.getElementById("cloze-prompt").textContent = q.promptLine;
    document.getElementById("cloze-ja").textContent = q.jaContext ? `訳: ${q.jaContext}` : "";

    const fb = document.getElementById("cloze-feedback");
    if (state.clozeAnswered) {
      fb.classList.remove("kls-hidden");
      const ok = state.clozeAnswered.correct;
      fb.textContent = `${ok ? "正解" : "不正解"}: ${item.surface} (${SRS.formatReadingAll(item)}) — ${item.meaning}`;
      fb.style.color = ok ? "var(--ui-success)" : "var(--ui-danger)";
    } else {
      fb.classList.add("kls-hidden");
    }

    const choicesBox = document.getElementById("cloze-choices");
    choicesBox.innerHTML = "";
    for (const ch of q.choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kls-btn";
      b.textContent = ch;
      if (state.clozeAnswered) {
        if (ch === q.correct) b.classList.add("is-active");
      }
      b.onclick = () => {
        state.clozeAnswered = { correct: ch === q.correct, chosen: ch };
        renderClozePane();
      };
      choicesBox.appendChild(b);
    }
  }

  function renderListPane() {
    const query = document.getElementById("list-search").value.trim().toLowerCase();
    const filter = document.getElementById("list-filter").value;
    const container = document.getElementById("word-list-container");
    const items = Object.values(state.savedCards).filter((c) => {
      if (filter === "due" && !SRS.isDue(c)) return false;
      if (filter === "mastered" && !c.mastered) return false;
      if (!query) return true;
      const hay = `${c.surface} ${c.lemma} ${c.katakana} ${c.romanized} ${c.meaning} ${c.sourceTitle}`.toLowerCase();
      return hay.includes(query);
    });

    container.innerHTML = "";
    if (!items.length) {
      container.innerHTML = `<div class="kls-muted">一致する単語がありません。</div>`;
      return;
    }

    for (const c of items) {
      const row = document.createElement("div");
      row.className = "kls-word-item";
      row.innerHTML = `
        <div style="display:grid;gap:3px;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong style="font-size:15px;">${c.surface}</strong>
            <span class="kls-badge">${c.lemma || c.surface}</span>
            ${c.mastered ? `<span class="kls-badge is-success">習得済み</span>` : `<span class="kls-badge is-accent">学習中</span>`}
          </div>
          <div class="kls-muted" style="color:var(--ui-accent);">${SRS.formatReadingAll(c)}</div>
          <div>${c.meaning || ""}</div>
          <div class="kls-muted">${c.sourceTitle || ""} · ${formatSec(c.timestampSec)}</div>
        </div>
        <div class="kls-seg">
          <button type="button" class="kls-btn" data-lspeak="${c.surface}">発音</button>
          <button type="button" class="kls-btn" data-ldel="${c.surface}">削除</button>
        </div>
      `;
      row.querySelector("[data-lspeak]").onclick = () => speakKo(c.surface);
      row.querySelector("[data-ldel]").onclick = async () => {
        delete state.savedCards[c.surface];
        await storageSet({ savedCards: state.savedCards });
        buildQueue();
        renderAll();
      };
      container.appendChild(row);
    }
  }

  function renderAll() {
    document.documentElement.setAttribute("data-theme", state.settings.theme || "system");
    renderStats();
    renderTabs();
    renderCardPane();
    renderClozePane();
    renderListPane();
  }

  function downloadText(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function init() {
    const res = await storageGet(["savedCards", "settings"]);
    if (res.settings) state.settings = { ...state.settings, ...res.settings };
    if (res.savedCards && Object.keys(res.savedCards).length) {
      state.savedCards = res.savedCards;
    } else {
      for (const c of Dict.buildStarterDeck()) {
        state.savedCards[c.surface] = c;
      }
      await storageSet({ savedCards: state.savedCards });
    }
    buildQueue();
    renderAll();

    document.querySelectorAll("[data-stab]").forEach((b) => {
      b.onclick = () => {
        state.tab = b.dataset.stab;
        renderAll();
      };
    });

    document.getElementById("btn-card-speak").onclick = () => {
      const item = state.queue[state.idx];
      if (item) speakKo(item.surface);
    };
    document.getElementById("btn-card-reveal").onclick = () => {
      state.revealed = !state.revealed;
      renderCardPane();
    };
    document.querySelectorAll(".grade-btn").forEach((b) => {
      b.onclick = async () => {
        const item = state.queue[state.idx];
        if (!item) return;
        const updated = SRS.gradeCard(item, Number(b.dataset.grade));
        state.savedCards[item.surface] = updated;
        await storageSet({ savedCards: state.savedCards });
        state.revealed = false;
        buildQueue();
        if (state.queue.length) state.idx = (state.idx + 1) % state.queue.length;
        renderAll();
      };
    });

    document.getElementById("btn-cloze-speak").onclick = () => {
      const all = Object.values(state.savedCards);
      const item = all[state.clozeIdx % Math.max(1, all.length)];
      if (item) speakKo(item.context || item.surface);
    };
    document.getElementById("btn-cloze-check").onclick = () => {
      const all = Object.values(state.savedCards);
      if (!all.length) return;
      const item = all[state.clozeIdx % all.length];
      const input = document.getElementById("cloze-input").value;
      const check = SRS.checkStudyAnswer(input, item);
      state.clozeAnswered = { correct: check.correct, chosen: input };
      renderClozePane();
    };
    document.getElementById("btn-cloze-next").onclick = () => {
      state.clozeIdx += 1;
      state.clozeAnswered = null;
      document.getElementById("cloze-input").value = "";
      renderClozePane();
    };

    document.getElementById("list-search").oninput = renderListPane;
    document.getElementById("list-filter").onchange = renderListPane;
    document.getElementById("btn-add-starter").onclick = async () => {
      for (const c of Dict.buildStarterDeck()) {
        if (!state.savedCards[c.surface]) state.savedCards[c.surface] = c;
      }
      await storageSet({ savedCards: state.savedCards });
      buildQueue();
      renderAll();
    };
    document.getElementById("btn-export-json").onclick = () => {
      downloadText("k-lyric-studio-cards.json", JSON.stringify(Object.values(state.savedCards), null, 2), "application/json");
    };
    document.getElementById("btn-export-tsv").onclick = () => {
      downloadText("k-lyric-studio-cards.tsv", SRS.exportCardsToTsv(Object.values(state.savedCards)), "text/tab-separated-values");
    };
    document.getElementById("btn-import-run").onclick = async () => {
      const raw = document.getElementById("import-box").value;
      const imported = SRS.parseImportText(raw);
      for (const c of imported) {
        state.savedCards[c.surface] = { ...(state.savedCards[c.surface] || {}), ...c };
      }
      await storageSet({ savedCards: state.savedCards });
      document.getElementById("import-status").textContent = `${imported.length}件を取り込みました`;
      buildQueue();
      renderAll();
    };
  }

  init();
})();

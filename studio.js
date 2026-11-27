(function () {
  const Dict = window.KLyricDict;
  const SRS = window.KLyricSRS;
  const Aligned = window.KLyricAligned;
  const VocabLog = window.KLyricVocabLog;
  const PLAY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;

  function esc(s) {
    return Aligned ? Aligned.escapeHtml(s) : String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

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
    vocabLog: VocabLog ? VocabLog.normalizeStore(null) : { version: 1, videos: {}, words: {} },
    settings: { theme: "system" },
    queue: [],
    idx: 0,
    revealed: false,
    clozeIdx: 0,
    clozeAnswered: null,
    freqMessage: ""
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
    ["card", "cloze", "list", "freq"].forEach((t) => {
      document.getElementById(`pane-${t}`).classList.toggle("kls-hidden", state.tab !== t);
    });
  }

  function itemOccurrences(item) {
    if (Array.isArray(item && item.occurrences) && item.occurrences.length) {
      return item.occurrences.filter((o) => o && o.url);
    }
    if (item && item.sourceUrl) {
      return [{
        videoId: "",
        title: item.sourceTitle || "YouTube",
        sec: item.timestampSec || 0,
        url: item.sourceUrl
      }];
    }
    return [];
  }

  function renderOccurrencesHtml(occs, limit = 3) {
    if (!occs.length) return "";
    const makeLink = (o) => {
      const title = esc(o.title || "YouTube");
      const ts = formatSec(o.sec);
      const tip = o.context ? `${title} (${ts}) — ${esc(o.context)}` : `${title} (${ts})`;
      return `<a class="kls-occ-link" href="${esc(o.url)}" target="_blank" rel="noopener" title="${tip}">${PLAY_ICON}<span class="kls-occ-title">${title}</span><span class="kls-occ-time">${ts}</span></a>`;
    };
    const head = occs.slice(0, limit).map(makeLink).join("");
    const rest = occs.slice(limit);
    const tail = rest.length
      ? `<details class="kls-occ-more"><summary>ほか ${rest.length}件の動画・タイムスタンプを選んで飛ぶ</summary><div class="kls-occ-wrap">${rest.map(makeLink).join("")}</div></details>`
      : "";
    return `<div class="kls-occ-wrap">${head}</div>${tail}`;
  }

  function renderCardPane() {
    const item = state.queue[state.idx];
    const occBox = document.getElementById("card-occurrences");
    const vLink = document.getElementById("btn-card-video");
    if (!item) {
      document.getElementById("card-source-badge").textContent = "出典なし";
      vLink.classList.add("kls-hidden");
      document.getElementById("card-surface").textContent = "登録カードがありません";
      document.getElementById("card-context").textContent = "「単語一覧・管理」からスターター24語を追加するか、動画から単語を保存してください。";
      document.getElementById("card-answer").classList.add("kls-hidden");
      if (occBox) occBox.innerHTML = "";
      return;
    }

    const occs = itemOccurrences(item);
    document.getElementById("card-source-badge").textContent = `${item.sourceTitle || "出典"} · ${formatSec(item.timestampSec)}`;
    const primary = occs[0];
    if (primary && primary.url) {
      vLink.href = primary.url;
      vLink.querySelector("span").textContent = `${primary.title || "動画"} (${formatSec(primary.sec)})`;
      vLink.classList.remove("kls-hidden");
    } else {
      vLink.classList.add("kls-hidden");
    }
    if (occBox) {
      occBox.innerHTML = occs.length > 1 ? renderOccurrencesHtml(occs, 4) : "";
    }

    document.getElementById("card-surface").textContent = item.surface;
    document.getElementById("card-context").textContent = item.context || "";
    document.getElementById("card-answer").classList.toggle("kls-hidden", !state.revealed);
    renderAlignedReading(document.getElementById("card-reading"), item);
    document.getElementById("card-meaning").textContent = item.meaning || "";
    document.getElementById("card-morph").textContent = `基本形: ${item.lemma || item.surface}${item.endingLabel ? ` ・ ${item.endingLabel} (${item.endingMeaning})` : ""}`;
    document.getElementById("card-ja-ctx").textContent = item.jaContext ? `文脈訳: ${item.jaContext}` : "";
  }

  // Pronounced hangul, katakana, and romanization on separate rows, each under its syllable.
  function alignedReadingHtml(card) {
    const Aligned = window.KLyricAligned;
    const Hangul = window.KLyricHangul;
    const token = Aligned && Hangul ? Hangul.alignReading(card.surface || "")[0] : null;
    if (!token) return Aligned ? Aligned.escapeHtml(SRS.formatReadingAll(card)) : "";
    return Aligned.renderWord(token, ["pron", "kana", "roman"]);
  }

  function renderAlignedReading(el, card) {
    el.innerHTML = `<span class="kls-card-aligned">${alignedReadingHtml(card)}</span>`;
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
      const occTitles = itemOccurrences(c).map((o) => o.title || "").join(" ");
      const hay = `${c.surface} ${c.lemma} ${c.katakana} ${c.romanized} ${c.meaning} ${c.sourceTitle} ${occTitles}`.toLowerCase();
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
      const occHtml = renderOccurrencesHtml(itemOccurrences(c), 3);
      row.innerHTML = `
        <div style="display:grid;gap:3px;flex:1;min-width:220px;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong style="font-size:15px;">${esc(c.surface)}</strong>
            <span class="kls-badge">${esc(c.lemma || c.surface)}</span>
            ${c.mastered ? `<span class="kls-badge is-success">習得済み</span>` : `<span class="kls-badge is-accent">学習中</span>`}
          </div>
          <div class="kls-card-aligned">${alignedReadingHtml(c)}</div>
          <div>${esc(c.meaning || "")}</div>
          ${occHtml || `<div class="kls-muted">${esc(c.sourceTitle || "")} · ${formatSec(c.timestampSec)}</div>`}
        </div>
        <div class="kls-seg">
          <button type="button" class="kls-btn" data-lspeak="${esc(c.surface)}">発音</button>
          <button type="button" class="kls-btn" data-ldel="${esc(c.surface)}">削除</button>
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

  function renderFreqPane() {
    if (!VocabLog) return;
    const store = VocabLog.normalizeStore(state.vocabLog);
    const videoCount = Object.keys(store.videos).length;
    const allWords = VocabLog.rankWords(store, state.savedCards, { sort: "videos", filter: "all" });
    const unlearnedCount = allWords.filter((w) => !w.saved).length;
    document.getElementById("freq-summary").textContent =
      `記録動画 ${videoCount}本 / 記録単語 ${allWords.length}語 / 未登録 ${unlearnedCount}語（同一動画は重複カウントしません）`;
    document.getElementById("freq-status").textContent = state.freqMessage || "";

    const query = document.getElementById("freq-search").value;
    const sort = document.getElementById("freq-sort").value;
    const filter = document.getElementById("freq-filter").value;
    const rows = VocabLog.rankWords(store, state.savedCards, { sort, filter, query });

    const listEl = document.getElementById("freq-word-list");
    listEl.innerHTML = "";
    if (!rows.length) {
      listEl.innerHTML = `<div class="kls-muted">${allWords.length ? "条件に一致する単語がありません。" : "まだ動画からの記録がありません。YouTube（字幕ON）または YouTube Music で韓国語の動画・曲を再生すると自動でここに溜まります。"}</div>`;
    } else {
      for (const w of rows.slice(0, 200)) {
        const cardLike = { surface: w.key };
        const statusBadge = w.mastered
          ? `<span class="kls-badge is-success">習得済み</span>`
          : w.saved
            ? `<span class="kls-badge is-accent">覚えるリスト登録済み</span>`
            : `<span class="kls-badge">未登録</span>`;
        const row = document.createElement("div");
        row.className = "kls-word-item";
        row.innerHTML = `
          <div style="display:grid;gap:4px;flex:1;min-width:240px;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <strong style="font-size:15px;" lang="ko">${esc(w.key)}</strong>
              <span class="kls-badge is-accent">${w.videoCount}動画 · ${w.totalCount}回</span>
              ${w.pos ? `<span class="kls-badge">${esc(w.pos)}</span>` : ""}
              ${statusBadge}
            </div>
            <div class="kls-card-aligned">${alignedReadingHtml(cardLike)}</div>
            <div>${w.meaning ? esc(w.meaning) : `<span class="kls-muted">意味未登録（「未訳の単語を訳す」で補完可）</span>`}</div>
            ${renderOccurrencesHtml(w.occurrences, 3)}
          </div>
          <div class="kls-seg">
            <button type="button" class="kls-btn" data-fspeak="${esc(w.key)}">発音</button>
            <button type="button" class="kls-btn${w.saved ? "" : " is-primary"}" data-fadd="${esc(w.key)}" ${w.saved ? "disabled" : ""}>${w.saved ? "登録済み" : "覚えるリストへ追加"}</button>
          </div>
        `;
        row.querySelector("[data-fspeak]").onclick = () => speakKo(w.key);
        const addBtn = row.querySelector("[data-fadd]");
        if (addBtn && !w.saved) {
          addBtn.onclick = async () => {
            state.savedCards[w.key] = VocabLog.toStudyCard(w, state.savedCards[w.key]);
            await storageSet({ savedCards: state.savedCards });
            state.freqMessage = `「${w.key}」を覚えるリストに追加しました`;
            buildQueue();
            renderAll();
          };
        }
        listEl.appendChild(row);
      }
    }

    const vListEl = document.getElementById("freq-video-list");
    const videos = Object.values(store.videos).sort((a, b) => (b.recordedAt || 0) - (a.recordedAt || 0));
    vListEl.innerHTML = "";
    if (!videos.length) {
      vListEl.innerHTML = `<div class="kls-muted">記録済み動画はまだありません。</div>`;
    } else {
      for (const v of videos) {
        const vRow = document.createElement("div");
        vRow.className = "kls-word-item";
        const vUrl = VocabLog.buildTimestampUrl(v.videoId, 0, v.site === "music");
        vRow.innerHTML = `
          <div style="display:grid;gap:2px;flex:1;min-width:200px;">
            <a class="kls-occ-link" href="${esc(vUrl)}" target="_blank" rel="noopener">${PLAY_ICON}<span class="kls-occ-title">${esc(v.title || v.videoId)}</span></a>
            <div class="kls-muted">${v.site === "music" ? "YouTube Music" : "YouTube"} · 記録語数 ${v.uniqueWords || 0}語</div>
          </div>
          <button type="button" class="kls-btn" data-fdelvid="${esc(v.videoId)}">記録を消す</button>
        `;
        vRow.querySelector("[data-fdelvid]").onclick = async () => {
          const next = VocabLog.removeVideo(state.vocabLog, v.videoId);
          if (next.removed) {
            state.vocabLog = next.store;
            await storageSet({ vocabLog: state.vocabLog });
            state.freqMessage = `「${v.title || v.videoId}」の記録を削除しました`;
            renderAll();
          }
        };
        vListEl.appendChild(vRow);
      }
    }
  }

  function renderAll() {
    document.documentElement.setAttribute("data-theme", state.settings.theme || "system");
    renderStats();
    renderTabs();
    renderCardPane();
    renderClozePane();
    renderListPane();
    renderFreqPane();
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

  async function translateMissingFreqWords() {
    if (!VocabLog || typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      state.freqMessage = "拡張機能環境で実行すると未訳の単語を一括翻訳できます";
      renderFreqPane();
      return;
    }
    const store = VocabLog.normalizeStore(state.vocabLog);
    const targets = VocabLog.rankWords(store, state.savedCards, { sort: "videos", filter: "all" })
      .filter((w) => !w.meaning)
      .slice(0, 60);
    if (!targets.length) {
      state.freqMessage = "未訳の単語はありません";
      renderFreqPane();
      return;
    }
    const resp = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "kls:translate", lines: targets.map((w) => w.key) }, (r) => resolve(r || { ok: false }));
    });
    if (!resp || !resp.ok || !Array.isArray(resp.lines)) {
      state.freqMessage = "翻訳の取得に失敗しました";
      renderFreqPane();
      return;
    }
    let updated = 0;
    targets.forEach((w, idx) => {
      const tr = String(resp.lines[idx] || "").trim();
      if (tr && store.words[w.key]) {
        store.words[w.key].meaning = tr;
        if (state.savedCards[w.key] && !state.savedCards[w.key].meaning) {
          state.savedCards[w.key].meaning = tr;
        }
        updated += 1;
      }
    });
    state.vocabLog = store;
    await storageSet({ vocabLog: store, savedCards: state.savedCards });
    state.freqMessage = `${updated}語の意味を補完しました`;
    renderAll();
  }

  function tabFromHash() {
    const h = String(location.hash || "").replace(/^#/, "").trim();
    return ["card", "cloze", "list", "freq"].includes(h) ? h : "";
  }

  async function init() {
    const res = await storageGet(["savedCards", "vocabLog", "settings"]);
    if (res.settings) state.settings = { ...state.settings, ...res.settings };
    if (VocabLog) state.vocabLog = VocabLog.normalizeStore(res.vocabLog);
    if (res.savedCards && Object.keys(res.savedCards).length) {
      state.savedCards = res.savedCards;
    } else {
      for (const c of Dict.buildStarterDeck()) {
        state.savedCards[c.surface] = c;
      }
      await storageSet({ savedCards: state.savedCards });
    }
    const hashTab = tabFromHash();
    if (hashTab) state.tab = hashTab;
    buildQueue();
    renderAll();

    window.addEventListener("hashchange", () => {
      const next = tabFromHash();
      if (next && next !== state.tab) {
        state.tab = next;
        renderAll();
      }
    });

    document.getElementById("freq-search").oninput = renderFreqPane;
    document.getElementById("freq-sort").onchange = renderFreqPane;
    document.getElementById("freq-filter").onchange = renderFreqPane;
    document.getElementById("btn-freq-add10").onclick = async () => {
      if (!VocabLog) return;
      const topUnlearned = VocabLog.rankWords(state.vocabLog, state.savedCards, { sort: "videos", filter: "unlearned" }).slice(0, 10);
      for (const w of topUnlearned) {
        state.savedCards[w.key] = VocabLog.toStudyCard(w, state.savedCards[w.key]);
      }
      await storageSet({ savedCards: state.savedCards });
      state.freqMessage = topUnlearned.length
        ? `頻出上位${topUnlearned.length}語を覚えるリストに追加しました`
        : "追加できる未登録の単語がありません";
      buildQueue();
      renderAll();
    };
    document.getElementById("btn-freq-translate").onclick = translateMissingFreqWords;

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

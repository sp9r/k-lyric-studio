(function () {
  const Dict = window.KLyricDict;
  const SRS = window.KLyricSRS;
  const Aligned = window.KLyricAligned;
  const VocabLog = window.KLyricVocabLog;

  const PLAY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
  const SPEAK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>`;
  const PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  const TAB_TITLES = {
    card: "単語カード",
    cloze: "穴埋めクイズ",
    list: "単語一覧・管理",
    freq: "頻出単語帳"
  };

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
      return new Promise((resolve) => {
        chrome.storage.local.set(obj, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn("[K-Lyric] storage.set:", chrome.runtime.lastError.message);
          }
          resolve();
        });
      });
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

  const meaningInFlight = new Set();

  function lookupFreqTotal(card) {
    const wordsMap = state.vocabLog && state.vocabLog.words;
    if (!wordsMap || !card) return 0;
    const candidates = [card.lemma, card.surface];
    if (Dict && typeof Dict.analyzeToken === "function" && card.surface) {
      const a = Dict.analyzeToken(card.surface);
      if (a && a.lemma) candidates.push(a.lemma);
    }
    for (const k of candidates) {
      if (k && wordsMap[k]) return Number(wordsMap[k].totalCount) || 0;
    }
    return 0;
  }

  function stripQueueMeta(card) {
    if (!card || typeof card !== "object") return card;
    const { _fromFreq, _reviewKind, _freqTotal, _freqVideos, ...clean } = card;
    return clean;
  }

  function reviewBadgeInfo(item) {
    if (!item) return { label: "", tone: "is-accent" };
    const kind = item._reviewKind;
    let base = "学習中";
    let tone = "is-accent";
    if (kind === "due_mastered") {
      base = "復習（習得済み）";
      tone = "is-success";
    } else if (kind === "refresher") {
      base = "定着チェック（習得済み）";
      tone = "is-success";
    } else if (kind === "lapsed") {
      base = "再復習";
      tone = "is-danger";
    } else if (kind === "freq_new") {
      base = "頻出候補";
      tone = "is-warn";
    }
    const freq = Number(item._freqTotal) || lookupFreqTotal(item);
    return {
      label: freq > 0 ? `${base} · 計 ${freq}回` : base,
      tone
    };
  }

  function ensureCardMeaning(item) {
    if (!item || item.meaning) return;
    const q = item.lemma || item.surface;
    if (!q) return;
    if (Dict && typeof Dict.analyzeToken === "function") {
      const a = Dict.analyzeToken(q);
      if (a && a.matched !== false && a.meaning) {
        item.meaning = a.meaning;
        const mEl = document.getElementById("card-meaning");
        if (mEl && state.queue[state.idx] && state.queue[state.idx].surface === item.surface) {
          mEl.textContent = a.meaning;
        }
        return;
      }
    }
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
    if (meaningInFlight.has(item.surface)) return;
    meaningInFlight.add(item.surface);
    chrome.runtime.sendMessage({ type: "kls:translate", lines: [q] }, async (res) => {
      meaningInFlight.delete(item.surface);
      const tr = res && res.ok && Array.isArray(res.lines) ? String(res.lines[0] || "").trim() : "";
      if (!tr) return;
      item.meaning = tr;
      if (state.savedCards[item.surface] && !state.savedCards[item.surface].meaning) {
        state.savedCards[item.surface].meaning = tr;
      }
      if (state.vocabLog && state.vocabLog.words && state.vocabLog.words[q] && !state.vocabLog.words[q].meaning) {
        state.vocabLog.words[q].meaning = tr;
      }
      const mEl = document.getElementById("card-meaning");
      if (mEl && state.queue[state.idx] && state.queue[state.idx].surface === item.surface) {
        mEl.textContent = tr;
      }
    });
  }

  function buildQueue() {
    if (SRS && typeof SRS.buildStudyQueue === "function") {
      state.queue = SRS.buildStudyQueue(state.savedCards, state.vocabLog, {
        dictApi: Dict,
        vocabLogApi: VocabLog
      });
    } else {
      const all = Object.values(state.savedCards);
      const due = all.filter((c) => SRS.isDue(c));
      state.queue = due.length ? due : all;
    }
    if (state.idx >= state.queue.length) state.idx = 0;
  }

  function renderStats() {
    const all = Object.values(state.savedCards);
    const total = all.length;
    const due = all.filter((c) => SRS.isDue(c)).length;
    const mastered = all.filter((c) => c.mastered).length;
    const learning = total - mastered;
    const seenOnly = VocabLog
      ? VocabLog.rankWords(state.vocabLog, state.savedCards, { sort: "total", filter: "unlearned" }).length
      : 0;
    const freqTotal = VocabLog ? Object.keys((state.vocabLog && state.vocabLog.words) || {}).length : 0;

    document.getElementById("studio-stats").textContent = `既知 ${mastered} / 学習中 ${learning} / 既出 ${seenOnly}語（復習待ち ${due}）`;
    document.getElementById("metric-due").textContent = `${due}`;
    document.getElementById("metric-learning").textContent = `${learning}`;
    document.getElementById("metric-mastered").textContent = `${mastered}`;
    document.getElementById("metric-seen").textContent = `${seenOnly}`;

    const navDue = document.getElementById("nav-due-count");
    const navFreq = document.getElementById("nav-freq-count");
    const navList = document.getElementById("nav-list-count");
    if (navDue) navDue.textContent = `${due}`;
    if (navFreq) navFreq.textContent = `${freqTotal}`;
    if (navList) navList.textContent = `${total}`;

    const denom = mastered + learning + seenOnly;
    const mPct = denom ? Math.round((mastered / denom) * 100) : 0;
    const lPct = denom ? Math.round((learning / denom) * 100) : 0;
    const sPct = denom ? Math.max(0, 100 - mPct - lPct) : 0;
    document.getElementById("s-bar-mastered").style.width = `${mPct}%`;
    document.getElementById("s-bar-learning").style.width = `${lPct}%`;
    const seenBar = document.getElementById("s-bar-seen");
    if (seenBar) seenBar.style.width = `${sPct}%`;
  }

  let lastRenderedTab = null;
  function renderTabs() {
    if (lastRenderedTab !== state.tab) closeEmbeds();
    lastRenderedTab = state.tab;
    document.querySelectorAll("[data-stab]").forEach((b) => {
      const active = b.dataset.stab === state.tab;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-current", active ? "page" : "false");
    });
    document.querySelectorAll("[data-mob-tab]").forEach((b) => {
      const active = b.dataset.mobTab === state.tab;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-current", active ? "page" : "false");
    });
    const topTitle = document.getElementById("topbar-title");
    if (topTitle) topTitle.textContent = TAB_TITLES[state.tab] || "単語カード";
    ["card", "cloze", "list", "freq"].forEach((t) => {
      document.getElementById(`pane-${t}`).classList.toggle("kls-hidden", state.tab !== t);
    });
  }

  function itemOccurrences(item) {
    if (!item) return [];
    const cardOccs = Array.isArray(item.occurrences) && item.occurrences.length
      ? item.occurrences.filter((o) => o && o.url)
      : item.sourceUrl
        ? [{
            videoId: "",
            title: item.sourceTitle || "YouTube",
            sec: item.timestampSec || 0,
            url: item.sourceUrl
          }]
        : [];

    const wordsMap = state.vocabLog && state.vocabLog.words;
    let logOccs = [];
    if (wordsMap) {
      const candidates = [item.lemma, item.surface];
      if (Dict && item.surface) {
        const clean = Dict.cleanHangulWord ? Dict.cleanHangulWord(item.surface) : "";
        const analyzed = Dict.analyzeToken ? Dict.analyzeToken(item.surface) : null;
        if (analyzed && analyzed.lemma) candidates.push(analyzed.lemma);
        if (clean) candidates.push(clean);
      }
      for (const k of candidates) {
        if (k && wordsMap[k] && Array.isArray(wordsMap[k].occurrences) && wordsMap[k].occurrences.length) {
          logOccs = wordsMap[k].occurrences.map((o) =>
            VocabLog && typeof VocabLog.hydrateOccurrence === "function"
              ? VocabLog.hydrateOccurrence(o, state.vocabLog.videos)
              : o
          );
          break;
        }
      }
    }

    if (VocabLog && typeof VocabLog.mergeOccurrences === "function") {
      return VocabLog.mergeOccurrences(cardOccs, logOccs);
    }
    return cardOccs.length ? cardOccs : logOccs;
  }

  function occVideoId(o) {
    if (!o) return "";
    return String(o.videoId || (VocabLog && VocabLog.parseVideoId ? VocabLog.parseVideoId(o.url) : "") || "").trim();
  }

  // Source links open an inline player (see toggleEmbed); href stays as a plain-link fallback.
  function occLinkHtml(o, extraClass = "") {
    const title = esc(o.title || "YouTube");
    const ts = formatSec(o.sec);
    const tip = o.context ? `${title} (${ts}) — ${esc(o.context)}` : `${title} (${ts})`;
    const vid = occVideoId(o);
    const attrs = vid ? ` data-embed-vid="${esc(vid)}" data-embed-sec="${Math.max(0, Math.floor(Number(o.sec) || 0))}" data-embed-url="${esc(o.url)}"` : "";
    return `<a class="kls-occ-link${extraClass}" href="${esc(o.url)}"${attrs} title="${tip}">${PLAY_ICON}<span class="kls-occ-title">${title}</span><span class="kls-occ-time">${ts}</span></a>`;
  }

  function renderOccurrencesHtml(occs, limit = 3) {
    if (!occs.length) return "";
    const head = occs.slice(0, limit).map((o) => occLinkHtml(o)).join("");
    const rest = occs.slice(limit);
    const tail = rest.length
      ? `<details class="kls-occ-more"><summary>ほか ${rest.length}件の動画・タイムスタンプを選んで再生</summary><div class="kls-occ-wrap">${rest.map((o) => occLinkHtml(o)).join("")}</div></details>`
      : "";
    return `<div class="kls-occ-wrap">${head}</div>${tail}`;
  }

  function highlightWord(text, surface) {
    const t = String(text || "");
    const w = String(surface || "");
    const idx = w ? t.indexOf(w) : -1;
    if (idx < 0) return esc(t);
    return `${esc(t.slice(0, idx))}<mark>${esc(w)}</mark>${esc(t.slice(idx + w.length))}`;
  }

  // Example sentences = real lines the word appeared in. YouTube Music first, max `limit`.
  function renderExamplesHtml(occs, limit = 3, fallback) {
    if (!VocabLog || !VocabLog.pickExamples) return "";
    let list = occs;
    if (fallback && fallback.context && !occs.some((o) => o && o.context) && occs[0]) {
      list = [{ ...occs[0], context: fallback.context, jaContext: fallback.jaContext || "", surface: fallback.surface }].concat(occs);
    }
    const ex = VocabLog.pickExamples(list, limit);
    if (!ex.items.length) return "";
    const items = ex.items.map((o) => `
      <li class="kls-ex-item">
        <div class="kls-ex-ko" lang="ko">${highlightWord(o.context, o.surface || (fallback && fallback.surface))}</div>
        ${o.jaContext ? `<div class="kls-ex-ja" lang="ja">${esc(o.jaContext)}</div>` : ""}
        <div class="kls-ex-src">${o.isMusic ? `<span class="kls-ex-tag">Music</span>` : ""}${occLinkHtml(o)}</div>
      </li>`).join("");
    const more = ex.more ? `<div class="kls-ex-more">他${ex.more}件</div>` : "";
    return `<div class="kls-source-label">例文${ex.items.some((o) => o.isMusic) ? "（YouTube Music優先）" : ""}</div><ul class="kls-ex-list">${items}</ul>${more}`;
  }

  // ---- inline player (one at a time, hidden until a source is clicked) ----
  // Re-render only when the markup changed, so an open player is not reloaded by unrelated redraws.
  function setHtml(el, html) {
    if (el.dataset.lastHtml === html) return;
    el.dataset.lastHtml = html;
    el.innerHTML = html;
  }

  function closeEmbeds() {
    document.querySelectorAll(".kls-embed").forEach((el) => el.remove());
  }

  function toggleEmbed(trigger, anchor) {
    const vid = trigger.dataset.embedVid;
    const sec = Number(trigger.dataset.embedSec) || 0;
    if (!vid || !VocabLog || !VocabLog.buildEmbedUrl) return false;
    const key = `${vid}@${sec}`;
    const existing = document.querySelector(".kls-embed");
    const sameAnchor = existing && existing.dataset.embedKey === key && existing.previousElementSibling === anchor;
    closeEmbeds();
    if (sameAnchor) return true;
    const watchUrl = trigger.dataset.embedUrl || (VocabLog.buildTimestampUrl ? VocabLog.buildTimestampUrl(vid, sec, false) : "");
    const box = document.createElement("div");
    box.className = "kls-embed";
    box.dataset.embedKey = key;
    box.innerHTML = `
      <div class="kls-embed-frame"><iframe src="${esc(VocabLog.buildEmbedUrl(vid, sec))}" title="出典の動画（${esc(formatSec(sec))}）" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
      <div class="kls-embed-bar">
        <a class="kls-embed-alt" href="${esc(watchUrl)}" target="_blank" rel="noopener">YouTubeで開く</a>
        <button type="button" class="kls-btn kls-embed-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span>閉じる</span></button>
      </div>`;
    box.querySelector(".kls-embed-close").onclick = () => box.remove();
    anchor.insertAdjacentElement("afterend", box);
    return true;
  }

  function embedAnchorFor(trigger) {
    if (trigger.dataset.embedAnchor) {
      const t = document.getElementById(trigger.dataset.embedAnchor);
      if (t) return t.lastElementChild || t;
    }
    return trigger.closest(".kls-ex-src") || trigger.closest(".kls-occ-wrap") || trigger;
  }

  document.addEventListener("click", (ev) => {
    const trigger = ev.target.closest && ev.target.closest("[data-embed-vid]");
    if (!trigger || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    if (toggleEmbed(trigger, embedAnchorFor(trigger))) ev.preventDefault();
  });

  function setVideoButton(btn, primary) {
    if (!btn) return;
    if (primary && primary.url) {
      btn.href = primary.url;
      const vid = occVideoId(primary);
      if (vid) {
        btn.dataset.embedVid = vid;
        btn.dataset.embedSec = String(Math.max(0, Math.floor(Number(primary.sec) || 0)));
        btn.dataset.embedUrl = primary.url;
      } else {
        delete btn.dataset.embedVid;
      }
      btn.querySelector("span").textContent = `該当部分を再生 (${formatSec(primary.sec)})`;
      btn.classList.remove("kls-hidden");
    } else {
      btn.classList.add("kls-hidden");
    }
  }

  function renderCardPane() {
    const item = state.queue[state.idx];
    const occBox = document.getElementById("card-occurrences");
    const vLink = document.getElementById("btn-card-video");
    const metaBadge = document.getElementById("card-meta-badge");
    const revealBtn = document.getElementById("btn-card-reveal");
    const easyBtn = document.querySelector('.grade-btn[data-grade="4"]');

    if (revealBtn) {
      revealBtn.classList.toggle("is-primary", !state.revealed);
      const lbl = revealBtn.querySelector("span");
      if (lbl) lbl.textContent = state.revealed ? "答えを隠す" : "答えを見る";
    }
    if (easyBtn) {
      easyBtn.classList.toggle("is-primary", state.revealed);
    }

    if (!item) {
      document.getElementById("card-source-badge").textContent = "出典なし";
      if (metaBadge) metaBadge.classList.add("kls-hidden");
      vLink.classList.add("kls-hidden");
      const exBox0 = document.getElementById("card-examples");
      if (exBox0) setHtml(exBox0, "");
      document.getElementById("card-surface").textContent = "登録カードがありません";
      document.getElementById("card-context").textContent = "「単語一覧・管理」からスターター24語を追加するか、動画から単語を保存してください。";
      document.getElementById("card-answer").classList.add("kls-hidden");
      if (occBox) setHtml(occBox, "");
      return;
    }

    if (metaBadge) {
      const info = reviewBadgeInfo(item);
      metaBadge.textContent = info.label;
      metaBadge.className = `ui-status-dot ${info.tone}`;
    }

    const occs = itemOccurrences(item);
    const primary = occs[0];
    document.getElementById("card-source-badge").textContent = occs.length > 1
      ? `出典 ${occs.length}件`
      : primary
        ? `${primary.title || "出典"} · ${formatSec(primary.sec)}`
        : (item.sourceTitle || "出典なし");
    setVideoButton(vLink, primary);
    const exBox = document.getElementById("card-examples");
    if (exBox) setHtml(exBox, renderExamplesHtml(occs, 3, { context: item.context, jaContext: item.jaContext, surface: item.surface }));
    if (occBox) {
      setHtml(occBox, occs.length
        ? `<div class="kls-source-label">出典（クリックで該当部分を再生）</div>${renderOccurrencesHtml(occs, 4)}`
        : `<div class="kls-muted">視聴動画からの出典はまだありません（動画で登場すると自動で紐付きます）</div>`);
    }

    document.getElementById("card-surface").textContent = item.surface;
    document.getElementById("card-context").textContent = item.context || "";
    document.getElementById("card-answer").classList.toggle("kls-hidden", !state.revealed);
    renderAlignedReading(document.getElementById("card-reading"), item);
    document.getElementById("card-meaning").textContent = item.meaning || "";
    if (!item.meaning) ensureCardMeaning(item);
    document.getElementById("card-morph").textContent = `基本形: ${item.lemma || item.surface}${item.endingLabel ? ` ・ ${item.endingLabel} (${item.endingMeaning})` : ""}`;
    document.getElementById("card-ja-ctx").textContent = item.jaContext ? `文脈訳: ${item.jaContext}` : "";
  }

  function alignedReadingHtml(card) {
    const token = Aligned && window.KLyricHangul ? window.KLyricHangul.alignReading(card.surface || "")[0] : null;
    if (!token) return Aligned ? Aligned.escapeHtml(SRS.formatReadingAll(card)) : "";
    return Aligned.renderWord(token, ["pron", "kana", "roman"]);
  }

  function renderAlignedReading(el, card) {
    el.innerHTML = `<span class="kls-card-aligned">${alignedReadingHtml(card)}</span>`;
  }

  function clozePool() {
    return state.queue.length ? state.queue : Object.values(state.savedCards);
  }

  function renderClozePane() {
    const pool = clozePool();
    if (!pool.length) return;
    const item = pool[state.clozeIdx % pool.length];
    const allItems = Object.values(state.savedCards).concat(state.queue);
    const q = SRS.buildClozeQuestion(item, allItems, state.clozeIdx);
    const occs = itemOccurrences(item);
    const primary = occs[0];
    document.getElementById("cloze-source").textContent = occs.length > 1
      ? `出典 ${occs.length}件`
      : primary
        ? `${primary.title || "出典"} · ${formatSec(primary.sec)}`
        : (item.sourceTitle || "穴埋めクイズ");
    const cLink = document.getElementById("btn-cloze-video");
    setVideoButton(cLink, primary);
    const cExBox = document.getElementById("cloze-examples");
    if (cExBox) {
      // Example lines would give away the blank, so they appear only after answering.
      setHtml(cExBox, state.clozeAnswered ? renderExamplesHtml(occs, 3, { context: item.context, jaContext: item.jaContext, surface: item.surface }) : "");
    }
    const cOccBox = document.getElementById("cloze-occurrences");
    if (cOccBox) {
      setHtml(cOccBox, occs.length
        ? `<div class="kls-source-label">出典（クリックで該当部分を再生）</div>${renderOccurrencesHtml(occs, 4)}`
        : "");
    }
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
    const letters = ["A", "B", "C", "D"];
    q.choices.forEach((ch, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kls-btn";
      b.style.justifyContent = "flex-start";
      b.innerHTML = `<span class="kls-choice-key">${letters[idx] || idx + 1}</span><span>${esc(ch)}</span>`;
      if (state.clozeAnswered && ch === q.correct) {
        b.classList.add("is-active");
      }
      b.onclick = () => {
        state.clozeAnswered = { correct: ch === q.correct, chosen: ch };
        renderClozePane();
      };
      choicesBox.appendChild(b);
    });
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
    items.sort((a, b) => lookupFreqTotal(b) - lookupFreqTotal(a) || (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));

    container.innerHTML = "";
    if (!items.length) {
      container.innerHTML = `<div class="kls-word-empty">一致する単語がありません。</div>`;
      return;
    }

    for (const c of items) {
      const freq = lookupFreqTotal(c);
      const row = document.createElement("div");
      row.className = "kls-word-item";
      const occHtml = renderOccurrencesHtml(itemOccurrences(c), 3);
      row.innerHTML = `
        <div style="display:grid;gap:4px;flex:1;min-width:220px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong style="font-size:15px;" lang="ko">${esc(c.surface)}</strong>
            ${c.lemma && c.lemma !== c.surface ? `<span class="kls-muted">${esc(c.lemma)}</span>` : ""}
            <span class="ui-status-dot ${c.mastered ? "is-success" : "is-accent"}">${c.mastered ? "習得済み" : "学習中"}</span>
            ${freq > 0 ? `<span class="kls-muted">計 ${freq}回</span>` : ""}
          </div>
          <div class="kls-card-aligned">${alignedReadingHtml(c)}</div>
          <div>${esc(c.meaning || "")}</div>
          ${occHtml || `<div class="kls-muted">${esc(c.sourceTitle || "")} · ${formatSec(c.timestampSec)}</div>`}
        </div>
        <div class="kls-seg">
          <button type="button" class="kls-btn" data-lspeak="${esc(c.surface)}">${SPEAK_ICON}<span>発音</span></button>
          <button type="button" class="kls-btn" data-ldel="${esc(c.surface)}">${TRASH_ICON}<span>削除</span></button>
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
    const allWords = VocabLog.rankWords(store, state.savedCards, { sort: "total", filter: "all" });
    const unlearnedCount = allWords.filter((w) => !w.saved).length;
    document.getElementById("freq-summary").textContent =
      `記録動画 ${videoCount}本 / 既出単語 ${allWords.length}語 / 未登録 ${unlearnedCount}語（同一動画は重複カウントしません）`;
    document.getElementById("freq-status").textContent = state.freqMessage || "";

    const query = document.getElementById("freq-search").value;
    const sort = document.getElementById("freq-sort").value;
    const filter = document.getElementById("freq-filter").value;
    const rows = VocabLog.rankWords(store, state.savedCards, { sort, filter, query });

    const listEl = document.getElementById("freq-word-list");
    listEl.innerHTML = "";
    if (!rows.length) {
      listEl.innerHTML = `<div class="kls-word-empty">${allWords.length ? "条件に一致する単語がありません。" : "まだ動画からの記録がありません。YouTube（字幕ON・動画の＋ボタン）または YouTube Music で韓国語の動画・曲を扱うと自動でここに溜まります。"}</div>`;
    } else {
      const shown = rows.slice(0, 200);
      const maxCount = Math.max(1, ...shown.map((r) => Number(r.totalCount) || 1));
      for (const w of shown) {
        const cardLike = { surface: w.key };
        const statusTone = w.mastered ? "is-success" : w.saved ? "is-accent" : "is-neutral";
        const statusLabel = w.mastered ? "習得済み" : w.saved ? "学習中（登録済み）" : "未登録";
        const barPct = Math.max(8, Math.round(((Number(w.totalCount) || 0) / maxCount) * 100));
        const row = document.createElement("div");
        row.className = "kls-word-item";
        row.innerHTML = `
          <div style="display:grid;gap:4px;flex:1;min-width:220px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <strong style="font-size:15px;" lang="ko">${esc(w.key)}</strong>
              <span class="ui-status-dot ${statusTone}">${statusLabel}</span>
              ${w.pos ? `<span class="kls-badge">${esc(w.pos)}</span>` : ""}
              <span class="kls-freq-meter" title="総出現 ${w.totalCount}回 / ${w.videoCount}動画">
                <span class="kls-freq-track"><span class="kls-freq-fill" style="width:${barPct}%"></span></span>
                <span>${w.totalCount}回 · ${w.videoCount}動画</span>
              </span>
            </div>
            <div class="kls-card-aligned">${alignedReadingHtml(cardLike)}</div>
            <div>${w.meaning ? esc(w.meaning) : `<span class="kls-muted">意味未登録（「未訳の単語を訳す」で補完可）</span>`}</div>
            ${renderExamplesHtml(w.occurrences || [], 3)}
            ${renderOccurrencesHtml(w.occurrences, 3)}
          </div>
          <div class="kls-seg">
            <button type="button" class="kls-btn" data-fspeak="${esc(w.key)}">${SPEAK_ICON}<span>発音</span></button>
            <button type="button" class="kls-btn${w.saved ? " is-active" : ""}" data-fadd="${esc(w.key)}" ${w.saved ? "disabled" : ""}>${w.saved ? CHECK_ICON : PLUS_ICON}<span>${w.saved ? "登録済み" : "覚えるリストへ追加"}</span></button>
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
      vListEl.innerHTML = `<div class="kls-word-empty">記録済み動画はまだありません。</div>`;
    } else {
      for (const v of videos) {
        const vRow = document.createElement("div");
        vRow.className = "kls-word-item";
        const vUrl = VocabLog.buildTimestampUrl(v.videoId, 0, v.site === "music");
        vRow.innerHTML = `
          <div style="display:grid;gap:2px;flex:1;min-width:200px;">
            <a class="kls-occ-link" href="${esc(vUrl)}" data-embed-vid="${esc(v.videoId)}" data-embed-sec="0" data-embed-url="${esc(vUrl)}">${PLAY_ICON}<span class="kls-occ-title">${esc(v.title || v.videoId)}</span></a>
            <div class="kls-muted">${v.site === "music" ? "YouTube Music" : "YouTube"} · 記録語数 ${v.uniqueWords || 0}語</div>
          </div>
          <button type="button" class="kls-btn" data-fdelvid="${esc(v.videoId)}">${TRASH_ICON}<span>記録を消す</span></button>
        `;
        vRow.querySelector("[data-fdelvid]").onclick = async () => {
          const next = VocabLog.removeVideo(state.vocabLog, v.videoId);
          if (next.removed) {
            state.vocabLog = next.store;
            const toWrite = typeof VocabLog.compactForStorage === "function" ? VocabLog.compactForStorage(state.vocabLog) : state.vocabLog;
            await storageSet({ vocabLog: toWrite });
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
    const targets = VocabLog.rankWords(store, state.savedCards, { sort: "total", filter: "all" })
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
    const toWrite = typeof VocabLog.compactForStorage === "function" ? VocabLog.compactForStorage(store) : store;
    await storageSet({ vocabLog: toWrite, savedCards: state.savedCards });
    state.freqMessage = `${updated}語の意味を補完しました`;
    renderAll();
  }

  function tabFromHash() {
    const h = String(location.hash || "").replace(/^#/, "").trim();
    return ["card", "cloze", "list", "freq"].includes(h) ? h : "";
  }

  function switchTab(next) {
    if (!["card", "cloze", "list", "freq"].includes(next)) return;
    state.tab = next;
    renderAll();
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
        switchTab(next);
      }
    });

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.vocabLog && VocabLog) {
          state.vocabLog = VocabLog.normalizeStore(changes.vocabLog.newValue);
          buildQueue();
          renderAll();
        }
        if (changes.savedCards && changes.savedCards.newValue) {
          state.savedCards = changes.savedCards.newValue;
          buildQueue();
          renderAll();
        }
      });
    }

    document.querySelectorAll("[data-jump]").forEach((btn) => {
      btn.onclick = () => {
        const target = btn.dataset.jump;
        if (target === "due") {
          switchTab("card");
        } else if (target === "learning") {
          document.getElementById("list-filter").value = "due";
          switchTab("list");
        } else if (target === "mastered") {
          document.getElementById("list-filter").value = "mastered";
          switchTab("list");
        } else if (target === "seen") {
          document.getElementById("freq-filter").value = "unlearned";
          switchTab("freq");
        }
      };
    });

    document.getElementById("freq-search").oninput = renderFreqPane;
    document.getElementById("freq-sort").onchange = renderFreqPane;
    document.getElementById("freq-filter").onchange = renderFreqPane;
    document.getElementById("btn-freq-add10").onclick = async () => {
      if (!VocabLog) return;
      const topUnlearned = VocabLog.rankWords(state.vocabLog, state.savedCards, { sort: "total", filter: "unlearned" }).slice(0, 10);
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
      b.onclick = () => switchTab(b.dataset.stab);
    });
    document.querySelectorAll("[data-mob-tab]").forEach((b) => {
      b.onclick = () => switchTab(b.dataset.mobTab);
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
        const prevSurface = item.surface;
        const cleanItem = stripQueueMeta(item);
        const updated = SRS.gradeCard(cleanItem, Number(b.dataset.grade));
        state.savedCards[updated.surface] = updated;
        await storageSet({ savedCards: state.savedCards });
        state.revealed = false;
        buildQueue();
        if (state.queue.length) {
          if (state.queue[state.idx] && state.queue[state.idx].surface === prevSurface) {
            state.idx = (state.idx + 1) % state.queue.length;
          } else if (state.idx >= state.queue.length) {
            state.idx = 0;
          }
        }
        renderAll();
      };
    });

    document.getElementById("btn-cloze-speak").onclick = () => {
      const pool = clozePool();
      const item = pool[state.clozeIdx % Math.max(1, pool.length)];
      if (item) speakKo(item.context || item.surface);
    };
    document.getElementById("btn-cloze-check").onclick = () => {
      const pool = clozePool();
      if (!pool.length) return;
      const item = pool[state.clozeIdx % pool.length];
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

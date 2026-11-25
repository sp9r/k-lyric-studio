(function (root) {
  const Hangul = root.KLyricHangul;
  const Dict = root.KLyricDict;
  const SRS = root.KLyricSRS;
  const Aligned = root.KLyricAligned;
  const Activation = root.KLyricActivation;

  const READING_MODES = [
    { id: "hybrid", label: "併用(カナ+ローマ字)" },
    { id: "katakana", label: "カタカナのみ" },
    { id: "roman", label: "ローマ字のみ" },
    { id: "hangul", label: "発音ハングル" },
    { id: "off", label: "読み方オフ" }
  ];

  const DEFAULT_SETTINGS = {
    enabled: true,
    readingMode: "hybrid",
    theme: "system",
    autoPauseOnClick: true,
    shortcutsEnabled: true,
    showTranslation: true,
    showOverlay: true,
    showHanja: true,
    enableBridge: false,
    bridgeUrl: "http://127.0.0.1:8788"
  };

  const SPEED_STEPS = [1.0, 0.85, 0.75];

  const ICONS = {
    music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
    repeat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
    speed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    paste: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1"></rect></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`,
    cards: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M7 10h10"></path><path d="M7 14h6"></path></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
    volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
    spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    chevronUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
    kanji: `<svg viewBox="0 0 24 24"><text x="12" y="18" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor" font-family="'Yu Gothic','Meiryo',sans-serif">漢</text></svg>`,
    translate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h8"></path><path d="M8 3v2"></path><path d="M5 9c1.5 3 4 5 7 6"></path><path d="M11 5c-1 4-3.5 7-7 9"></path><path d="M13 21l4-9 4 9"></path><path d="M14.5 18h5"></path></svg>`,
    cc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M10 10.5a2 2 0 1 0 0 3"></path><path d="M17 10.5a2 2 0 1 0 0 3"></path></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    ban: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"></line></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
  };

  function hasChromeStorage() {
    return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  }

  function storageGet(keys) {
    if (hasChromeStorage()) {
      return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
    }
    const out = {};
    const list = Array.isArray(keys) ? keys : Object.keys(keys || {});
    for (const k of list) {
      try {
        const raw = localStorage.getItem(`kls:${k}`);
        if (raw !== null) out[k] = JSON.parse(raw);
      } catch (_) {}
    }
    return Promise.resolve(out);
  }

  function storageSet(obj) {
    if (hasChromeStorage()) {
      return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
    }
    for (const [k, v] of Object.entries(obj || {})) {
      try {
        localStorage.setItem(`kls:${k}`, JSON.stringify(v));
      } catch (_) {}
    }
    return Promise.resolve();
  }

  function sendBg(msg) {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(msg, (resp) => resolve(resp || { ok: false }));
        } catch (err) {
          resolve({ ok: false, error: String(err) });
        }
      });
    }
    return Promise.resolve({ ok: false, error: "runtime unavailable" });
  }

  function formatSec(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    savedCards: {},
    meta: {
      isMusic: location.hostname === "music.youtube.com",
      url: location.href,
      videoId: "",
      title: "",
      author: "",
      captionTracks: []
    },
    rawCues: [],
    cues: [],
    offsetSec: 0,
    sourceLabel: "未読込",
    activeCueIdx: -1,
    selectedWord: "",
    loopCueIdx: -1,
    autoPauseEnd: false,
    autoPausedCueIdx: -1,
    speedIdx: 0,
    showLrcBox: false,
    overlayEl: null,
    popoverEl: null,
    dockEl: null,
    videoEl: null,
    lastLoadedKey: "",
    loadSeq: 0,
    overlayKey: "",
    dockCollapsed: false,
    translationNote: "",
    resizeObs: null,
    activation: null,
    activationResult: null,
    launcherEl: null,
    captionReqSeq: 0,
    captionWaiters: {}
  };

  function currentActivation() {
    if (!Activation) return { active: true, reason: "", mode: "blacklist", site: "youtube" };
    return Activation.evaluate(state.activation, state.meta);
  }

  function isActive() {
    return Boolean(state.activationResult && state.activationResult.active);
  }

  function getReadingLabel(modeId) {
    const found = READING_MODES.find((m) => m.id === modeId);
    return found ? found.label : READING_MODES[0].label;
  }

  function applyCuesWithOffset() {
    state.cues = Hangul.applyOffset(state.rawCues, state.offsetSec);
    // Compute chorus/repeat counts for identical Korean lines
    const totals = {};
    const seen = {};
    for (const c of state.cues) {
      const k = String(c.ko || "").trim();
      totals[k] = (totals[k] || 0) + 1;
    }
    state.cues = state.cues.map((c) => {
      const k = String(c.ko || "").trim();
      seen[k] = (seen[k] || 0) + 1;
      return {
        ...c,
        repeatTotal: totals[k] || 1,
        repeatIndex: seen[k] || 1
      };
    });
    state.activeCueIdx = -1;
    renderDock();
    syncToCurrentTime();
  }

  function isWordSaved(clean) {
    if (!clean) return false;
    if (state.savedCards[clean]) return true;
    const analysis = Dict.analyzeToken(clean);
    return Boolean(analysis.lemma && state.savedCards[analysis.lemma]);
  }

  function findVideoElement() {
    return document.querySelector("#movie_player video, video.html5-main-video, video");
  }

  function ensureOverlay() {
    // YouTube Music: mount on <ytmusic-player> so the overlay sits above the album-art layer
    // that covers #movie_player for audio-only tracks.
    const host =
      (location.hostname === "music.youtube.com" && document.querySelector("ytmusic-player#player")) ||
      document.getElementById("movie_player") ||
      (state.videoEl ? state.videoEl.parentElement : null);
    if (!host) return null;

    const stylePos = getComputedStyle(host).position;
    if (stylePos === "static") {
      host.style.position = "relative";
    }

    if (state.overlayEl && state.overlayEl.parentElement === host) {
      return state.overlayEl;
    }
    if (state.overlayEl) state.overlayEl.remove();
    state.overlayKey = "";

    const el = document.createElement("div");
    el.className = "kls-subtitle-overlay kls-hidden" + (host.tagName === "YTMUSIC-PLAYER" ? " is-music" : "");
    el.setAttribute("data-kls-role", "overlay");
    host.appendChild(el);
    state.overlayEl = el;
    watchOverlaySize(host, el);
    return el;
  }

  // Scale the subtitle text with the player: small album art stays readable,
  // full screen does not end up with tiny text.
  // Use whichever of width / height is tighter so a wide 16:9 video does not get oversized text.
  function overlayFontPx(width, height) {
    const byWidth = width * 0.033;
    const byHeight = height > 0 ? height * 0.042 : byWidth;
    return Math.round(Math.min(34, Math.max(17, Math.min(byWidth, byHeight))) * 10) / 10;
  }

  function watchOverlaySize(host, el) {
    const apply = () => {
      const r = host.getBoundingClientRect();
      el.style.setProperty("--kls-fs", `${overlayFontPx(r.width || 640, r.height)}px`);
    };
    apply();
    if (state.resizeObs) state.resizeObs.disconnect();
    if (typeof ResizeObserver === "function") {
      state.resizeObs = new ResizeObserver(apply);
      state.resizeObs.observe(host);
    }
  }

  function ensurePopover() {
    if (state.popoverEl && document.body.contains(state.popoverEl)) {
      return state.popoverEl;
    }
    const el = document.createElement("div");
    el.className = "kls-popover kls-hidden";
    el.setAttribute("data-kls-role", "popover");
    document.body.appendChild(el);
    state.popoverEl = el;
    return el;
  }

  // Other extensions (Enhancer for YouTube "hide related videos", uBlock cosmetic filters,
  // custom CSS) can hide the right-hand column. A panel mounted there would vanish with it,
  // so only use the column when it is actually on screen.
  function isShown(el) {
    if (!el || !el.isConnected) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
    }
    const r = el.getBoundingClientRect();
    return r.width >= 200;
  }

  function sideColumn() {
    const candidates = [document.querySelector("#kls-dock-host"), document.querySelector("#secondary-inner"), document.querySelector("#secondary")];
    return candidates.find((c) => isShown(c)) || null;
  }

  function ensureDock() {
    const isMusic = location.hostname === "music.youtube.com";
    const mountTarget = isMusic ? document.body : sideColumn() || document.body;

    if (state.dockEl && state.dockEl.parentElement === mountTarget) {
      return state.dockEl;
    }
    if (state.dockEl) state.dockEl.remove();

    const el = document.createElement("aside");
    el.className = "kls-dock" + (isMusic || mountTarget === document.body ? " is-music-floating" : "");
    el.setAttribute("data-kls-role", "dock");

    if (mountTarget !== document.body && mountTarget.firstChild) {
      mountTarget.insertBefore(el, mountTarget.firstChild);
    } else {
      mountTarget.appendChild(el);
    }
    state.dockEl = el;
    return el;
  }

  function renderOverlay(cue) {
    const overlay = ensureOverlay();
    if (!overlay) return;

    if (!state.settings.enabled || !state.settings.showOverlay || !isActive() || !cue || !cue.ko) {
      overlay.classList.add("kls-hidden");
      state.overlayKey = "";
      return;
    }

    overlay.classList.remove("kls-hidden");
    // timeupdate fires several times a second; rebuilding the buttons each time would
    // swap them out from under a click, so only rebuild when something visible changed.
    const renderKey = [cue.start, cue.ko, cue.ja, state.settings.showTranslation, state.settings.showHanja, state.settings.readingMode, state.selectedWord, Object.keys(state.savedCards).length].join("|");
    if (renderKey === state.overlayKey && overlay.firstChild) return;
    state.overlayKey = renderKey;
    const rows = Aligned.rowsForMode(state.settings.readingMode);
    const { tokens, hanjaRow } = Aligned.lineTokens(cue.ko, cue.ja, state.settings.showHanja !== false);
    const wordButtons = tokens
      .map((token) => {
        const tok = token.surface;
        const clean = Dict.cleanHangulWord(tok);
        const saved = isWordSaved(clean);
        const active = clean && clean === state.selectedWord;
        const cls =
          "kls-word-btn" +
          (saved ? " is-saved" : "") +
          (active ? " is-active" : "");
        return `<button type="button" class="${cls}" data-word="${escapeHtml(tok)}">${Aligned.renderWord(token, rows, hanjaRow)}</button>`;
      })
      .join("");

    const jaHtml = cue.ja && state.settings.showTranslation ? `<div class="kls-overlay-ja">${escapeHtml(cue.ja)}</div>` : "";

    overlay.innerHTML = `<div class="kls-overlay-ko">${wordButtons}</div>${jaHtml}`;
    overlay.querySelectorAll(".kls-word-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const word = btn.getAttribute("data-word") || "";
        openWordPopover(word, cue, btn.getBoundingClientRect());
      });
    });
  }

  function speakKorean(text) {
    if (!text || typeof speechSynthesis === "undefined") return;
    try {
      speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "ko-KR";
      utt.rate = 0.88;
      speechSynthesis.speak(utt);
    } catch (_) {}
  }

  async function saveWordCard(analysis, cue) {
    const key = analysis.clean;
    if (!key) return;
    const p = analysis.phonetics || Hangul.phoneticizeHangul(key);
    const videoSec = Math.floor(cue?.start ?? state.videoEl?.currentTime ?? 0);
    let sourceUrl = location.href;
    try {
      const u = new URL(location.href);
      if (u.hostname.includes("youtube.com")) {
        u.searchParams.set("t", `${videoSec}s`);
        sourceUrl = u.toString();
      }
    } catch (_) {}

    const existing = state.savedCards[key] || {};
    state.savedCards[key] = {
      id: existing.id || `card-${key}`,
      surface: key,
      lemma: analysis.lemma || key,
      pos: analysis.pos || "語句",
      meaning: (analysis.matched === false ? analysis.mtMeaning : analysis.meaning) || analysis.mtMeaning || "",
      endingLabel: analysis.endingLabel || "",
      endingMeaning: analysis.endingMeaning || "",
      pronouncedHangul: p.pronouncedHangul || key,
      katakana: p.katakana || "",
      romanized: p.romanized || "",
      appliedRules: p.appliedRules || [],
      context: cue?.ko || key,
      jaContext: cue?.ja || "",
      sourceTitle: state.meta.title || document.title || "YouTube",
      sourceUrl,
      timestampSec: videoSec,
      reps: existing.reps || 0,
      intervalDays: existing.intervalDays || 0,
      ease: existing.ease || 2.5,
      lapses: existing.lapses || 0,
      streak: existing.streak || 0,
      mastered: Boolean(existing.mastered),
      dueAt: existing.dueAt || 0,
      savedAt: existing.savedAt || Date.now()
    };

    await storageSet({ savedCards: state.savedCards });
    renderDock();
    syncToCurrentTime();
  }

  function openWordPopover(rawWord, cue, anchorRect) {
    const analysis = Dict.analyzeToken(rawWord);
    if (!analysis.clean) return;
    state.selectedWord = analysis.clean;

    if (state.settings.autoPauseOnClick && state.videoEl && !state.videoEl.paused) {
      state.videoEl.pause();
    }

    const pop = ensurePopover();
    pop.classList.remove("kls-hidden");

    const p = analysis.phonetics || Hangul.phoneticizeHangul(analysis.clean);
    const wordToken = Hangul.alignReading(analysis.clean)[0];
    const popHanja = Boolean(
      wordToken && state.settings.showHanja !== false && cue && cue.ja && root.KLyricHanja && root.KLyricHanja.annotate([wordToken], cue.ja) > 0
    );
    const popRows = ["pron", "kana", "roman"];
    const rulesHtml = (p.appliedRules || [])
      .map((r) => `<span class="kls-badge is-accent">${escapeHtml(r)}</span>`)
      .join("");
    const saved = Boolean(state.savedCards[analysis.clean]);
    // Unknown words come back with a placeholder note instead of a meaning.
    const dictMeaning = analysis.matched === false ? "" : analysis.meaning || "";

    pop.innerHTML = `
      <div class="kls-pop-head">
        <div>
          <div class="kls-pop-aligned">
            <span class="kls-pop-legend">${popHanja ? "<span>漢字</span>" : ""}<span class="is-ko">表記</span><span>発音</span><span>カナ</span><span>ローマ字</span></span>
            ${wordToken ? Aligned.renderWord(wordToken, popRows, popHanja) : escapeHtml(analysis.clean)}
          </div>
          <div class="kls-pop-badges">
            <span class="kls-badge">${escapeHtml(analysis.pos)}</span>
            ${rulesHtml}
          </div>
        </div>
        <button type="button" class="kls-btn" data-pop="close" aria-label="閉じる">
          ${ICONS.close}<span>閉じる</span>
        </button>
      </div>
      <div class="kls-pop-grid">
        <div class="kls-pop-box">
          <div class="kls-pop-label">基本形（辞書形）</div>
          <div class="kls-pop-val">${escapeHtml(analysis.lemma || analysis.clean)}</div>
        </div>
        ${analysis.endingLabel ? `
        <div class="kls-pop-box">
          <div class="kls-pop-label">語尾・助詞の分解</div>
          <div class="kls-pop-val">${escapeHtml(analysis.endingLabel)} : ${escapeHtml(analysis.endingMeaning)}</div>
        </div>` : ""}
        <div class="kls-pop-box kls-pop-meaning">
          <div class="kls-pop-label">意味</div>
          ${dictMeaning ? `<div class="kls-pop-val">${escapeHtml(dictMeaning)} <span class="kls-pop-src">内蔵辞書</span></div>` : ""}
          <div class="kls-pop-val" data-pop="mt">${dictMeaning ? "" : "翻訳中..."}</div>
        </div>
        <div class="kls-pop-box kls-hidden" data-pop="ai-box">
          <div class="kls-pop-label">ローカルAI 文脈解説</div>
          <div class="kls-pop-val" data-pop="ai-text"></div>
        </div>
      </div>
      <div class="kls-pop-actions">
        <button type="button" class="kls-btn" data-pop="speak">${ICONS.volume}<span>発音を聴く</span></button>
        <button type="button" class="kls-btn" data-pop="replay">${ICONS.play}<span>この行を再生</span></button>
        ${state.settings.enableBridge ? `<button type="button" class="kls-btn" data-pop="ai">${ICONS.spark}<span>AI文脈解説</span></button>` : ""}
        <button type="button" class="kls-btn is-primary" data-pop="save">${ICONS.bookmark}<span>${saved ? "保存済み(更新)" : "単語帳へ保存"}</span></button>
      </div>
    `;

    // Position cleanly above the subtitle row when space allows, otherwise below
    const popH = 300;
    const preferAbove = anchorRect && anchorRect.top > popH + 20;
    const top = preferAbove
      ? Math.max(12, anchorRect.top - popH - 10)
      : Math.min(window.innerHeight - popH - 12, Math.max(12, (anchorRect?.bottom || 120) + 8));
    const left = Math.min(window.innerWidth - 375, Math.max(12, anchorRect?.left || 24));
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;

    pop.querySelector('[data-pop="close"]').onclick = () => pop.classList.add("kls-hidden");
    fillWordMeaning(pop, analysis);
    pop.querySelector('[data-pop="speak"]').onclick = () => speakKorean(analysis.clean);
    pop.querySelector('[data-pop="replay"]').onclick = () => {
      if (state.videoEl && cue) {
        state.videoEl.currentTime = cue.start;
        state.videoEl.play();
      }
    };
    pop.querySelector('[data-pop="save"]').onclick = async () => {
      await saveWordCard(analysis, cue);
      const lbl = pop.querySelector('[data-pop="save"] span');
      if (lbl) lbl.textContent = "保存しました";
    };

    const aiBtn = pop.querySelector('[data-pop="ai"]');
    if (aiBtn) {
      aiBtn.onclick = async () => {
        const aiBox = pop.querySelector('[data-pop="ai-box"]');
        const aiText = pop.querySelector('[data-pop="ai-text"]');
        aiBox.classList.remove("kls-hidden");
        aiText.textContent = "ローカルAIへ照会中...";
        const res = await sendBg({
          type: "kls:bridge-explain",
          bridgeUrl: state.settings.bridgeUrl,
          payload: {
            word: analysis.clean,
            line: cue?.ko || "",
            translation: cue?.ja || "",
            title: state.meta.title || ""
          }
        });
        if (res && res.ok && res.data && res.data.explanation) {
          aiText.textContent = res.data.explanation;
        } else {
          aiText.textContent = "ローカルAIブリッジに接続できません。設定画面で起動状態を確認してください。";
        }
      };
    }

    syncToCurrentTime();
  }

  async function fillWordMeaning(pop, analysis) {
    const box = pop.querySelector('[data-pop="mt"]');
    if (!box) return;
    const lemma = analysis.lemma || analysis.clean;
    const forms = lemma !== analysis.clean ? [lemma, analysis.clean] : [lemma];
    const res = await sendBg({ type: "kls:translate", lines: forms });
    // The user may have opened another word meanwhile.
    if (state.selectedWord !== analysis.clean || !pop.contains(box)) return;
    if (!res || !res.ok || !Array.isArray(res.lines) || !res.lines[0]) {
      box.textContent = analysis.matched !== false && analysis.meaning ? "" : "意味を取得できませんでした（オフライン等）";
      return;
    }
    const [lemmaJa, formJa] = res.lines;
    analysis.mtMeaning = formJa && formJa !== lemmaJa ? `${lemmaJa}（${formJa}）` : lemmaJa;
    let html = `${escapeHtml(lemmaJa)}${forms.length > 1 ? ` <span class="kls-pop-src">${escapeHtml(lemma)}</span>` : ""} <span class="kls-pop-src">機械翻訳</span>`;
    if (formJa && formJa !== lemmaJa) {
      html += `<div class="kls-pop-sub">この形（${escapeHtml(analysis.clean)}）: ${escapeHtml(formJa)}</div>`;
    }
    box.innerHTML = html;
  }

  // Fill in Japanese for lines that have no translation (LRCLIB lyrics, pasted LRC).
  async function translateMissing(seq) {
    const targets = state.rawCues
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !c.ja && /[\uAC00-\uD7A3]/.test(c.ko || ""));
    if (!targets.length) return;
    state.translationNote = "訳を取得中";
    renderDock();
    const res = await sendBg({ type: "kls:translate", lines: targets.map(({ c }) => c.ko) });
    if (seq !== state.loadSeq) return;
    if (res && Array.isArray(res.lines)) {
      targets.forEach(({ i }, k) => {
        if (res.lines[k] && state.rawCues[i]) {
          state.rawCues[i] = { ...state.rawCues[i], ja: res.lines[k], jaMachine: true };
        }
      });
    }
    state.translationNote = res && res.ok ? "訳は機械翻訳" : "訳の取得に失敗";
    applyCuesWithOffset();
  }

  async function saveActivation(next) {
    state.activation = next;
    await storageSet({ activation: next });
    refreshActivation(true);
  }

  // Chip shown on videos where the panel is off, so it can be turned on in one click.
  function renderLauncher() {
    const show = state.settings.enabled && !isActive() && Boolean(state.meta.videoId);
    if (!show) {
      if (state.launcherEl) state.launcherEl.classList.add("kls-hidden");
      return;
    }
    if (!state.launcherEl || !state.launcherEl.isConnected) {
      const el = document.createElement("div");
      el.className = "kls-launcher";
      el.setAttribute("data-kls-role", "launcher");
      document.body.appendChild(el);
      state.launcherEl = el;
    }
    const el = state.launcherEl;
    el.classList.remove("kls-hidden");
    const res = state.activationResult || {};
    const blocked = Boolean(res.rule);
    const canChannel = Boolean(state.meta.channelId || state.meta.author);
    el.title = res.reason || "";
    el.innerHTML = `
      <span class="kls-launcher-label">${ICONS.music}<span>K-Lyric</span></span>
      <button type="button" class="kls-btn" data-act="allow-video">${ICONS.plus}<span>${blocked ? "この動画で再表示" : "この動画で表示"}</span></button>
      ${canChannel && res.mode === "whitelist" ? `<button type="button" class="kls-btn" data-act="allow-channel">${ICONS.plus}<span>このチャンネルで表示</span></button>` : ""}
    `;
    el.querySelector('[data-act="allow-video"]').onclick = () => saveActivation(Activation.allowHere(state.activation, state.meta, "video"));
    const chBtn = el.querySelector('[data-act="allow-channel"]');
    if (chBtn) chBtn.onclick = () => saveActivation(Activation.allowHere(state.activation, state.meta, "channel"));
  }

  function activationRowHtml() {
    const res = state.activationResult || {};
    const canChannel = Boolean(state.meta.channelId || state.meta.author);
    return `
      <div class="kls-activation-row">
        <span class="kls-activation-reason">${escapeHtml(res.reason || "")}</span>
        <button type="button" class="kls-btn" data-act="block-video">${ICONS.ban}<span>この動画では非表示</span></button>
        ${canChannel ? `<button type="button" class="kls-btn" data-act="block-channel">${ICONS.ban}<span>このチャンネルでは非表示</span></button>` : ""}
      </div>
    `;
  }

  // Re-evaluate the show/hide rules for the current video. `force` reloads lyrics when the
  // panel just became active.
  function refreshActivation(force) {
    const prev = isActive();
    state.activationResult = currentActivation();
    const now = isActive();
    renderLauncher();
    renderDock();
    if (now && (!prev || force)) {
      loadSubtitlesForMeta(false);
    }
    syncToCurrentTime();
  }

  function renderDock() {
    const dock = ensureDock();
    if (!dock) return;
    if (!state.settings.enabled || !isActive()) {
      dock.classList.add("kls-hidden");
      return;
    }
    dock.classList.remove("kls-hidden");
    dock.classList.toggle("is-collapsed", state.dockCollapsed);

    const cov = Dict.computeVocabularyStats(state.cues, state.savedCards);
    const speed = SPEED_STEPS[state.speedIdx];
    const readLabel = getReadingLabel(state.settings.readingMode);

    const linesHtml = state.cues.length
      ? state.cues
          .map((c, idx) => {
            const cur = idx === state.activeCueIdx;
            const rep = c.repeatTotal > 1 ? `<span class="kls-badge is-accent">${c.repeatIndex}/${c.repeatTotal}</span>` : "";
            return `
              <button type="button" class="kls-line-row${cur ? " is-current" : ""}" data-cue-idx="${idx}">
                <div class="kls-line-meta">
                  <span>${formatSec(c.start)}</span>
                  ${rep}
                </div>
                <div class="kls-line-ko">${Aligned.renderLine(c.ko, state.settings.readingMode, { ja: c.ja, hanja: state.settings.showHanja !== false })}</div>
                ${c.ja && state.settings.showTranslation ? `<div class="kls-line-ja">${escapeHtml(c.ja)}</div>` : ""}
              </button>
            `;
          })
          .join("")
      : `<div class="kls-status-text" style="padding:10px;">韓国語字幕・同期歌詞を読み込み中、または「歌詞・LRC貼付」から手入力できます。</div>`;

    dock.innerHTML = `
      <div class="kls-dock-head">
        <div class="kls-brand">${ICONS.music}<span>K-Lyric Studio</span></div>
        <span class="kls-dock-head-right">
          <span class="kls-status-text">${escapeHtml(state.sourceLabel)} ・ ${state.cues.length}行${state.translationNote ? ` ・ ${escapeHtml(state.translationNote)}` : ""}</span>
          <button type="button" class="kls-btn" data-act="collapse" aria-expanded="${state.dockCollapsed ? "false" : "true"}">${state.dockCollapsed ? ICONS.chevronUp : ICONS.chevronDown}<span>${state.dockCollapsed ? "広げる" : "たたむ"}</span></button>
        </span>
      </div>
      ${activationRowHtml()}
      <div class="kls-cov-wrap">
        <div class="kls-cov-row">
          <span>曲内の語彙カバー</span>
          <span>既知 ${cov.knownPct}% / 学習中 ${cov.learningPct}% / 新出 ${cov.unseenPct}%</span>
        </div>
        <div class="kls-cov-bar">
          <div class="kls-cov-known" style="width:${cov.knownPct}%"></div>
          <div class="kls-cov-learning" style="width:${cov.learningPct}%"></div>
          <div class="kls-cov-unseen" style="width:${cov.unseenPct}%"></div>
        </div>
      </div>
      <div class="kls-controls">
        <button type="button" class="kls-btn${state.loopCueIdx >= 0 ? " is-active" : ""}" data-act="loop">${ICONS.repeat}<span>1行リピート</span></button>
        <button type="button" class="kls-btn${state.autoPauseEnd ? " is-active" : ""}" data-act="autopause">${ICONS.pause}<span>末尾停止</span></button>
        <button type="button" class="kls-btn" data-act="speed">${ICONS.speed}<span>速度 ${speed.toFixed(2).replace(/\.00$/, ".0")}x</span></button>
        <button type="button" class="kls-btn is-active" data-act="reading">${ICONS.eye}<span>${escapeHtml(readLabel)}</span></button>
        <button type="button" class="kls-btn${state.settings.showOverlay ? " is-active" : ""}" data-act="overlay" aria-pressed="${state.settings.showOverlay ? "true" : "false"}">${ICONS.cc}<span>動画の字幕${state.settings.showOverlay ? "" : "(非表示)"}</span></button>
        <button type="button" class="kls-btn${state.settings.showHanja !== false ? " is-active" : ""}" data-act="hanja" aria-pressed="${state.settings.showHanja !== false ? "true" : "false"}">${ICONS.kanji}<span>漢字${state.settings.showHanja !== false ? "" : "(非表示)"}</span></button>
        <button type="button" class="kls-btn${state.settings.showTranslation ? " is-active" : ""}" data-act="translation" aria-pressed="${state.settings.showTranslation ? "true" : "false"}">${ICONS.translate}<span>日本語訳${state.settings.showTranslation ? "" : "(非表示)"}</span></button>
        <button type="button" class="kls-btn${state.showLrcBox ? " is-active" : ""}" data-act="toggle-lrc">${ICONS.paste}<span>歌詞・LRC貼付</span></button>
        <button type="button" class="kls-btn" data-act="reload">${ICONS.refresh}<span>再取得</span></button>
        <button type="button" class="kls-btn" data-act="studio">${ICONS.cards}<span>復習スタジオ</span></button>
        ${state.settings.enableBridge ? `<button type="button" class="kls-btn" data-act="transcribe">${ICONS.spark}<span>AI字幕生成</span></button>` : ""}
      </div>
      <div class="kls-offset-row">
        <span>同期補正 (${state.offsetSec >= 0 ? "+" : ""}${state.offsetSec.toFixed(1)}s)</span>
        <div style="display:flex;gap:4px;">
          <button type="button" class="kls-btn" data-act="offset-minus">-0.5s</button>
          <button type="button" class="kls-btn" data-act="offset-plus">+0.5s</button>
          <button type="button" class="kls-btn" data-act="offset-align">今の秒数に合わせる</button>
        </div>
      </div>
      <div class="kls-lines">${linesHtml}</div>
      <div class="kls-lrc-modal${state.showLrcBox ? "" : " kls-hidden"}">
        <div class="kls-status-text">LRC形式（[00:12.30] 가사）または韓国語テキストを貼り付けて適用します。</div>
        <textarea class="kls-textarea" data-kls-lrc-input placeholder="[00:38.00] 이번엔 정말 좋아해"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:6px;">
          <button type="button" class="kls-btn" data-act="cancel-lrc">閉じる</button>
          <button type="button" class="kls-btn is-primary" data-act="apply-lrc">歌詞を適用</button>
        </div>
      </div>
    `;

    dock.querySelector('[data-act="collapse"]').onclick = async () => {
      state.dockCollapsed = !state.dockCollapsed;
      await storageSet({ dockCollapsed: state.dockCollapsed });
      renderDock();
    };
    dock.querySelector('[data-act="loop"]').onclick = () => {
      if (state.loopCueIdx >= 0) {
        state.loopCueIdx = -1;
      } else {
        state.loopCueIdx = state.activeCueIdx >= 0 ? state.activeCueIdx : 0;
      }
      renderDock();
    };
    dock.querySelector('[data-act="autopause"]').onclick = () => {
      state.autoPauseEnd = !state.autoPauseEnd;
      state.autoPausedCueIdx = -1;
      renderDock();
    };
    dock.querySelector('[data-act="speed"]').onclick = () => {
      state.speedIdx = (state.speedIdx + 1) % SPEED_STEPS.length;
      if (state.videoEl) state.videoEl.playbackRate = SPEED_STEPS[state.speedIdx];
      renderDock();
    };
    dock.querySelector('[data-act="reading"]').onclick = async () => {
      const idx = READING_MODES.findIndex((m) => m.id === state.settings.readingMode);
      const next = READING_MODES[(idx + 1) % READING_MODES.length].id;
      state.settings.readingMode = next;
      await storageSet({ settings: state.settings });
      renderDock();
      syncToCurrentTime();
    };
    dock.querySelector('[data-act="hanja"]').onclick = async () => {
      state.settings.showHanja = state.settings.showHanja === false;
      await storageSet({ settings: state.settings });
      renderDock();
      syncToCurrentTime();
    };
    dock.querySelector('[data-act="translation"]').onclick = async () => {
      state.settings.showTranslation = !state.settings.showTranslation;
      await storageSet({ settings: state.settings });
      renderDock();
      syncToCurrentTime();
    };
    dock.querySelector('[data-act="overlay"]').onclick = async () => {
      state.settings.showOverlay = !state.settings.showOverlay;
      await storageSet({ settings: state.settings });
      renderDock();
      syncToCurrentTime();
    };
    dock.querySelector('[data-act="block-video"]').onclick = () => saveActivation(Activation.blockHere(state.activation, state.meta, "video"));
    const blockCh = dock.querySelector('[data-act="block-channel"]');
    if (blockCh) blockCh.onclick = () => saveActivation(Activation.blockHere(state.activation, state.meta, "channel"));
    dock.querySelector('[data-act="toggle-lrc"]').onclick = () => {
      state.showLrcBox = !state.showLrcBox;
      renderDock();
    };
    dock.querySelector('[data-act="cancel-lrc"]').onclick = () => {
      state.showLrcBox = false;
      renderDock();
    };
    dock.querySelector('[data-act="apply-lrc"]').onclick = () => {
      const raw = dock.querySelector("[data-kls-lrc-input]")?.value || "";
      let parsed = Hangul.parseLrc(raw);
      if (!parsed.length && raw.trim()) {
        const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const dur = state.videoEl && state.videoEl.duration ? state.videoEl.duration : lines.length * 4;
        const step = dur / Math.max(1, lines.length);
        parsed = lines.map((line, i) => ({
          id: i,
          start: Number((i * step).toFixed(2)),
          end: Number(((i + 1) * step).toFixed(2)),
          ko: line,
          ja: ""
        }));
      }
      if (parsed.length) {
        state.rawCues = parsed;
        state.offsetSec = 0;
        state.sourceLabel = "手動LRC";
        state.showLrcBox = false;
        state.translationNote = "";
        applyCuesWithOffset();
        translateMissing(state.loadSeq);
      }
    };
    dock.querySelector('[data-act="reload"]').onclick = () => loadSubtitlesForMeta(true);
    dock.querySelector('[data-act="studio"]').onclick = () => sendBg({ type: "kls:open-page", page: "studio" });

    const trBtn = dock.querySelector('[data-act="transcribe"]');
    if (trBtn) {
      trBtn.onclick = async () => {
        state.sourceLabel = "AI字幕生成中";
        renderDock();
        const res = await sendBg({
          type: "kls:bridge-transcribe",
          bridgeUrl: state.settings.bridgeUrl,
          payload: { url: location.href, title: state.meta.title || "" }
        });
        if (res && res.ok && Array.isArray(res.data?.cues) && res.data.cues.length) {
          state.rawCues = res.data.cues;
          state.offsetSec = 0;
          state.sourceLabel = "Whisper AI字幕";
          applyCuesWithOffset();
        } else {
          state.sourceLabel = "AI字幕取得失敗";
          renderDock();
        }
      };
    }

    dock.querySelector('[data-act="offset-minus"]').onclick = () => {
      state.offsetSec = Number((state.offsetSec - 0.5).toFixed(1));
      applyCuesWithOffset();
    };
    dock.querySelector('[data-act="offset-plus"]').onclick = () => {
      state.offsetSec = Number((state.offsetSec + 0.5).toFixed(1));
      applyCuesWithOffset();
    };
    dock.querySelector('[data-act="offset-align"]').onclick = () => {
      if (!state.videoEl || !state.rawCues.length) return;
      const targetIdx = state.activeCueIdx >= 0 ? state.activeCueIdx : 0;
      const baseStart = state.rawCues[targetIdx].start;
      state.offsetSec = Number((state.videoEl.currentTime - baseStart).toFixed(1));
      applyCuesWithOffset();
    };

    dock.querySelectorAll(".kls-line-row").forEach((row) => {
      row.onclick = (e) => {
        const idx = Number(row.getAttribute("data-cue-idx"));
        const cue = state.cues[idx];
        if (!cue) return;
        // Clicking a word shows its meaning; clicking elsewhere on the line jumps there.
        const wordEl = e.target && e.target.closest ? e.target.closest(".kls-al-word[data-word]") : null;
        if (wordEl) {
          e.stopPropagation();
          openWordPopover(wordEl.getAttribute("data-word") || "", cue, wordEl.getBoundingClientRect());
          return;
        }
        if (state.videoEl) {
          state.videoEl.currentTime = cue.start;
          if (state.videoEl.paused) state.videoEl.play();
        }
        state.activeCueIdx = idx;
        renderOverlay(cue);
        renderDock();
      };
    });
    keepCurrentLineInView();
  }

  // Keep the playing line second from the bottom of the list, so the next line is visible
  // under it. Near the end of the song the list simply stops scrolling.
  function keepCurrentLineInView() {
    const dock = state.dockEl;
    if (!dock) return;
    const list = dock.querySelector(".kls-lines");
    const cur = list && list.querySelector(".kls-line-row.is-current");
    if (!list || !cur || !list.clientHeight) return;
    const next = cur.nextElementSibling && cur.nextElementSibling.classList.contains("kls-line-row") ? cur.nextElementSibling : null;
    const gap = 4;
    const pad = 6;
    const bottom = cur.offsetTop + cur.offsetHeight + (next ? gap + next.offsetHeight : 0) + pad;
    let target = bottom - list.clientHeight;
    // A line taller than the list (or one with a very tall next line) must still show its top.
    if (cur.offsetTop - pad < target) target = cur.offsetTop - pad;
    target = Math.max(0, Math.min(target, list.scrollHeight - list.clientHeight));
    if (Math.abs(list.scrollTop - target) > 1) list.scrollTop = target;
  }

  function syncToCurrentTime() {
    const v = state.videoEl || findVideoElement();
    if (!v || !state.cues.length || !isActive()) {
      renderOverlay(null);
      return;
    }
    // While an ad plays, the <video> time belongs to the ad, not the song.
    const playerEl = document.getElementById("movie_player");
    if (playerEl && playerEl.classList.contains("ad-showing")) {
      renderOverlay(null);
      return;
    }
    const t = v.currentTime;

    // 1-line loop enforcement
    if (state.loopCueIdx >= 0 && state.cues[state.loopCueIdx]) {
      const lc = state.cues[state.loopCueIdx];
      if (t >= lc.end - 0.08 || t < lc.start - 0.3) {
        v.currentTime = lc.start;
      }
    }

    // Auto pause at line end
    if (state.autoPauseEnd && state.activeCueIdx >= 0 && state.cues[state.activeCueIdx]) {
      const cur = state.cues[state.activeCueIdx];
      if (t >= cur.end - 0.12 && state.autoPausedCueIdx !== state.activeCueIdx && !v.paused) {
        state.autoPausedCueIdx = state.activeCueIdx;
        v.pause();
      }
    }

    let foundIdx = -1;
    for (let i = 0; i < state.cues.length; i++) {
      if (t >= state.cues[i].start && t < state.cues[i].end) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx !== state.activeCueIdx) {
      state.activeCueIdx = foundIdx;
      if (state.dockEl) {
        state.dockEl.querySelectorAll(".kls-line-row").forEach((row, i) => {
          row.classList.toggle("is-current", i === foundIdx);
        });
        keepCurrentLineInView();
      }
    }
    renderOverlay(foundIdx >= 0 ? state.cues[foundIdx] : null);
  }

  function attachVideoListener() {
    const v = findVideoElement();
    if (!v) return;
    if (state.videoEl !== v) {
      state.videoEl = v;
      v.addEventListener("timeupdate", syncToCurrentTime);
      v.addEventListener("seeked", syncToCurrentTime);
      v.addEventListener("play", () => {
        if (state.autoPausedCueIdx === state.activeCueIdx) {
          // Allow advancing into next cue cleanly
          state.autoPausedCueIdx = -2;
        }
      });
    }
  }

  // YouTube now refuses caption downloads that lack the player's proof-of-origin token, so the
  // background fetch comes back empty on many videos. The page hook can switch the player's
  // own captions on for a moment and reuse the signed URL it requests.
  function requestPageCaptions(videoId) {
    const id = ++state.captionReqSeq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        delete state.captionWaiters[id];
        resolve(null);
      }, 25000);
      state.captionWaiters[id] = (data) => {
        clearTimeout(timer);
        delete state.captionWaiters[id];
        resolve(data);
      };
      window.postMessage({ source: "kls-request-captions", reqId: id, videoId }, "*");
    });
  }

  function looksLikeSongTitle(title) {
    return /\b(m\/?v|official\s+(music\s+)?video|official\s+audio|lyrics?|audio|music\s+video|performance\s+video|dance\s+practice|cover|visualizer)\b|가사|뮤직비디오|歌詞|歌ってみた/i.test(String(title || ""));
  }

  function cuesFromCaptionPair(koJson, jaJson) {
    const koCues = koJson ? Hangul.parseYouTubeJson3(koJson) : [];
    const jaCues = jaJson ? Hangul.parseYouTubeJson3(jaJson) : [];
    return Hangul.mergeDualSubtitles(koCues, jaCues);
  }

  async function loadSubtitlesForMeta(force = false) {
    if (!isActive()) return;
    const key = `${state.meta.videoId}|${state.meta.title}`;
    if (!force && key === state.lastLoadedKey) return;
    state.lastLoadedKey = key;
    const seq = ++state.loadSeq;
    const stale = () => seq !== state.loadSeq;

    // Clear the previous video's lines right away so they never show over the next song.
    state.rawCues = [];
    state.offsetSec = 0;
    state.translationNote = "";
    if (!state.meta.videoId) {
      state.sourceLabel = "再生待ち";
      applyCuesWithOffset();
      return;
    }
    state.sourceLabel = "読込中";
    applyCuesWithOffset();

    // 1. Try YouTube Korean caption track first
    const tracks = Array.isArray(state.meta.captionTracks) ? state.meta.captionTracks : [];
    const koTrack =
      tracks.find((t) => String(t.languageCode).startsWith("ko") && t.kind !== "asr") ||
      tracks.find((t) => String(t.languageCode).startsWith("ko"));
    const jaTrack =
      tracks.find((t) => String(t.languageCode).startsWith("ja") && t.kind !== "asr") ||
      tracks.find((t) => String(t.languageCode).startsWith("ja"));

    if (koTrack && koTrack.baseUrl) {
      const koResp = await sendBg({ type: "kls:fetch-caption", baseUrl: koTrack.baseUrl });
      if (stale()) return;
      if (koResp && koResp.ok && koResp.json3) {
        const koCues = Hangul.parseYouTubeJson3(koResp.json3);
        let jaCues = [];
        if (jaTrack && jaTrack.baseUrl) {
          const jaResp = await sendBg({ type: "kls:fetch-caption", baseUrl: jaTrack.baseUrl });
          if (jaResp && jaResp.ok && jaResp.json3) {
            jaCues = Hangul.parseYouTubeJson3(jaResp.json3);
          }
        } else {
          const trUrl = `${koTrack.baseUrl}&tlang=ja`;
          const trResp = await sendBg({ type: "kls:fetch-caption", baseUrl: trUrl });
          if (trResp && trResp.ok && trResp.json3) {
            jaCues = Hangul.parseYouTubeJson3(trResp.json3);
          }
        }
        if (stale()) return;
        const merged = Hangul.mergeDualSubtitles(koCues, jaCues);
        if (merged.length) {
          state.rawCues = merged;
          state.offsetSec = 0;
          state.sourceLabel = "YouTube字幕";
          applyCuesWithOffset();
          translateMissing(seq);
          return;
        }
      }

      // 1b. Direct download was refused: let the player fetch them.
      state.sourceLabel = "字幕を取得中";
      renderDock();
      const viaPage = await requestPageCaptions(state.meta.videoId);
      if (stale()) return;
      if (viaPage && viaPage.ok && viaPage.ko) {
        const merged = cuesFromCaptionPair(viaPage.ko, viaPage.ja);
        if (merged.length) {
          state.rawCues = merged;
          state.offsetSec = 0;
          state.sourceLabel = "YouTube字幕";
          applyCuesWithOffset();
          translateMissing(seq);
          return;
        }
      }
    }

    // 2. Try LRCLIB synced lyrics using cleaned title & author
    // The channel name helps for "Topic" channels but hurts for label channels (HYBE LABELS etc.),
    // so fall back to the title alone.
    const queries = [
      Hangul.cleanTrackQuery(state.meta.title, state.meta.author),
      Hangul.cleanTrackQuery(state.meta.title, "")
    ].filter((q, i, arr) => q && arr.indexOf(q) === i);
    for (const query of queries) {
      const dur = state.videoEl && state.videoEl.duration ? state.videoEl.duration : 0;
      const lrcResp = await sendBg({ type: "kls:fetch-lrclib", query, duration: dur });
      if (stale()) return;
      // On regular YouTube many videos are not songs (vlogs, variety shows). Only trust a
      // lyrics hit when the title says it is a song (MVs run longer than the track), or when
      // the lengths match; otherwise a random song would be laid over a talk video.
      const lengthOk = dur > 0 && lrcResp && Number(lrcResp.duration) > 0 && Math.abs(Number(lrcResp.duration) - dur) <= 15;
      const trusted = state.meta.isMusic || lengthOk || looksLikeSongTitle(state.meta.title);
      if (lrcResp && lrcResp.ok && lrcResp.syncedLyrics && trusted) {
        const parsed = Hangul.parseLrc(lrcResp.syncedLyrics);
        if (parsed.length) {
          state.rawCues = parsed;
          state.offsetSec = 0;
          state.sourceLabel = "LRCLIB 同期歌詞";
          applyCuesWithOffset();
          translateMissing(seq);
          return;
        }
      }
    }

    state.sourceLabel = "字幕未検出";
    renderDock();
  }

  function handleKeydown(e) {
    if (!state.settings.enabled || !state.settings.shortcutsEnabled || !isActive()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const origin = (typeof e.composedPath === "function" && e.composedPath()[0]) || e.target;
    const tag = (origin && origin.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || origin?.isContentEditable) return;

    const k = String(e.key || "").toLowerCase();
    if (k === "a" && state.cues.length) {
      const target = Math.max(0, (state.activeCueIdx >= 0 ? state.activeCueIdx : 0) - 1);
      if (state.videoEl) state.videoEl.currentTime = state.cues[target].start;
      syncToCurrentTime();
    } else if (k === "d" && state.cues.length) {
      const target = Math.min(state.cues.length - 1, (state.activeCueIdx >= 0 ? state.activeCueIdx : -1) + 1);
      if (state.videoEl) state.videoEl.currentTime = state.cues[target].start;
      syncToCurrentTime();
    } else if (k === "s" && state.cues.length) {
      state.loopCueIdx = state.loopCueIdx >= 0 ? -1 : Math.max(0, state.activeCueIdx);
      renderDock();
    } else if (k === "r") {
      const idx = READING_MODES.findIndex((m) => m.id === state.settings.readingMode);
      state.settings.readingMode = READING_MODES[(idx + 1) % READING_MODES.length].id;
      storageSet({ settings: state.settings });
      renderDock();
      syncToCurrentTime();
    }
  }

  async function init(initialMeta) {
    const stored = await storageGet(["settings", "savedCards", "dockCollapsed", "activation"]);
    state.dockCollapsed = Boolean(stored.dockCollapsed);
    if (stored.settings) state.settings = { ...DEFAULT_SETTINGS, ...stored.settings };
    if (stored.savedCards && typeof stored.savedCards === "object") state.savedCards = stored.savedCards;
    state.activation = Activation ? Activation.normalize(stored.activation) : null;
    if (initialMeta) state.meta = { ...state.meta, ...initialMeta };
    state.activationResult = currentActivation();

    attachVideoListener();
    renderDock();
    renderLauncher();

    window.addEventListener("message", (event) => {
      if (event.source !== window || !event.data) return;
      if (event.data.source === "kls-page-captions") {
        const waiter = state.captionWaiters[event.data.reqId];
        if (waiter) waiter(event.data);
        return;
      }
      if (event.data.source !== "kls-page-hook") return;
      state.meta = { ...state.meta, ...event.data };
      attachVideoListener();
      refreshActivation(false);
      loadSubtitlesForMeta(false);
    });

    // The right-hand column can appear, disappear or be hidden by another extension after
    // the page loads (theater mode, Enhancer settings), so re-check where the panel lives.
    setInterval(() => {
      if (!state.settings.enabled || !isActive() || state.meta.isMusic) return;
      const want = sideColumn() || document.body;
      if (state.dockEl && state.dockEl.parentElement !== want) renderDock();
    }, 2000);

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.activation) {
          state.activation = Activation.normalize(changes.activation.newValue);
          refreshActivation(false);
        }
        if (changes.settings && changes.settings.newValue) {
          state.settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
          renderDock();
          syncToCurrentTime();
        }
        if (changes.savedCards && changes.savedCards.newValue) {
          state.savedCards = changes.savedCards.newValue;
          renderDock();
          syncToCurrentTime();
        }
      });
    }

    document.addEventListener("keydown", handleKeydown);
    window.postMessage({ source: "kls-request-meta" }, "*");
  }

  function loadCuesForTest(cues, label = "テスト字幕") {
    state.rawCues = Array.isArray(cues) ? cues : [];
    state.offsetSec = 0;
    state.sourceLabel = label;
    attachVideoListener();
    applyCuesWithOffset();
  }

  root.KLyricContent = {
    init,
    loadCuesForTest,
    syncToCurrentTime,
    getState: () => state
  };

  if (typeof document !== "undefined" && !root.__KLS_MANUAL_INIT__) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => init());
    } else {
      init();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : self);

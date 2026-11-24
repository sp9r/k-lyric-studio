(function (root) {
  const Hangul = root.KLyricHangul;
  const Dict = root.KLyricDict;
  const SRS = root.KLyricSRS;

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
    lastLoadedKey: ""
  };

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
    const host =
      document.getElementById("movie_player") ||
      document.querySelector("ytmusic-player-page #player") ||
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

    const el = document.createElement("div");
    el.className = "kls-subtitle-overlay kls-hidden";
    el.setAttribute("data-kls-role", "overlay");
    host.appendChild(el);
    state.overlayEl = el;
    return el;
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

  function ensureDock() {
    const isMusic = location.hostname === "music.youtube.com";
    const mountTarget = isMusic
      ? document.body
      : document.querySelector("#secondary-inner, #secondary, #kls-dock-host") || document.body;

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

    if (!state.settings.enabled || !cue || !cue.ko) {
      overlay.classList.add("kls-hidden");
      return;
    }

    overlay.classList.remove("kls-hidden");
    const tokens = String(cue.ko).split(/\s+/).filter(Boolean);
    const wordButtons = tokens
      .map((tok) => {
        const clean = Dict.cleanHangulWord(tok);
        const saved = isWordSaved(clean);
        const active = clean && clean === state.selectedWord;
        const cls =
          "kls-word-btn" +
          (saved ? " is-saved" : "") +
          (active ? " is-active" : "");
        return `<button type="button" class="${cls}" data-word="${escapeHtml(tok)}">${escapeHtml(tok)}</button>`;
      })
      .join("");

    const reading = Hangul.formatReading(cue.ko, state.settings.readingMode);
    const readingHtml = reading ? `<div class="kls-overlay-reading">${escapeHtml(reading)}</div>` : "";
    const jaHtml = cue.ja ? `<div class="kls-overlay-ja">${escapeHtml(cue.ja)}</div>` : "";

    overlay.innerHTML = `<div class="kls-overlay-ko">${wordButtons}</div>${readingHtml}${jaHtml}`;
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
      meaning: analysis.meaning || "",
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
    const readingAll = `[${p.pronouncedHangul}] · ${p.katakana} · ${p.romanized}`;
    const rulesHtml = (p.appliedRules || [])
      .map((r) => `<span class="kls-badge is-accent">${escapeHtml(r)}</span>`)
      .join("");
    const saved = Boolean(state.savedCards[analysis.clean]);

    pop.innerHTML = `
      <div class="kls-pop-head">
        <div>
          <div class="kls-pop-word">${escapeHtml(analysis.clean)}</div>
          <div class="kls-pop-reading">${escapeHtml(readingAll)}</div>
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
        <div class="kls-pop-box">
          <div class="kls-pop-label">意味</div>
          <div class="kls-pop-val">${escapeHtml(analysis.meaning || "意味メモなし")}</div>
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
    const popH = 270;
    const preferAbove = anchorRect && anchorRect.top > popH + 20;
    const top = preferAbove
      ? Math.max(12, anchorRect.top - popH - 10)
      : Math.min(window.innerHeight - popH - 12, Math.max(12, (anchorRect?.bottom || 120) + 8));
    const left = Math.min(window.innerWidth - 375, Math.max(12, anchorRect?.left || 24));
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;

    pop.querySelector('[data-pop="close"]').onclick = () => pop.classList.add("kls-hidden");
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

  function renderDock() {
    const dock = ensureDock();
    if (!dock) return;
    if (!state.settings.enabled) {
      dock.classList.add("kls-hidden");
      return;
    }
    dock.classList.remove("kls-hidden");

    const cov = Dict.computeVocabularyStats(state.cues, state.savedCards);
    const speed = SPEED_STEPS[state.speedIdx];
    const readLabel = getReadingLabel(state.settings.readingMode);

    const linesHtml = state.cues.length
      ? state.cues
          .map((c, idx) => {
            const cur = idx === state.activeCueIdx;
            const read = Hangul.formatReading(c.ko, state.settings.readingMode);
            const rep = c.repeatTotal > 1 ? `<span class="kls-badge is-accent">${c.repeatIndex}/${c.repeatTotal}</span>` : "";
            return `
              <button type="button" class="kls-line-row${cur ? " is-current" : ""}" data-cue-idx="${idx}">
                <div class="kls-line-meta">
                  <span>${formatSec(c.start)}</span>
                  ${rep}
                </div>
                <div class="kls-line-ko">${escapeHtml(c.ko)}</div>
                ${read ? `<div class="kls-line-read">${escapeHtml(read)}</div>` : ""}
                ${c.ja ? `<div class="kls-line-ja">${escapeHtml(c.ja)}</div>` : ""}
              </button>
            `;
          })
          .join("")
      : `<div class="kls-status-text" style="padding:10px;">韓国語字幕・同期歌詞を読み込み中、または「歌詞・LRC貼付」から手入力できます。</div>`;

    dock.innerHTML = `
      <div class="kls-dock-head">
        <div class="kls-brand">${ICONS.music}<span>K-Lyric Studio</span></div>
        <span class="kls-status-text">${escapeHtml(state.sourceLabel)} ・ ${state.cues.length}行</span>
      </div>
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
        applyCuesWithOffset();
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
      row.onclick = () => {
        const idx = Number(row.getAttribute("data-cue-idx"));
        const cue = state.cues[idx];
        if (!cue) return;
        if (state.videoEl) {
          state.videoEl.currentTime = cue.start;
          if (state.videoEl.paused) state.videoEl.play();
        }
        state.activeCueIdx = idx;
        renderOverlay(cue);
        renderDock();
      };
    });
  }

  function syncToCurrentTime() {
    const v = state.videoEl || findVideoElement();
    if (!v || !state.cues.length) {
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
        const curEl = state.dockEl.querySelector(".kls-line-row.is-current");
        if (curEl && typeof curEl.scrollIntoView === "function") {
          curEl.scrollIntoView({ block: "nearest" });
        }
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

  async function loadSubtitlesForMeta(force = false) {
    const key = `${state.meta.videoId}|${state.meta.title}`;
    if (!force && key && key === state.lastLoadedKey && state.cues.length) return;
    state.lastLoadedKey = key;

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
        const merged = Hangul.mergeDualSubtitles(koCues, jaCues);
        if (merged.length) {
          state.rawCues = merged;
          state.offsetSec = 0;
          state.sourceLabel = "YouTube字幕";
          applyCuesWithOffset();
          return;
        }
      }
    }

    // 2. Try LRCLIB synced lyrics using cleaned title & author
    const query = Hangul.cleanTrackQuery(state.meta.title, state.meta.author);
    if (query) {
      const dur = state.videoEl && state.videoEl.duration ? state.videoEl.duration : 0;
      const lrcResp = await sendBg({ type: "kls:fetch-lrclib", query, duration: dur });
      if (lrcResp && lrcResp.ok && lrcResp.syncedLyrics) {
        const parsed = Hangul.parseLrc(lrcResp.syncedLyrics);
        if (parsed.length) {
          state.rawCues = parsed;
          state.offsetSec = 0;
          state.sourceLabel = "LRCLIB 同期歌詞";
          applyCuesWithOffset();
          return;
        }
      }
    }

    state.sourceLabel = "字幕未検出";
    renderDock();
  }

  function handleKeydown(e) {
    if (!state.settings.enabled || !state.settings.shortcutsEnabled) return;
    const tag = (e.target && e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;

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
    const stored = await storageGet(["settings", "savedCards"]);
    if (stored.settings) state.settings = { ...DEFAULT_SETTINGS, ...stored.settings };
    if (stored.savedCards && typeof stored.savedCards === "object") state.savedCards = stored.savedCards;
    if (initialMeta) state.meta = { ...state.meta, ...initialMeta };

    attachVideoListener();
    ensureDock();
    renderDock();

    window.addEventListener("message", (event) => {
      if (event.source !== window || !event.data || event.data.source !== "kls-page-hook") return;
      state.meta = { ...state.meta, ...event.data };
      attachVideoListener();
      ensureDock();
      loadSubtitlesForMeta(false);
    });

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
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

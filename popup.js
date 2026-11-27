(function () {
  const MODES = [
    { id: "hybrid", label: "併用(カナ+ローマ字)" },
    { id: "katakana", label: "カタカナ" },
    { id: "roman", label: "ローマ字" },
    { id: "hangul", label: "発音ハングル" },
    { id: "off", label: "オフ" }
  ];

  const DEFAULT_SETTINGS = {
    enabled: true,
    readingMode: "hybrid",
    theme: "system"
  };

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

  let settings = { ...DEFAULT_SETTINGS };
  let savedCards = {};
  let vocabLog = null;

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t || "system");
  }

  function openStudioPage(hash) {
    const page = hash ? `studio.html#${hash}` : "studio.html";
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL(page) });
    } else {
      location.href = page;
    }
  }

  function render() {
    applyTheme(settings.theme);
    const enBtn = document.getElementById("btn-enabled");
    const enLbl = document.getElementById("lbl-enabled");
    enBtn.classList.toggle("is-active", Boolean(settings.enabled));
    enLbl.textContent = settings.enabled ? "動作中" : "一時停止";

    const box = document.getElementById("reading-modes");
    box.innerHTML = "";
    for (const m of MODES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kls-btn" + (settings.readingMode === m.id ? " is-active" : "");
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span>${m.label}</span>`;
      b.onclick = async () => {
        settings.readingMode = m.id;
        await storageSet({ settings });
        render();
      };
      box.appendChild(b);
    }

    const list = Object.values(savedCards || {});
    const mastered = list.filter((c) => c.mastered).length;
    const due = list.filter((c) => window.KLyricSRS.isDue(c)).length;
    const total = list.length;
    document.getElementById("popup-stats-text").textContent = `登録 ${total} / 復習待ち ${due} / 習得 ${mastered}`;
    const mPct = total ? Math.round((mastered / total) * 100) : 0;
    const lPct = total ? Math.max(0, 100 - mPct) : 0;
    document.getElementById("bar-mastered").style.width = `${mPct}%`;
    document.getElementById("bar-learning").style.width = `${lPct}%`;

    const freqEl = document.getElementById("popup-freq-stats");
    if (freqEl) {
      const freqWords = Object.keys((vocabLog && vocabLog.words) || {}).length;
      const freqVideos = Object.keys((vocabLog && vocabLog.videos) || {}).length;
      if (freqWords > 0) {
        freqEl.textContent = `頻出単語帳: ${freqWords}語（${freqVideos}動画から記録）`;
        freqEl.classList.remove("kls-hidden");
      } else {
        freqEl.textContent = "";
        freqEl.classList.add("kls-hidden");
      }
    }
  }

  async function init() {
    const res = await storageGet(["settings", "savedCards", "vocabLog"]);
    if (res.settings) settings = { ...DEFAULT_SETTINGS, ...res.settings };
    if (res.savedCards) savedCards = res.savedCards;
    if (res.vocabLog && typeof res.vocabLog === "object") vocabLog = res.vocabLog;
    render();

    document.getElementById("btn-enabled").onclick = async () => {
      settings.enabled = !settings.enabled;
      await storageSet({ settings });
      render();
    };
    document.getElementById("btn-open-studio").onclick = () => openStudioPage("");
    document.getElementById("btn-open-freq").onclick = () => openStudioPage("freq");
    document.getElementById("btn-open-options").onclick = () => {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        location.href = "options.html";
      }
    };
  }

  init();
})();

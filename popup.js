(function () {
  const MODES = [
    {
      id: "hybrid",
      label: "併用(カナ+ローマ字)",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 12 12 17 22 12"></polyline><polyline points="2 17 12 22 22 17"></polyline></svg>`
    },
    {
      id: "katakana",
      label: "カタカナ",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>`
    },
    {
      id: "roman",
      label: "ローマ字",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`
    },
    {
      id: "hangul",
      label: "発音ハングル",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`
    },
    {
      id: "off",
      label: "オフ",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
    }
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
      b.innerHTML = `${m.icon}<span>${m.label}</span>`;
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
    const learning = total - mastered;

    const wordsMap = (vocabLog && vocabLog.words) || {};
    const freqList = Object.values(wordsMap);
    const freqWords = freqList.length;
    const freqVideos = Object.keys((vocabLog && vocabLog.videos) || {}).length;
    const unregistered = freqList.filter((w) => {
      if (!w || !w.key) return false;
      if (savedCards[w.key] || (w.surfaceSample && savedCards[w.surfaceSample])) return false;
      return !list.some((c) => c && (c.lemma === w.key || c.surface === w.key));
    }).length;

    document.getElementById("popup-stats-text").textContent = `既知 ${mastered} / 学習中 ${learning} / 復習待ち ${due}`;
    const denom = mastered + learning + unregistered;
    const mPct = denom ? Math.round((mastered / denom) * 100) : 0;
    const lPct = denom ? Math.round((learning / denom) * 100) : 0;
    const sPct = denom ? Math.max(0, 100 - mPct - lPct) : 0;
    document.getElementById("bar-mastered").style.width = `${mPct}%`;
    document.getElementById("bar-learning").style.width = `${lPct}%`;
    const seenBar = document.getElementById("bar-seen");
    if (seenBar) seenBar.style.width = `${sPct}%`;

    const freqEl = document.getElementById("popup-freq-stats");
    if (freqEl) {
      if (freqWords > 0) {
        freqEl.textContent = `既出単語: ${freqWords}語（${freqVideos}動画・未登録 ${unregistered}語）`;
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

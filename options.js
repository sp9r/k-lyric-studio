(function () {
  const DEFAULT_SETTINGS = {
    enabled: true,
    readingMode: "hybrid",
    theme: "system",
    autoPauseOnClick: true,
    shortcutsEnabled: true,
    enableBridge: false,
    bridgeUrl: "http://127.0.0.1:8788"
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

  function syncForm() {
    document.documentElement.setAttribute("data-theme", settings.theme || "system");
    document.getElementById("opt-theme").value = settings.theme || "system";
    document.getElementById("opt-reading").value = settings.readingMode || "hybrid";
    document.getElementById("opt-autopause").checked = Boolean(settings.autoPauseOnClick);
    document.getElementById("opt-shortcuts").checked = Boolean(settings.shortcutsEnabled);
    document.getElementById("opt-bridge").checked = Boolean(settings.enableBridge);
    document.getElementById("opt-bridge-url").value = settings.bridgeUrl || "http://127.0.0.1:8788";
  }

  async function save() {
    settings = {
      ...settings,
      theme: document.getElementById("opt-theme").value,
      readingMode: document.getElementById("opt-reading").value,
      autoPauseOnClick: document.getElementById("opt-autopause").checked,
      shortcutsEnabled: document.getElementById("opt-shortcuts").checked,
      enableBridge: document.getElementById("opt-bridge").checked,
      bridgeUrl: document.getElementById("opt-bridge-url").value.trim() || "http://127.0.0.1:8788"
    };
    await storageSet({ settings });
    document.documentElement.setAttribute("data-theme", settings.theme);
    document.getElementById("save-status").textContent = "設定を保存しました";
  }

  async function testBridge() {
    const statusEl = document.getElementById("bridge-status");
    const url = document.getElementById("opt-bridge-url").value.trim() || "http://127.0.0.1:8788";
    statusEl.textContent = "接続確認中...";
    try {
      const resp = await fetch(`${url.replace(/\/+$/, "")}/api/health`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      statusEl.textContent = `接続成功 (モデル: ${data.llmModel || "設定済み"})`;
    } catch (_) {
      statusEl.textContent = "接続できません（ブリッジ未起動またはURL不一致）";
    }
  }

  async function init() {
    const res = await storageGet(["settings"]);
    if (res.settings) settings = { ...DEFAULT_SETTINGS, ...res.settings };
    syncForm();

    document.getElementById("btn-save").onclick = save;
    document.getElementById("opt-theme").onchange = save;
    document.getElementById("btn-test-bridge").onclick = testBridge;
  }

  init();
})();

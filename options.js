(function () {
  const DEFAULT_SETTINGS = {
    enabled: true,
    readingMode: "hybrid",
    theme: "system",
    autoPauseOnClick: true,
    shortcutsEnabled: true,
    showTranslation: true,
    showOverlay: true,
    showHanja: true,
    showGloss: true,
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
    document.getElementById("opt-overlay").checked = settings.showOverlay !== false;
    document.getElementById("opt-hanja").checked = settings.showHanja !== false;
    document.getElementById("opt-gloss").checked = settings.showGloss !== false;
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
      showOverlay: document.getElementById("opt-overlay").checked,
      showHanja: document.getElementById("opt-hanja").checked,
      showGloss: document.getElementById("opt-gloss").checked,
      autoPauseOnClick: document.getElementById("opt-autopause").checked,
      shortcutsEnabled: document.getElementById("opt-shortcuts").checked,
      enableBridge: document.getElementById("opt-bridge").checked,
      bridgeUrl: document.getElementById("opt-bridge-url").value.trim() || "http://127.0.0.1:8788"
    };
    await storageSet({ settings });
    document.documentElement.setAttribute("data-theme", settings.theme);
    document.getElementById("save-status").textContent = "設定を保存しました";
  }

  const Act = window.KLyricActivation;
  let activation = Act.normalize(null);

  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';
  const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function ruleListHtml(key, listName, rules) {
    if (!rules.length) return '<div class="kls-muted">登録なし</div>';
    return '<ul class="kls-rule-list">' + rules.map((r, i) =>
      `<li class="kls-rule-item"><span title="${esc(Act.describeRule(r))}">${esc(Act.describeRule(r))}</span>` +
      `<button type="button" class="kls-btn" data-del="${key}|${listName}|${i}">${ICON_TRASH}<span>削除</span></button></li>`
    ).join("") + "</ul>";
  }

  function renderActivation() {
    const box = document.getElementById("activation-sites");
    box.innerHTML = ["youtube", "music"].map((key) => {
      const site = activation[key];
      const allowPart = site.mode === "whitelist"
        ? `<div class="kls-rule-head">表示するもの</div>${ruleListHtml(key, "allow", site.allow)}
           <div class="kls-add-row"><input class="kls-input" data-kw="${key}|allow" placeholder="キーワード（例: ILLIT）" />
           <button type="button" class="kls-btn" data-add="${key}|allow">${ICON_PLUS}<span>追加</span></button></div>`
        : "";
      return `<div class="kls-site-card">
        <h3>${Act.SITE_LABEL[key]}</h3>
        <select class="kls-select" data-mode="${key}">
          <option value="whitelist"${site.mode === "whitelist" ? " selected" : ""}>登録したものだけ表示</option>
          <option value="blacklist"${site.mode === "blacklist" ? " selected" : ""}>すべて表示（非表示の登録を除く）</option>
        </select>
        ${allowPart}
        <div class="kls-rule-head">非表示にするもの</div>${ruleListHtml(key, "block", site.block)}
        <div class="kls-add-row"><input class="kls-input" data-kw="${key}|block" placeholder="キーワード（例: Shorts）" />
        <button type="button" class="kls-btn" data-add="${key}|block">${ICON_PLUS}<span>追加</span></button></div>
      </div>`;
    }).join("");

    box.querySelectorAll("[data-mode]").forEach((sel) => {
      sel.onchange = () => {
        activation[sel.dataset.mode].mode = sel.value;
        saveActivation();
      };
    });
    box.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = () => {
        const [key, listName, i] = btn.dataset.del.split("|");
        activation = Act.removeRule(activation, key, listName, Number(i));
        saveActivation();
      };
    });
    box.querySelectorAll("[data-add]").forEach((btn) => {
      const input = box.querySelector(`[data-kw="${btn.dataset.add}"]`);
      const add = () => {
        const [key, listName] = btn.dataset.add.split("|");
        activation = Act.addKeyword(activation, key, listName, input.value);
        saveActivation();
      };
      btn.onclick = add;
      input.onkeydown = (e) => { if (e.key === "Enter") add(); };
    });
  }

  async function saveActivation() {
    await storageSet({ activation });
    renderActivation();
    document.getElementById("save-status").textContent = "表示する動画の設定を保存しました";
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
    const res = await storageGet(["settings", "activation"]);
    if (res.settings) settings = { ...DEFAULT_SETTINGS, ...res.settings };
    activation = Act.normalize(res.activation);
    syncForm();
    renderActivation();
    document.getElementById("opt-reading").onchange = save;
    document.getElementById("opt-overlay").onchange = save;
    document.getElementById("opt-hanja").onchange = save;
    document.getElementById("opt-gloss").onchange = save;
    document.getElementById("opt-autopause").onchange = save;
    document.getElementById("opt-shortcuts").onchange = save;
    document.getElementById("opt-bridge").onchange = save;

    document.getElementById("btn-save").onclick = save;
    document.getElementById("opt-theme").onchange = save;
    document.getElementById("btn-test-bridge").onclick = testBridge;
  }

  init();
})();

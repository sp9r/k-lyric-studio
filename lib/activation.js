// Decide whether K-Lyric shows on the current video.
// YouTube: only on registered channels / videos / title keywords (whitelist).
// YouTube Music: everywhere except registered channels / videos (blacklist).
// A block rule always wins, so a single video can be hidden even on an allowed channel.
(function (root) {
  const DEFAULT_ACTIVATION = {
    youtube: {
      mode: "whitelist",
      allow: [
        { type: "channel", id: "UCEpFoWeCMCo5z3EvWaz6hQQ", label: "ILLIT" },
        { type: "keyword", value: "ILLIT" },
        { type: "keyword", value: "아일릿" }
      ],
      block: []
    },
    music: { mode: "blacklist", allow: [], block: [] }
  };

  const SITE_LABEL = { youtube: "YouTube", music: "YouTube Music" };

  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  function siteKey(meta) {
    return meta && meta.isMusic ? "music" : "youtube";
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function getSite(activation, key) {
    const base = DEFAULT_ACTIVATION[key];
    const s = (activation && activation[key]) || {};
    return {
      mode: s.mode === "whitelist" || s.mode === "blacklist" ? s.mode : base.mode,
      allow: Array.isArray(s.allow) ? s.allow.slice() : clone(base.allow),
      block: Array.isArray(s.block) ? s.block.slice() : clone(base.block)
    };
  }

  function normalize(activation) {
    return { youtube: getSite(activation, "youtube"), music: getSite(activation, "music") };
  }

  function ruleMatches(rule, meta) {
    if (!rule || !meta) return false;
    if (rule.type === "video") return Boolean(meta.videoId) && rule.id === meta.videoId;
    if (rule.type === "channel") {
      if (rule.id && meta.channelId) return rule.id === meta.channelId;
      return Boolean(rule.label) && norm(rule.label) === norm(meta.author);
    }
    if (rule.type === "keyword") {
      const k = norm(rule.value);
      if (!k) return false;
      return norm(meta.title).includes(k) || norm(meta.author).includes(k);
    }
    return false;
  }

  function describeRule(rule) {
    if (!rule) return "";
    if (rule.type === "video") return `動画「${rule.label || rule.id}」`;
    if (rule.type === "channel") return `チャンネル「${rule.label || rule.id}」`;
    if (rule.type === "keyword") return `キーワード「${rule.value}」`;
    return "";
  }

  function evaluate(activation, meta) {
    const key = siteKey(meta);
    const site = getSite(activation, key);
    const base = { site: key, siteLabel: SITE_LABEL[key], mode: site.mode };
    if (!meta || !meta.videoId) {
      return { ...base, active: false, rule: null, reason: "動画を再生していません" };
    }
    const blocked = site.block.find((r) => ruleMatches(r, meta));
    if (blocked) {
      return { ...base, active: false, rule: blocked, reason: `${describeRule(blocked)}は非表示に設定` };
    }
    if (site.mode === "blacklist") {
      return { ...base, active: true, rule: null, reason: `${SITE_LABEL[key]}では常に表示` };
    }
    const allowed = site.allow.find((r) => ruleMatches(r, meta));
    if (allowed) {
      return { ...base, active: true, rule: allowed, reason: `${describeRule(allowed)}で表示` };
    }
    return { ...base, active: false, rule: null, reason: "登録したチャンネル・動画だけで表示" };
  }

  function ruleFor(type, meta) {
    if (type === "video") return { type: "video", id: meta.videoId, label: meta.title || meta.videoId };
    if (type === "channel") {
      const r = { type: "channel", label: meta.author || "" };
      if (meta.channelId) r.id = meta.channelId;
      return r;
    }
    return null;
  }

  function sameTarget(a, b) {
    if (!a || !b || a.type !== b.type) return false;
    if (a.type === "keyword") return norm(a.value) === norm(b.value);
    if (a.id && b.id) return a.id === b.id;
    return norm(a.label) === norm(b.label);
  }

  function addTo(list, rule) {
    return list.some((r) => sameTarget(r, rule)) ? list : list.concat([rule]);
  }

  // Show on this video / channel from now on.
  function allowHere(activation, meta, type) {
    const out = normalize(activation);
    const key = siteKey(meta);
    const rule = ruleFor(type, meta);
    if (!rule) return out;
    const site = out[key];
    // Anything blocking this video has to go, or the new allow rule would have no effect.
    site.block = site.block.filter((r) => !ruleMatches(r, meta));
    if (site.mode === "whitelist") site.allow = addTo(site.allow, rule);
    return out;
  }

  // Stop showing on this video / channel.
  function blockHere(activation, meta, type) {
    const out = normalize(activation);
    const key = siteKey(meta);
    const rule = ruleFor(type, meta);
    if (!rule) return out;
    const site = out[key];
    site.allow = site.allow.filter((r) => !sameTarget(r, rule));
    site.block = addTo(site.block, rule);
    return out;
  }

  function removeRule(activation, key, listName, index) {
    const out = normalize(activation);
    if (out[key] && Array.isArray(out[key][listName])) out[key][listName].splice(index, 1);
    return out;
  }

  function addKeyword(activation, key, listName, value) {
    const out = normalize(activation);
    const v = String(value || "").trim();
    if (!v || !out[key]) return out;
    out[key][listName] = addTo(out[key][listName], { type: "keyword", value: v });
    return out;
  }

  const api = {
    DEFAULT_ACTIVATION,
    SITE_LABEL,
    siteKey,
    normalize,
    ruleMatches,
    describeRule,
    evaluate,
    allowHere,
    blockHere,
    removeRule,
    addKeyword
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KLyricActivation = api;
})(typeof globalThis !== "undefined" ? globalThis : self);

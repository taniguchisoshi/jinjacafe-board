/**
 * スプレッドシートに紐づいたプロジェクトでも、独立したプロジェクト（StoreSeed.gs の SHEET_ID を使う）でも動きます。
 *
 * 返信ボード API（Google Apps Script）
 * - 画面は GitHub Pages（github-pages/index.html）。ここは JSON を返す API だけです。
 * - 店ごとの値（店名・色・媒体・URL・通知先・トーン）はコードに書かず、config シートから読みます。
 * - 鍵：k＝ボード用（URL の ?k=）、token＝Claude 用（apiToken）。どちらも setup() が作ります。
 * - HTTP の状態コードは返せないので、結果は本文の {ok, code, error} で返します（401/403/404/409 など）。
 */

const SHEETS = {
  items: ["id", "source", "author", "authorId", "authorUrl", "rating", "commentDate", "comment", "postUrl", "postTitle",
    "draft", "note", "isFollowup", "thread", "blockSuggest", "blockReason", "status", "finalText", "edited",
    "requestedAt", "requestedBy", "doneAt", "doneBy", "repliedBy", "blockLevel", "error", "createdAt", "version"],
  blocks: ["id", "key", "source", "author", "authorId", "authorUrl", "postUrl", "level", "status", "reason", "fromItem",
    "requestedAt", "requestedBy", "doneAt", "error", "version"],
};
const BOOL_FIELDS = { items: ["isFollowup", "blockSuggest", "edited"], blocks: [] };
const JSON_FIELDS = { items: ["thread"], blocks: [] };
const NUM_FIELDS = { items: ["rating", "version"], blocks: ["version"] };
const SORT_FIELD = { items: "createdAt", blocks: "requestedAt" };

const CONFIG_SHEET = "config";
const CONFIG_HEADER = ["key", "value", "説明"];
// [key, 説明]。並びは config シートの行の順番になります。
const CONFIG_KEYS = [
  ["storeName", "店名（画面の見出し「◯◯ 返信ボード」と通知に使います）"],
  ["storeFullName", "店の正式名（返信文・通知に使います）"],
  ["logoUrl", "見出しのロゴ画像のURL（空なら GitHub Pages の apple-touch-icon.png を使います）"],
  ["themeColor", "テーマ色（#RRGGBB）"],
  ["sources", "使う媒体の一覧（JSON配列）。name＝表示名、code＝略号、bg/fg＝タブの色、url＝Claudeが見るページ"],
  ["slackChannelId", "Slack の通知先チャンネルID"],
  ["slackChannelName", "Slack の通知先チャンネル名"],
  ["tone", "返信の口調の手本（複数行）"],
  ["facts", "店の確定している事実（Claudeが返信に使います。書いていないことは返信に書きません）"],
  ["rules", "返信に書かないこと"],
  ["mailSignature", "メールの返信の署名"],
  ["pageUrl", "GitHub Pages のURL（ボードを開くと自動で入ります）"],
  ["boardUrl", "ボードのURL（自動。この行のURLをお店の人に送ります）"],
  ["boardKey", "ボードの鍵（自動。変えるときは resetBoardKey() を実行）"],
  ["apiToken", "Claude 用の鍵（自動。お店の人には見せません）"],
  ["patrol", "Claude の巡回記録（Claude が書きます）"],
  ["sheetId", "このスプレッドシートのID（自動。コピーを見分けるのに使います）"],
];
const SECRET_KEYS = ["boardKey", "apiToken"];
// 店に関係しない、媒体の名前と色だけの初期値（StoreSeed.gs が無いときに使います）
const DEFAULT_SOURCES = [
  { name: "Google口コミ", code: "g", bg: "#e8f0fe", fg: "#1a56c4" },
  { name: "Instagram", code: "ig", bg: "#fde7f0", fg: "#b5236b" },
  { name: "Facebook", code: "fb", bg: "#e7eefb", fg: "#1b4fb3" },
  { name: "TikTok", code: "tt", bg: "#e6f7f8", fg: "#0d7a86" },
  { name: "YouTube", code: "yt", bg: "#fde8e6", fg: "#b3261e" },
  { name: "メール", code: "ml", bg: "#efe8f8", fg: "#5b2d9c" },
  { name: "LINE", code: "ln", bg: "#e4f5e8", fg: "#1f7a3a" },
];
const DEFAULTS = { storeName: "", themeColor: "#E43426", sources: DEFAULT_SOURCES };

const LOCKED_MSG = "このリンクでは開けません。谷口さんにリンクをもらってください";

// ───────── 入口 ─────────

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    const role = auth_(p.k, p.token);
    if (!p.api) return role ? json_({ ok: true, message: "返信ボードの API です。画面は GitHub Pages のURLで開いてください。" }) : text_(LOCKED_MSG);
    if (!role) return json_(err_(401, LOCKED_MSG));
    switch (p.api) {
      case "list":
        if (!SHEETS[p.col]) return json_(err_(400, "col は items か blocks です。config は api=get で読みます。"));
        return json_({ ok: true, rows: list_(p.col, p.limit) });
      case "get":
        return json_(getConfig_(p.col, p.key, role));
      case "board":
        return json_({ ok: true, items: list_("items", p.limit), blocks: list_("blocks", 2000), config: configOut_(role) });
      default:
        return json_(err_(400, "api が違います：" + p.api));
    }
  } catch (x) {
    return json_(err_(500, String((x && x.message) || x)));
  }
}

function doPost(e) {
  let b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (x) { return json_(err_(400, "JSON が読めません")); }
  const role = auth_(b.k, b.token);
  if (!role) return json_(err_(401, LOCKED_MSG));
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_(err_(503, "混み合っています。少し待ってからもう一度押してください。"));
  try {
    switch (b.api) {
      case "set":
        return json_(single_(applyWrites_([{ op: "set", col: b.col, id: b.id, data: b.data }], role)));
      case "update":
        return json_(single_(applyWrites_([{ op: "update", col: b.col, id: b.id, data: b.data, ifVersion: b.ifVersion }], role)));
      case "delete":
        return json_(single_(applyWrites_([{ op: "delete", col: b.col, id: b.id }], role)));
      case "batch":
        return json_(applyWrites_(b.writes, role));
      case "setConfig":
        if (role !== "claude") return json_(err_(403, "設定を書き換えられるのは Claude の鍵だけです。"));
        if (!b.key || CONFIG_KEYS.every(c => c[0] !== b.key) && !/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(b.key)) return json_(err_(400, "key が違います"));
        if (SECRET_KEYS.indexOf(b.key) >= 0 || b.key === "sheetId" || b.key === "boardUrl") return json_(err_(403, "この key は API からは変えられません：" + b.key));
        setConfig_(b.key, b.value);
        if (b.key === "pageUrl") refreshBoardUrl_();
        return json_({ ok: true, key: b.key });
      case "hello":
        return json_(hello_(b.page));
      default:
        return json_(err_(400, "api が違います：" + b.api));
    }
  } catch (x) {
    return json_(err_(500, String((x && x.message) || x)));
  } finally {
    lock.releaseLock();
  }
}

// ───────── 準備（谷口さんが1回だけ実行） ─────────

function setup() {
  const ss = ss_();
  if (!ss) throw new Error("スプレッドシートの「拡張機能 → Apps Script」から開いたプロジェクトで実行してください。");
  ensureSheet_("items");
  ensureSheet_("blocks");
  ensureConfigSheet_();

  const cfg = readConfig_();
  const isCopy = !!cfg.sheetId && cfg.sheetId !== ss.getId();
  if (isCopy) { clearRows_("items"); clearRows_("blocks"); }

  const seed = (typeof STORE_SEED === "object" && STORE_SEED) ? STORE_SEED : {};
  CONFIG_KEYS.forEach(([key, note]) => {
    let v = cfg[key];
    if (key === "boardKey" || key === "apiToken") { if (!v || isCopy) v = randomKey_(); }
    else if (key === "sheetId") v = ss.getId();
    else if (key === "patrol") { if (!v || isCopy) v = { lastRun: "", status: "まだ巡回していません", newCount: 0, skippedCount: 0, emojiCount: 0, postedCount: 0, blockedCount: 0, failedCount: 0 }; }
    else if (key === "pageUrl" && isCopy) v = "";
    else if (key === "boardUrl") v = cfg.boardUrl || "";
    else if (v === undefined || v === "") v = seed[key] !== undefined ? seed[key] : (DEFAULTS[key] !== undefined ? DEFAULTS[key] : "");
    setConfig_(key, v, note);
  });
  refreshBoardUrl_();

  ["シート1", "Sheet1"].forEach(n => {
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  const c = readConfig_();
  console.log([
    isCopy ? "コピーされたスプレッドシートとして準備しました（コメントとブロックを空にし、鍵を作り直しました）。" : "準備ができました。",
    "",
    "ボードのURL（お店の人にLINEで送ります）：",
    c.boardUrl || "（pageUrl が空です。GitHub Pages を ON にしてボードを開くと自動で入ります）",
    "",
    "Claude に渡す apiToken：",
    c.apiToken,
    "",
    "この2つは config シートの boardUrl・apiToken の行にも入っています。",
    "次は「デプロイ → 新しいデプロイ」です（SETUP.md の手順4）。",
  ].join("\n"));
}

/** ボードのURLを作り直します（URLが漏れたときだけ。古いURLは開けなくなります）。 */
function resetBoardKey() {
  setConfig_("boardKey", randomKey_());
  refreshBoardUrl_();
  console.log("新しいボードのURL：\n" + readConfig_().boardUrl + "\n古いURLはもう開けません。お店の人に送り直してください。");
}

// ───────── 読み書き ─────────

function list_(col, limit) {
  const n = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 2000);
  const t = loadTable_(col);
  const f = SORT_FIELD[col];
  return Object.keys(t.byId).map(id => rowOut_(col, t.byId[id].obj))
    .sort((a, b) => String(b[f] || "").localeCompare(String(a[f] || "")))
    .slice(0, n);
}

/** writes を全部確かめてから書きます。1つでもだめなら何も書きません（呼び出し側でロック済み）。 */
function applyWrites_(writes, role) {
  if (!Array.isArray(writes) || !writes.length) return err_(400, "writes が空です");
  if (writes.length > 200) return err_(400, "1回に書けるのは200件までです");
  const tables = {};
  const touched = [];
  const now = new Date().toISOString();
  for (let i = 0; i < writes.length; i++) {
    const w = writes[i] || {};
    if (!SHEETS[w.col]) return err_(400, "col は items か blocks です：" + w.col, { index: i });
    if (w.op === "delete" && role !== "claude") return err_(403, "消せるのは Claude の鍵だけです。", { index: i });
    if (["set", "update", "delete"].indexOf(w.op) < 0) return err_(400, "op が違います：" + w.op, { index: i });
    const id = String(w.id || "").trim();
    if (!id || id.length > 200) return err_(400, "id がありません", { index: i });
    const data = cleanData_(w.data);
    if (data.error) return err_(400, data.error, { index: i, id: id });
    const t = tables[w.col] || (tables[w.col] = loadTable_(w.col));
    const cur = t.byId[id];
    if (w.op === "set") {
      if (cur && !cur.deleted) return err_(409, "同じ id がもうあります：" + id, { index: i, id: id, current: rowOut_(w.col, cur.obj) });
      const obj = Object.assign({}, data.fields, { id: id, version: 1 });
      if (w.col === "items" && !obj.createdAt) obj.createdAt = now;
      t.byId[id] = { row: null, obj: obj, added: true };
    } else if (w.op === "update") {
      if (!cur || cur.deleted) return err_(404, "見つかりません：" + id, { index: i, id: id });
      if (w.ifVersion === undefined || w.ifVersion === null || w.ifVersion === "") return err_(400, "ifVersion がありません", { index: i, id: id });
      const v = Number(cur.obj.version) || 0;
      if (v !== Number(w.ifVersion)) return err_(409, "ほかの人が先に書き換えました", { index: i, id: id, current: rowOut_(w.col, cur.obj) });
      cur.obj = Object.assign({}, cur.obj, data.fields, { id: id, version: v + 1 });
      cur.changed = true;
    } else {
      if (!cur || cur.deleted) return err_(404, "見つかりません：" + id, { index: i, id: id });
      cur.deleted = true;
    }
    touched.push({ col: w.col, id: id });
  }
  Object.keys(tables).forEach(col => commitTable_(tables[col]));
  return {
    ok: true,
    results: touched.map(x => {
      const r = tables[x.col].byId[x.id];
      return r.deleted ? { col: x.col, id: x.id, deleted: true } : { col: x.col, id: x.id, version: Number(r.obj.version), row: rowOut_(x.col, r.obj) };
    }),
  };
}

function single_(res) {
  if (!res.ok) return res;
  return Object.assign({ ok: true }, res.results[0]);
}

function cleanData_(data) {
  if (data === undefined || data === null) return { fields: {} };
  if (typeof data !== "object" || Array.isArray(data)) return { error: "data はオブジェクトで送ってください" };
  const fields = {};
  for (const k of Object.keys(data)) {
    if (k === "id" || k === "version") continue;
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) return { error: "項目名が違います：" + k };
    fields[k] = toText_(data[k]); // シートから読んだ行と同じ「文字」の形にそろえます
  }
  return { fields: fields };
}

function loadTable_(col) {
  const sheet = ensureSheet_(col);
  const values = sheet.getDataRange().getDisplayValues();
  const header = values[0].map(String);
  const byId = {};
  for (let r = 1; r < values.length; r++) {
    const obj = {};
    header.forEach((h, c) => { if (h) obj[h] = cellIn_(values[r][c]); });
    const id = String(obj.id || "").trim();
    if (id) byId[id] = { row: r + 1, obj: obj };
  }
  return { col: col, sheet: sheet, header: header, byId: byId };
}

function commitTable_(t) {
  const sheet = t.sheet;
  const recs = Object.keys(t.byId).map(id => t.byId[id]);
  // 新しい項目名が来たら列を足します（店ごとの拡張用）
  const extra = [];
  recs.forEach(r => { if (r.added || r.changed) Object.keys(r.obj).forEach(k => { if (t.header.indexOf(k) < 0 && extra.indexOf(k) < 0) extra.push(k); }); });
  if (extra.length) {
    const start = t.header.length + 1;
    if (sheet.getMaxColumns() < start + extra.length - 1) sheet.insertColumnsAfter(sheet.getMaxColumns(), start + extra.length - 1 - sheet.getMaxColumns());
    sheet.getRange(1, start, 1, extra.length).setValues([extra]);
    t.header = t.header.concat(extra);
  }
  const width = t.header.length;
  const toRow = obj => t.header.map(h => cellOut_(obj[h]));
  recs.filter(r => r.changed && !r.deleted && r.row).forEach(r => writeRows_(sheet, r.row, [toRow(r.obj)], width));
  const added = recs.filter(r => r.added && !r.deleted);
  if (added.length) writeRows_(sheet, sheet.getLastRow() + 1, added.map(r => toRow(r.obj)), width);
  recs.filter(r => r.deleted && r.row).map(r => r.row).sort((a, b) => b - a).forEach(row => sheet.deleteRow(row));
}

function writeRows_(sheet, row, rows, width) {
  const range = sheet.getRange(row, 1, rows.length, width);
  range.setNumberFormat("@");
  range.setValues(rows);
}

// 書くとき：すべて文字にします（日付や数字に化けないように、列は書式「書式なしテキスト」）。
function toText_(v) {
  if (v === undefined || v === null) return "";
  if (v === true) return "TRUE";
  if (v === false) return "FALSE";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function cellOut_(v) {
  const s = toText_(v);
  return s.charAt(0) === "=" ? "'" + s : s; // 数式として読まれないように
}

function cellIn_(s) {
  s = String(s);
  return s.indexOf("'=") === 0 ? s.slice(1) : s;
}

// 読むとき：型を戻します（TRUE/FALSE→真偽、thread→配列、version・rating→数）。
function rowOut_(col, obj) {
  const o = Object.assign({}, obj);
  BOOL_FIELDS[col].forEach(k => { o[k] = String(o[k] || "").toUpperCase() === "TRUE"; });
  JSON_FIELDS[col].forEach(k => {
    const s = String(o[k] || "").trim();
    if (!s) { o[k] = []; return; }
    try { o[k] = JSON.parse(s); } catch (x) { o[k] = []; }
  });
  NUM_FIELDS[col].forEach(k => {
    const s = String(o[k] === undefined ? "" : o[k]).trim();
    if (k === "version") o[k] = Number(s) || 0;
    else if (s === "") o[k] = "";
    else if (!isNaN(Number(s))) o[k] = Number(s);
  });
  return o;
}

// ───────── config ─────────

function readConfig_() {
  const sheet = ss_().getSheetByName(CONFIG_SHEET);
  const out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues().forEach(r => {
    const k = String(r[0]).trim();
    if (k) out[k] = cellIn_(r[1]);
  });
  return out;
}

function parseConfigValue_(s) {
  const t = String(s || "").trim();
  if (t.charAt(0) === "{" || t.charAt(0) === "[") { try { return JSON.parse(t); } catch (x) { return s; } }
  return s;
}

/** board（k）には鍵を見せません。Claude（token）には全部返します。 */
function configOut_(role) {
  const raw = readConfig_();
  const out = {};
  Object.keys(raw).forEach(k => {
    if (role !== "claude" && SECRET_KEYS.indexOf(k) >= 0) return;
    out[k] = parseConfigValue_(raw[k]);
  });
  return out;
}

function getConfig_(col, key, role) {
  if (col !== CONFIG_SHEET) return err_(400, "col=config で読みます");
  if (!key || key === "all") return { ok: true, config: configOut_(role) };
  if (role !== "claude" && SECRET_KEYS.indexOf(key) >= 0) return err_(403, "この key は読めません");
  const raw = readConfig_();
  if (!(key in raw)) return err_(404, "key がありません：" + key);
  return { ok: true, key: key, value: parseConfigValue_(raw[key]) };
}

function setConfig_(key, value, note) {
  const sheet = ensureConfigSheet_();
  const last = sheet.getLastRow();
  const keys = last >= 2 ? sheet.getRange(2, 1, last - 1, 1).getDisplayValues().map(r => String(r[0]).trim()) : [];
  let row = keys.indexOf(key) + 2;
  if (row < 2) row = last + 1;
  const range = sheet.getRange(row, 1, 1, 3);
  range.setNumberFormat("@");
  const cur = range.getDisplayValues()[0];
  range.setValues([[key, cellOut_(value), note !== undefined ? note : cur[2]]]);
}

function refreshBoardUrl_() {
  const c = readConfig_();
  const page = String(c.pageUrl || "").trim();
  setConfig_("boardUrl", page && c.boardKey ? page + (page.indexOf("?") >= 0 ? "&" : "?") + "k=" + c.boardKey : "");
}

/** ボードの画面が開かれたとき、その場所（GitHub Pages のURL）を config に残します。Slack のリンクに使います。 */
function hello_(page) {
  page = String(page || "").trim();
  if (!/^https:\/\/[^\s?#]+$/.test(page)) return err_(400, "page が違います");
  if (readConfig_().pageUrl !== page) { setConfig_("pageUrl", page); refreshBoardUrl_(); }
  return { ok: true };
}

// ───────── シート ─────────

function ensureSheet_(col) {
  const ss = ss_();
  let sheet = ss.getSheetByName(col);
  if (!sheet) sheet = ss.insertSheet(col);
  const want = SHEETS[col];
  const lastCol = sheet.getLastColumn();
  const header = lastCol ? sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(String) : [];
  const missing = want.filter(h => header.indexOf(h) < 0);
  if (missing.length) {
    const start = header.length + 1;
    if (sheet.getMaxColumns() < start + missing.length - 1) sheet.insertColumnsAfter(sheet.getMaxColumns(), start + missing.length - 1 - sheet.getMaxColumns());
    sheet.getRange(1, 1, sheet.getMaxRows(), start + missing.length - 1).setNumberFormat("@");
    sheet.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureConfigSheet_() {
  const ss = ss_();
  let sheet = ss.getSheetByName(CONFIG_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG_SHEET);
  if (sheet.getRange(1, 1).getDisplayValue() !== "key") {
    sheet.getRange(1, 1, 1, 3).setValues([CONFIG_HEADER]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 140);
    sheet.setColumnWidth(2, 420);
    sheet.setColumnWidth(3, 420);
  }
  return sheet;
}

function clearRows_(col) {
  const sheet = ensureSheet_(col);
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
}

// ───────── 小物 ─────────

function auth_(k, token) {
  const c = readConfig_();
  if (token && c.apiToken && same_(String(token), c.apiToken)) return "claude";
  if (k && c.boardKey && same_(String(k), c.boardKey)) return "board";
  return null;
}

function same_(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function randomKey_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
}

function err_(code, error, extra) {
  return Object.assign({ ok: false, code: code, error: error }, extra || {});
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function text_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}

/** スプレッドシート本体。紐づいたプロジェクトならそれ、独立したプロジェクトなら StoreSeed.gs の SHEET_ID で開きます。 */
function ss_() {
  const a = SpreadsheetApp.getActiveSpreadsheet();
  if (a) return a;
  const id = (typeof SHEET_ID === "string" && SHEET_ID) ? SHEET_ID : (PropertiesService.getScriptProperties().getProperty("SHEET_ID") || "");
  if (!id) throw new Error("スプレッドシートが見つかりません。StoreSeed.gs の SHEET_ID にスプレッドシートのIDを入れてください。");
  return SpreadsheetApp.openById(id);
}

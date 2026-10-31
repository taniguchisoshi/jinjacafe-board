/** このスプレッドシートのID（URLの /d/ と /edit の間）。シートに紐づかないプロジェクトで動かすときに使います。 */
const SHEET_ID = "1gbWOOKZ8GD_fOCJGs2LFME2SZyOnMgWS7sVUPTg1BYE";

/**
 * この店（神社カフェ）の初期値。
 * setup() が config シートの「空いている行」にだけ入れます。入れたあとは config シートが正本です。
 * 2店目以降はこのファイルを使わず、コピーしたスプレッドシートの config シートを書き換えます（SETUP.md）。
 */
const STORE_SEED = {
  storeName: "神社カフェ",
  storeFullName: "神社カフェ 薩摩瀬神宮店（熊本県人吉市）",
  themeColor: "#E43426",
  logoUrl: "",
  pageUrl: "https://taniguchisoshi.github.io/jinjacafe-board/",
  slackChannelId: "C0CDP1PE4UE",
  slackChannelName: "神社カフェ-返信通知",
  mailSignature: "神社カフェ 薩摩瀬神宮店 マナツ",
  sources: [
    { name: "Google口コミ", code: "g", bg: "#e8f0fe", fg: "#1a56c4", url: "https://www.google.com/local/business/u/1/10911005129153228913/customers/reviews?hl=ja" },
    { name: "Instagram", code: "ig", bg: "#fde7f0", fg: "#b5236b", account: "jinjacafe1123", url: "https://www.instagram.com/jinjacafe1123/" },
    { name: "Facebook", code: "fb", bg: "#e7eefb", fg: "#1b4fb3", account: "jinjacafe1123", url: "https://www.facebook.com/jinjacafe1123", inboxUrl: "https://www.facebook.com/professional_dashboard/engagement/comments_manager/" },
    { name: "TikTok", code: "tt", bg: "#e6f7f8", fg: "#0d7a86", account: "jinjacafe1123", url: "https://www.tiktok.com/@jinjacafe1123" },
    { name: "YouTube", code: "yt", bg: "#fde8e6", fg: "#b3261e", url: "https://studio.youtube.com/channel/UCTTv0w5SuFLr2yCyjoARlSQ/comments/inbox" },
    { name: "ホトカミ", code: "ho", bg: "#eef2e4", fg: "#4f6b1f", url: "https://hotokami.jp/prayers/142962/" },
    { name: "おまいり", code: "om", bg: "#eef2e4", fg: "#4f6b1f", url: "https://omairi.club/spots/140594" },
    { name: "メール", code: "ml", bg: "#efe8f8", fg: "#5b2d9c", url: "https://mail.google.com/mail/u/1/#inbox" },
  ],
  facts: [
    "2026年11月23日（月・祝）オープン",
    "営業日は土日祝",
    "場所は薩摩瀬神宮の拝殿の中",
    "駐車場は村口米穀店さんの駐車場（雨の日は夢マート）",
    "御朱印とご縁のしるしを扱う",
    "通称「高千穂（たかっちょ）さん」",
    "予約は公式LINEから",
    "11月1日（日）10:00~15:00 拝殿の拭き上げボランティア",
    "営業時間・メニュー・価格は確定していないので書かない",
  ].join("\n"),
  rules: [
    "店長の本名（松井）を書かない",
    "『夏目友人帳』の作品名やキャラクター名を書かない",
    "クラウドファンディングの話を書かない",
    "全角の波線は使わず、時間の範囲は半角の「~」で書く",
    "「正直に」などの前置きをしない",
    "Instagram は「@名前 さま」で始める。TikTok・Facebook は宛名なし",
    "絵文字は文末に1~3個。1~3文で書く",
  ].join("\n"),
  tone: "", // 旧ボード（Claude版）の config/tone を Claude が API の setConfig で写します（SETUP.md）
};

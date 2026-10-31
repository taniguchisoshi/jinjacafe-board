デプロイURL：https://script.google.com/macros/s/AKfycbxWlyQBpNFqt4cv-YqEqZh3zH_S58TE1ry_ZUyfPLTUzKTCE_BhukwiDVdrpQunyJWQ/exec

# 返信ボード（Apps Script＋GitHub Pages 版）のつくり方

- 画面：GitHub Pages（`github-pages/` フォルダの中身）。ホーム画面のアイコンが店のロゴになります。
- データとAPI：Googleスプレッドシート＋Apps Script（`Code.gs`・`StoreSeed.gs`）。
- 鍵：ボードのURLの `?k=` だけ。暗証番号・ログインはありません。URLを知っている人だけ開けます。
- 「投稿」を押すと、Claude が1時間以内に投稿します。

谷口さんの作業は下の1~5だけです。設定の手打ちはありません。

---

## 1. スプレッドシートを作る
1. 神社カフェのGoogleアカウント（satsumase.jinjacafe@gmail.com）で https://sheets.new を開きます。
2. 左上の名前を「神社カフェ 返信ボード」にします。

## 2. Apps Script に2ファイル貼る
1. メニューの「拡張機能 → Apps Script」を押します。
2. 最初からある `コード.gs` の中身を全部消し、このフォルダの `Code.gs` の中身を貼ります。
3. 左の「ファイル」の横の ＋ →「スクリプト」を押し、名前を `StoreSeed` にして、このフォルダの `StoreSeed.gs` の中身を貼ります。
4. 💾（保存）を押します。

## 3. setup() を1回実行する
1. 上の関数の選択欄で `setup` を選び、「実行」を押します。
2. 「承認が必要です」→「権限を確認」→ 神社カフェのアカウントを選ぶ →「詳細」→「（安全ではないページ）に移動」→「許可」。
   （このスプレッドシートだけを読み書きする許可です）
3. 下の実行ログに次の2つが出ます。スプレッドシートの `config` シートにも入っています。
   - **ボードのURL**（`https://taniguchisoshi.github.io/jinjacafe-board/?k=…`）
   - **apiToken**（Claude 用）

## 4. デプロイする
1. 右上の「デプロイ → 新しいデプロイ」を押します。
2. 歯車 →「ウェブアプリ」を選びます。
3. 「次のユーザーとして実行：自分」「アクセスできるユーザー：全員」にして「デプロイ」。
4. 出てきた「ウェブアプリのURL」（`https://script.google.com/macros/s/…/exec`）をコピーし、このファイルの1行目「デプロイURL：」のうしろに貼ります。
5. Claude のチャットに「返信ボードをデプロイした」と書いて、デプロイURLと apiToken を貼ります（Claude が巡回の設定に入れます）。

## 5. GitHub Pages に画面を置く（初回だけ）
1. https://github.com/new を開き、谷口さんのアカウントで次のとおり作ります。
   - Repository name：`jinjacafe-board`
   - Public（公開）を選ぶ（画面のファイルは見えますが、鍵が無いとデータは読めません）
   - 「Create repository」
2. 出てきた画面の「uploading an existing file」を押し、このフォルダの **`github-pages` の中身（6ファイル）** をまとめてドラッグして「Commit changes」。
   - `index.html`・`config.js`・`manifest.webmanifest`・`apple-touch-icon.png`・`icon-192.png`・`icon-512.png`
3. リポジトリの `config.js` を開き、✏（編集）を押して、`window.BOARD_API = "";` の `""` の中に手順4のデプロイURLを貼り、「Commit changes」。
4. リポジトリの「Settings → Pages」を開き、「Branch」を `main`・`/ (root)` にして「Save」。1~2分待ちます。
5. 手順3の **ボードのURL** を開いて、ボードが出れば完了です。このURLをマナツさんにLINEで送ります。
   - スマホでは、開いたあとに Safari の共有ボタン →「ホーム画面に追加」。神社カフェのロゴのアイコンになります。

---

## 動作確認（Claude がやります）
谷口さんの作業はありません。Claude が次のとおり確かめます。
1. API に apiToken でダミーを1件入れる（`set`）。
2. 内蔵ブラウザでボードのURLを開き、ダミーの「投稿しない」→「投稿しない」まで押す。
3. ダミーを消す（`delete`）。
4. Apps Script の「実行数」にエラーが無いことを確かめる。

## 旧ボード（Claude版）からの引っ越し（Claude がやります）
- 旧ボードの items・blocks を API の `batch` で写します（id・項目名はそのまま）。
- 旧ボードの config/tone を `setConfig`（key：`tone`）で写します。
- 巡回の指示文（patrol_prompt.txt）を、ArtifactData から この API を読む形に書き換えます。Slack の通知に入れるボードのリンクは config の `boardUrl` を使います。

---

## 困ったとき
| 出たもの | 原因と直し方 |
|---|---|
| 「このリンクでは開けません。…」 | URLの `?k=` が違うか、切れています。config シートの `boardUrl` の行のURLを開き直します。 |
| 「読み込めませんでした」 | デプロイの「アクセスできるユーザー」が「全員」になっているか、`config.js` のURLが手順4のURLと同じかを確かめます。 |
| 「まだ準備中です」 | `config.js` にURLが入っていません（手順5の3）。 |
| Code.gs を直したのに変わらない | 「デプロイ → デプロイを管理 → ✏ → バージョン：新バージョン → デプロイ」。URLは変わりません。 |
| ボードのURLが外に漏れた | Apps Script で `resetBoardKey` を選んで実行し、ログに出た新しいURLを送り直します。古いURLは開けなくなります。 |

- ホーム画面のアイコンを変えたいときは、`github-pages` の3つの画像（180・192・512px の正方形PNG）を差し替えて、GitHub にアップし直します。今の画像は旧ボードのロゴ（180px）から作ったので、512px は少しぼやけます。大きいロゴがあれば差し替えてください。
- `manifest.webmanifest` には、わざと `start_url` を書いていません。書くとホーム画面のアイコンから開いたときに `?k=` が消えて、ボードが開けなくなるためです。

---

## 2店目以降の作り方
1. **スプレッドシートをコピー**：神社カフェのスプレッドシートで「ファイル → コピーを作成」（新しい店のGoogleアカウントで）。Apps Script も一緒にコピーされます。
2. **setup() を実行**：コピーの「拡張機能 → Apps Script」で `setup` を実行して許可します。コピーだと自動で見分けて、コメント・ブロックを空にし、鍵を作り直します。
3. **config シートを書き換える**：`storeName`・`storeFullName`・`logoUrl`・`themeColor`・`sources`・`slackChannelId`・`slackChannelName`・`tone`・`facts`・`rules`・`mailSignature` の行を、その店の値にします（`StoreSeed.gs` は使いません。消してもかまいません）。
   - 媒体を増やす・減らすときは `sources` の JSON を書き換えるだけです。タブの順番・色・略号もここで決まります。
     例：`{"name":"LINE","code":"ln","bg":"#e4f5e8","fg":"#1f7a3a","url":"https://manager.line.biz/"}`
4. **デプロイ**：手順4と同じです。
5. **GitHub Pages**：`jinjacafe-board` のリポジトリを開き「Fork」（名前は例：`<店の略称>-board`）。そのリポジトリで
   - 3つの画像をその店のロゴに差し替える
   - `manifest.webmanifest` の `name`（「◯◯ 返信ボード」）と `theme_color` を書き換える
   - `config.js` のURLを、その店のデプロイURLに書き換える
   - 「Settings → Pages」を ON
6. その店の Pages のURLに `?k=<config シートの boardKey>` を付けて開くと、`pageUrl`・`boardUrl` が自動で入ります。以後は config シートの `boardUrl` を配ります。

1店＝1スプレッドシート＝1デプロイURL＝1リポジトリです。店をまたいでデータは混ざりません。

---

## API（Claude 用メモ）
- すべて JSON を返します。HTTP の状態コードは使えないので、本文の `ok`・`code`・`error` を見ます（401 鍵が違う／403 権限が無い／404 無い／409 version 違い・id 重複）。
- 鍵：ボードは `k`（boardKey）、Claude は `token`（apiToken）。GET はクエリ、POST は本文に入れます。
- POST は `Content-Type: text/plain` で JSON を送ります（ブラウザの事前確認を避けるため）。curl なら `curl -sL -H 'Content-Type: text/plain' -d '{"api":"…","token":"…"}' "<デプロイURL>"`。

| 呼び方 | 中身 |
|---|---|
| GET `?api=list&col=items\|blocks&limit=500` | 行の配列（`rows`）。型を戻します（TRUE/FALSE→真偽、thread→配列、version・rating→数） |
| GET `?api=get&col=config&key=patrol` | 1つの設定（`value`。JSON は戻します） |
| GET `?api=get&col=config&key=all` | 設定を全部（`config`）。ボードの鍵では boardKey・apiToken は返しません |
| GET `?api=board` | items・blocks・config をまとめて（画面用） |
| POST `{api:"set", col, id, data}` | 新規。同じ id があれば 409 |
| POST `{api:"update", col, id, data, ifVersion}` | 混ぜて更新。version が違えば 409 と今の行（`current`） |
| POST `{api:"batch", writes:[{op:"set"\|"update"\|"delete", col, id, data, ifVersion}]}` | 1つでもだめなら全部書きません |
| POST `{api:"delete", col, id}` | 1行消す（Claude の鍵だけ） |
| POST `{api:"setConfig", key, value}` | 設定を書く（Claude の鍵だけ。boardKey・apiToken・boardUrl・sheetId は変えられません） |

- 書き込みは1回ずつ順番に処理します（LockService）。version は書くたびに +1。
- 項目名が増えたときは、シートに列が自動で足されます。

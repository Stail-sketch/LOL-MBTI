# LOL診断（lol-type.com）の作業ルール

2人（じゃすちぶせぶん / Stail-sketch）が、それぞれ別のAI（Claude Code / Codex）で同じリポジトリを触る。このファイルが共通ルールの正本で、`CLAUDE.md` はここを読み込むだけ。

## 公開の仕組み
- `main` に push すると、Cloudflare Pages（プロジェクト lol-mbti）が1〜2分で https://lol-type.com に公開する。確認の段階はない。push がそのまま本番公開
  - 2026-11-22 に GitHub Pages から移した（アクセスが1日数万回になり、GitHub Pages の通信量の目安・月100GBを超えたため）。Cloudflare はじゃすちぶせぶんのアカウント
  - GitHub Pages の設定も残っていて、www.lol-type.com と stail-sketch.github.io は今も GitHub Pages が lol-type.com へ転送している
  - Pages は URL の `.html` を省いた形に転送する（`privacy.html` → `/privacy`）。リンクは `.html` 付きのままで動く
- ビルド手順はない。リポジトリ直下の HTML / CSS / JS がそのまま配信される
  - 例外: `types/`（サモナータイプの解説ページ）は `js/data.js` から書き出した物。data.js・diagnosis.js・index.html のフッターを直したら `node scripts/build-type-pages.mjs` を流し、書き出した `types/` も一緒にコミットする。`types/` を手で直さない
- リポジトリ内のファイルは、このファイルや各種メモも含めて、URLを知っていれば誰でも読める。鍵・パスワード・個人情報を置かない
- エックスサーバーへの手作業アップロードは 2026-11-20 に廃止した

## 作業の前後
- 作業を始める前に `git pull` で最新を取り込む（相手の変更を知らずに同じ所を直さないため）
- push が弾かれたら `git pull` してからやり直す。`git push --force` は使わない（相手のコミットが消える）
- 同じ行の変更がぶつかった（コンフリクト）時は、どちらを残すかを自分で決めず、人に確認する
- 動作を確かめてから push する。確かめていない変更は push せず、その旨を人に伝える

## 触ってはいけないもの
- `CNAME`: GitHub Pages の「lol-type.com で配信する」設定。今の本番は Cloudflare Pages だが、www と github.io からの転送がこれに頼っているので消さない
- `js/main.js` の `_isProduction` の判定: 本番でテストモード（`?test=1` / `?test=100`）を無効にしている。配信するドメインを変える時は、ここに新しいドメインを足す

## URL
- 正式なURLは `https://lol-type.com`。`https://stail-sketch.github.io/LOL-MBTI` は lol-type.com に転送される旧URLなので、新しく書かない
- ランキングのAPI（`cloudflare-worker/`）は別に Cloudflare Workers へ公開する物で、push では更新されない

## 記録
- 変更を加えたら `作業履歴.md` に書く。詳細は不要で、後から「いつ・何を変更したか」が分かる程度でよい
- `作業履歴.md` は新しい日付が上。その日の見出し（`## YYYY-MM-DD`）が無ければ先頭に足す
- コミットメッセージは日本語で書く

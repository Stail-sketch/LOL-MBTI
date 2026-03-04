#!/bin/bash
# LOL ロールアイコン ダウンロードスクリプト
# リポジトリのルートで実行してください

mkdir -p role_icons

BASE="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions"

curl -o role_icons/top.png     "$BASE/icon-position-top.png"
curl -o role_icons/jungle.png  "$BASE/icon-position-jungle.png"
curl -o role_icons/mid.png     "$BASE/icon-position-middle.png"
curl -o role_icons/adc.png     "$BASE/icon-position-bottom.png"
curl -o role_icons/support.png "$BASE/icon-position-utility.png"

echo "✅ ダウンロード完了！role_icons/ フォルダを確認してください。"
ls -lh role_icons/

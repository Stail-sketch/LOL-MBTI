# index.html のアイコン画像を埋め込み、1ファイルで人に渡せる 制作者表記ラウンド.html を書き出す
# ラウンドを足したら毎回これを実行する: python -I build-share.py
import base64
from pathlib import Path

here = Path(__file__).parent
s = (here / "index.html").read_text(encoding="utf-8")
for name in ["stail", "justive"]:
    data = "data:image/jpeg;base64," + base64.b64encode((here / f"{name}.jpg").read_bytes()).decode()
    key = f'img: "{name}.jpg"'
    assert s.count(key) == 1, key
    s = s.replace(key, f'img: "{data}"')
for svg in ["wardex-logo.svg", "wardex-logo-text-white.svg"]:
    data = "data:image/svg+xml;base64," + base64.b64encode((here / svg).read_bytes()).decode()
    key = f'"{svg}"'
    assert s.count(key) == 1, key
    s = s.replace(key, f'"{data}"')
(here / "制作者表記ラウンド.html").write_text(s, encoding="utf-8", newline="\n")
print("ok", len(s))

"""案2（紺の板・金の線・金の文字）のロゴを、文字を図形にした SVG で書き出す。
寸法の決め方は docs/ロゴ案/logo-round3.html の plated() と同じ。"""
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen

fontdir, out = sys.argv[1], sys.argv[2]

def load(name):
    f = TTFont(f"{fontdir}/{name}")
    return instantiateVariableFont(f, {"wght": 900})

def kern_pairs(font):
    """GPOS の pair kerning（PairPos format1/2）を辞書にする。ブラウザと同じ字間にするため"""
    pairs = {}
    if "GPOS" not in font:
        return lambda a, b: 0
    gpos = font["GPOS"].table
    for lookup in gpos.LookupList.Lookup:
        for st in lookup.SubTable:
            if lookup.LookupType == 9:
                st = st.ExtSubTable
            if getattr(st, "LookupType", lookup.LookupType) != 2 or not hasattr(st, "Format"):
                continue
            cov = st.Coverage.glyphs
            if st.Format == 1:
                for i, g1 in enumerate(cov):
                    for pvr in st.PairSet[i].PairValueRecord:
                        v = getattr(pvr.Value1, "XAdvance", 0) if pvr.Value1 else 0
                        pairs.setdefault((g1, pvr.SecondGlyph), v)
            elif st.Format == 2:
                c1 = st.ClassDef1.classDefs
                c2 = st.ClassDef2.classDefs
                for g1 in cov:
                    k1 = c1.get(g1, 0)
                    for g2, k2 in list(c2.items()):
                        rec = st.Class1Record[k1].Class2Record[k2]
                        v = getattr(rec.Value1, "XAdvance", 0) if rec.Value1 else 0
                        if v:
                            pairs.setdefault((g1, g2), v)
    return lambda a, b: pairs.get((a, b), 0)

def run(font, text, ls_em):
    """文字列を1つのグリフ列として並べ、(記録したパス, インクの箱) を font 単位で返す"""
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    upem = font["head"].unitsPerEm
    kern = kern_pairs(font)
    names = [cmap[ord(ch)] for ch in text]
    rec = RecordingPen()
    x = 0
    for i, n in enumerate(names):
        gs[n].draw(TransformPen(rec, (1, 0, 0, 1, x, 0)))
        x += gs[n].width + ls_em * upem
        if i + 1 < len(names):
            x += kern(n, names[i + 1])
    bp = BoundsPen(gs)
    rec.replay(bp)
    return rec, bp.bounds, upem  # bounds: (xMin, yMin, xMax, yMax)、y は上向き

def place(rec, bounds, ink_h, x0, y0):
    """インクの左上が (x0, y0)、インクの高さが ink_h になるように変換した SVG パス"""
    xmin, ymin, xmax, ymax = bounds
    s = ink_h / (ymax - ymin)
    pen = SVGPathPen(None, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    # y を下向きに反転し、インクの上端 ymax を y0 に合わせる
    rec.replay(TransformPen(pen, (s, 0, 0, -s, x0 - xmin * s, y0 + ymax * s)))
    return pen.getCommands(), (xmax - xmin) * s

cinzel, noto = load("Cinzel.ttf"), load("NotoSerifJP.ttf")
en_rec, en_b, _ = run(cinzel, "LOL", 0.06)
jp_rec, jp_b, _ = run(noto, "鑑定", 0)

H, OPT = 60, 1.1
gap, padY, padX = H * 0.2, H * 0.5, H * 0.55
en_w = (en_b[2] - en_b[0]) * H / (en_b[3] - en_b[1])
jp_h = H * OPT
jp_w = (jp_b[2] - jp_b[0]) * jp_h / (jp_b[3] - jp_b[1])
pw = padX * 2 + en_w + gap + jp_w
ph = H + padY * 2

en_d, _ = place(en_rec, en_b, H, padX, padY)
jp_d, _ = place(jp_rec, jp_b, jp_h, padX + en_w + gap, padY - H * (OPT - 1) / 2)

f = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")
plate = f"0,0 {f(pw-16)},0 {f(pw)},16 {f(pw)},{f(ph)} 16,{f(ph)} 0,{f(ph-16)}"
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 {f(pw+2)} {f(ph+2)}" width="{f(pw+2)}" height="{f(ph+2)}">
  <title>LOL鑑定</title>
  <defs>
    <linearGradient id="lk-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F0E6BE"/><stop offset="1" stop-color="#C89B3C"/>
    </linearGradient>
  </defs>
  <polygon points="{plate}" fill="#010A13" stroke="#C89B3C" stroke-width="2"/>
  <path fill="url(#lk-gold)" d="{en_d}"/>
  <path fill="url(#lk-gold)" d="{jp_d}"/>
</svg>
'''
open(out, "w", encoding="utf-8", newline="\n").write(svg)
print(f"plate {pw:.1f}x{ph:.1f}  LOL ink w {en_w:.1f} h {H}  鑑定 ink w {jp_w:.1f} h {jp_h:.1f}  bytes {len(svg.encode())}")

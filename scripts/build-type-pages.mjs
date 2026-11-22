// サモナータイプの解説ページ（types/*.html）を js/data.js から書き出す。
// 診断の文章は JS が後から出すので、検索や広告審査のロボットには見えない。同じ文章を最初から HTML に入れたページを別に用意する。
// 文章は data.js の物だけを使い、ここでは書き足さない（相方の書いた文と調子を揃え、確かめていない文を増やさないため）。
// data.js・diagnosis.js・index.html のフッターを直したら `node scripts/build-type-pages.mjs` を流し直す。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://lol-type.com';
const OUT_DIR = path.join(ROOT, 'types');
// ads.txt・index.html・privacy.html・contact.html の AdSense タグと同じ ID
const ADSENSE_CLIENT = 'ca-pub-4680194085215369';

// ブラウザと同じ判定を使うため、data.js と diagnosis.js をそのまま読み込む（判定を書き写すと、直した時にずれる）
const ctx = { console };
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/diagnosis.js']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^(const|let) /gm, 'var ');
  vm.runInContext(src, ctx, { filename: f });
}
const { CHAMPIONS, SUMMONER_TYPES, findNearestSummonerType } = ctx;

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cssVer = (name) => (indexHtml.match(new RegExp(`${name}\\.css\\?v=(\\d+)`)) || [])[1] || '1';
// フッターは index.html から取り出して使い回す（制作者表記や注記を二重に管理しないため）。types/ から見たパスに直す
const footer = (indexHtml.match(/<footer class="site-footer">[\s\S]*?<\/footer>/) || [''])[0]
  .replace(/(src|href)="(?!https?:|#|\/)([^"]+)"/g, '$1="/$2"');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const typeById = Object.fromEntries(SUMMONER_TYPES.map((t) => [t.id, t]));
const champById = Object.fromEntries(CHAMPIONS.map((c) => [c.id, c]));

// チャンピオン画面（ui.js の showChampDetail）と同じ割り当て。近い順に並べる
const dist = (a, b) => ['V', 'I', 'H', 'T', 'A', 'W', 'S', 'D'].reduce((s, k) => s + ((a[k] || 0) - (b[k] || 0)) ** 2, 0);
const champsOf = Object.fromEntries(SUMMONER_TYPES.map((t) => [t.id, []]));
for (const c of CHAMPIONS) champsOf[findNearestSummonerType(c.scores).id].push(c);
for (const t of SUMMONER_TYPES) champsOf[t.id].sort((a, b) => dist(a.scores, t.profile) - dist(b.scores, t.profile));

const PAGE_CSS = `
  .tp-wrap{position:relative;z-index:1;max-width:880px;margin:0 auto;padding:56px 20px 20px}
  .tp-header{text-align:center;margin-bottom:36px}
  .tp-back{display:inline-flex;align-items:center;gap:6px;font-family:'Rajdhani',sans-serif;font-size:12px;letter-spacing:.15em;color:var(--text);text-decoration:none;border:1px solid var(--gold-a20);padding:6px 16px;margin-bottom:32px;transition:color .2s,border-color .2s}
  .tp-back:hover{color:var(--gold);border-color:var(--gold)}
  .tp-label{font-family:'Rajdhani',sans-serif;font-size:12px;letter-spacing:.4em;color:var(--blue);text-transform:uppercase;margin-bottom:10px}
  .tp-title{font-family:'Noto Serif JP',serif;font-weight:700;font-size:clamp(28px,6vw,42px);color:var(--gold);letter-spacing:.12em;line-height:1.4}
  .tp-subtitle{font-size:15px;color:var(--text-light);margin-top:8px}
  .tp-list{list-style:none;display:flex;flex-direction:column;gap:12px}
  .tp-list li{font-size:14px;color:var(--white);line-height:1.9;padding-left:16px;border-left:2px solid var(--gold-a30)}
  .tp-quotes{display:flex;flex-direction:column;gap:10px}
  .tp-link-card{display:block;text-decoration:none;color:inherit;transition:transform .2s}
  .tp-link-card:hover{transform:translateY(-2px)}
  .tp-more{display:block;margin-top:10px;font-family:'Rajdhani',sans-serif;font-size:12px;letter-spacing:.15em;color:var(--gold)}
  .tp-static .affinity-card{cursor:default}
  .tp-static .affinity-card:hover{transform:none}
  .tp-champs{display:flex;flex-direction:column;gap:14px}
  .tp-champ{display:grid;grid-template-columns:56px 1fr;gap:14px;padding:14px 0;border-top:1px solid var(--gold-a12)}
  .tp-champ:first-child{border-top:none;padding-top:0}
  .tp-champ img{width:56px;height:56px;border:1px solid var(--gold-a40)}
  .tp-champ-name{font-size:16px;font-weight:700;color:var(--gold-light)}
  .tp-champ-meta{font-size:12px;color:var(--text);margin-left:8px}
  .tp-champ-reason{font-size:13px;color:var(--text);line-height:1.9;margin-top:4px}
  .tp-cta{text-align:center;margin:36px 0 12px}
  .tp-cta .btn-primary{text-decoration:none}
  .tp-types{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
  .tp-types .ext-section{margin-bottom:0;height:100%}
  .tp-type-icons{display:flex;gap:6px;margin-top:14px}
  .tp-type-icons img{width:36px;height:36px;border:1px solid var(--gold-a30)}
  @media(max-width:500px){.tp-wrap{padding:40px 16px 12px}.ext-section{padding:22px 18px}}
`;

function page({ title, description, urlPath, body }) {
  const url = SITE + urlPath;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- このファイルは scripts/build-type-pages.mjs が書き出す。直接直さず、data.js を直してから書き出し直す -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/image.png?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/image.png?v=2">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Noto+Serif+JP:wght@300;400;700&family=Rajdhani:wght@300;400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/vars.css?v=${cssVer('vars')}">
<link rel="stylesheet" href="/style.css?v=${cssVer('style')}">
<style>${PAGE_CSS}</style>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>
</head>
<body>
<div class="hex-bg"></div>
<main class="tp-wrap">
${body}
</main>
${footer}
</body>
</html>
`;
}

const section = (label, title, inner) => `
  <section class="ext-section">
    <div class="ext-label">${label}</div>
    ${title ? `<h2 class="ext-title" style="margin-bottom:14px">${esc(title)}</h2>` : ''}
    ${inner}
  </section>`;

const affinityCards = (ids, kind) => ids.map((id) => champById[id]).filter(Boolean).map((c) => `
      <div class="affinity-card ${kind}"><img class="affinity-icon-img" src="/champion_icons/${esc(c.id)}.png" alt="" width="48" height="48" loading="lazy"><div class="affinity-name">${esc(c.name)}</div><div class="affinity-title">${esc(c.title)}</div></div>`).join('');

const cta = `
  <div class="tp-cta">
    <a class="btn-primary" href="/">診断してみる</a>
  </div>`;

function typePage(t) {
  const syn = typeById[t.synergy?.id];
  const opp = typeById[t.opposite?.id];
  const champs = champsOf[t.id];
  const body = `
  <header class="tp-header">
    <a class="tp-back" href="/types/">← サモナータイプ一覧</a>
    <p class="tp-label">Summoner Type</p>
    <h1 class="tp-title">${esc(t.name)}</h1>
    <p class="tp-subtitle">${esc(t.subtitle)}</p>
  </header>
${section('Play Style', '', `<p class="ext-body">${esc(t.playstyle)}</p>`)}
${section('Strengths &amp; Weaknesses', '', `
    <div class="sw-grid">
      <div class="sw-box str"><div class="sw-box-label">⬡ 強み</div>${t.strengths.map((s) => `<div class="sw-item">${esc(s)}</div>`).join('')}</div>
      <div class="sw-box weak"><div class="sw-box-label">⬡ 弱み</div>${t.weaknesses.map((s) => `<div class="sw-item">${esc(s)}</div>`).join('')}</div>
    </div>`)}
${section('Battle Creed', 'このタイプの戦い方を一言で表すと', `
    <div class="tp-quotes">${t.catchphrases.map((q) => `<div class="catchphrase-card"><div class="catchphrase-quote">${esc(q)}</div></div>`).join('')}</div>`)}
${section('After Game Chat', '試合後、このタイプはこう思われているかも', t.perceptions.map((p) => `
    <div class="perception-grid" style="margin-bottom:12px">
      <div class="perception-box ally"><div class="perception-box-label">味方から</div><div class="perception-text">${esc(p.ally)}</div></div>
      <div class="perception-box enemy"><div class="perception-box-label">敵から</div><div class="perception-text">${esc(p.enemy)}</div></div>
    </div>`).join(''))}
${section('Signature Champions', 'このタイプを体現するチャンピオン', `
    <ul class="tp-list">${t.famous.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`)}
${syn ? section('Summoner Synergy', '組むと最強のタイプ', `
    <a class="tp-link-card" href="/types/${syn.id}"><div class="synergy-card">
      <div class="synergy-type-name">${esc(syn.name)}</div>
      <div class="synergy-type-sub">${esc(syn.subtitle)}</div>
      <div class="synergy-reason">${esc(t.synergy.reason)}</div>
      <span class="tp-more">${esc(syn.name)}を読む →</span>
    </div></a>`) : ''}
${opp ? section('Shadow Self', '真逆のタイプ', `
    <a class="tp-link-card" href="/types/${opp.id}"><div class="opposite-card">
      <div class="opposite-type-name">${esc(opp.name)}</div>
      <div class="opposite-type-sub">${esc(opp.subtitle)}</div>
      <div class="opposite-reason">${esc(t.opposite.reason)}</div>
      <span class="tp-more">${esc(opp.name)}を読む →</span>
    </div></a>`) : ''}
  <div class="tp-static">
${section('Soul Resonance', '相性の良いチャンピオン', `<div class="affinity-grid">${affinityCards(t.allies, 'ally')}</div>`)}
${section('Natural Enemy', '天敵のチャンピオン', `<div class="affinity-grid">${affinityCards(t.enemies, 'enemy')}</div>`)}
  </div>
${section('Champions', `${t.name}のチャンピオン（${champs.length}体）`, `
    <div class="tp-champs">${champs.map((c) => `
      <div class="tp-champ">
        <img src="/champion_icons/${esc(c.id)}.png" alt="" width="56" height="56" loading="lazy">
        <div>
          <div><span class="tp-champ-name">${esc(c.name)}</span><span class="tp-champ-meta">${esc(c.title)} ・ ${esc(c.roles.join(' / '))}</span></div>
          <p class="tp-champ-reason">${esc(c.reason)}</p>
        </div>
      </div>`).join('')}
    </div>`)}
${cta}`;
  return page({
    title: `${t.name}（${t.subtitle}）| サモナーの素質診断`,
    description: `LoLのサモナータイプ「${t.name}」の特徴。${t.playstyle}`.slice(0, 120),
    urlPath: `/types/${t.id}`,
    body,
  });
}

function indexPage() {
  const body = `
  <header class="tp-header">
    <a class="tp-back" href="/">← 診断トップへ</a>
    <p class="tp-label">Summoner Types</p>
    <h1 class="tp-title">サモナータイプ一覧</h1>
  </header>
  <div class="tp-types">${SUMMONER_TYPES.map((t) => `
    <a class="tp-link-card" href="/types/${t.id}"><section class="ext-section">
      <h2 class="ext-title">${esc(t.name)}</h2>
      <div class="ext-subtitle">${esc(t.subtitle)}</div>
      <div class="tp-type-icons">${champsOf[t.id].slice(0, 5).map((c) => `<img src="/champion_icons/${esc(c.id)}.png" alt="${esc(c.name)}" width="36" height="36" loading="lazy">`).join('')}</div>
    </section></a>`).join('')}
  </div>
${cta}`;
  return page({
    title: 'サモナータイプ一覧 | サモナーの素質診断',
    description: `LoLのサモナーの素質診断に出てくる${SUMMONER_TYPES.length}のサモナータイプと、それぞれに当てはまるチャンピオンの一覧。`,
    urlPath: '/types/',
    body,
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexPage());
for (const t of SUMMONER_TYPES) fs.writeFileSync(path.join(OUT_DIR, `${t.id}.html`), typePage(t));
console.log(`types/ に ${SUMMONER_TYPES.length + 1} ページを書き出した`, Object.fromEntries(SUMMONER_TYPES.map((t) => [t.id, champsOf[t.id].length])));

// Cloudflare Worker - LOL-MBTI ランキング API
// 集計は D1 の counts 表（schema.sql）。KV だった頃は無料枠の書き込みが1日1,000回で、
// 公開翌日に1晩で400件を超えたため D1 に移した。D1 の加算は表の中で行うので同時送信でも数え落とさない

const VALID_ROLES = new Set(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'ANY']);

// でたらめな名前を大量に送られて集計が膨らみ続けないよう、種類の数に上限を置く。
// チャンピオンは現在167体、タイプは12種なので、新チャンピオン追加の余裕を見た値
const MAX_CHAMPIONS = 250;
const MAX_TYPES = 30;
const CHAMP_ID_RE = /^[A-Za-z]{2,30}$/;

// 16問で結果を見た回数（day16）と32問まで進んだ回数（day32）を日ごとに数える。
// 16問でやめた人がどれだけいるかを知るため（32問の送信だけでは分からなかった）。
// 日付は日本時間。見る人が日本にいて、UTC だと朝9時に日が変わってしまうため
const MAX_DAYS = 4000;
const jstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

// 判定の偏りを実際の答え方で調整するため、32問の8軸の点数を1回ごとに残す（answers 表）
const AXES = ['V', 'I', 'H', 'T', 'A', 'W', 'S', 'D'];
function validScores(scores) {
  if (!scores || typeof scores !== 'object') return null;
  const vals = AXES.map(k => scores[k]);
  return vals.every(v => Number.isInteger(v) && v >= 0 && v <= 100) ? vals : null;
}

function sanitize(str) {
  return String(str).replace(/[<>"&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]));
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// 既にある key は +1。新しい key は、その kind の種類数が上限未満の時だけ追加する
const INCREMENT_SQL = `
  INSERT INTO counts (kind, key, n)
  SELECT ?1, ?2, 1
  WHERE EXISTS (SELECT 1 FROM counts WHERE kind = ?1 AND key = ?2)
     OR (SELECT COUNT(*) FROM counts WHERE kind = ?1) < ?3
  ON CONFLICT (kind, key) DO UPDATE SET n = n + 1`;

async function loadStats(env) {
  const { results } = await env.DB.prepare('SELECT kind, key, n FROM counts').all();
  const stats = { total: 0, champions: {}, types: {}, roles: {} };
  const bucket = { champion: stats.champions, type: stats.types, role: stats.roles };
  for (const { kind, key, n } of results) {
    if (kind === 'total') stats.total = n;
    else if (bucket[kind]) bucket[kind][key] = n;
  }
  return stats;
}

const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

function summary(stats) {
  return {
    total: stats.total,
    champions: top(stats.champions, 5),
    types: top(stats.types, 5),
    roles: top(stats.roles, 6),
  };
}

// /record の連打で、ランキングと8軸の点数に偽の記録が混ざるのを防ぐ回数制限。
// 組み込みの Rate Limiting binding は無料プランのこのアカウントでは常に success:true を返し効かなかった（2026-11-21 実測）ため、
// 1か所で数えられる Durable Object で数える。IP はメモリ上で1分だけ持ち、ストレージには書かない
const LIMIT_PER_MINUTE = 5;
export class RecordLimiter {
  constructor() {
    this.hits = new Map();
  }
  async fetch(request) {
    const ip = await request.text();
    const now = Date.now();
    for (const [k, list] of this.hits) {
      const recent = list.filter(t => now - t < 60_000);
      if (recent.length) this.hits.set(k, recent); else this.hits.delete(k);
    }
    const list = this.hits.get(ip) || [];
    if (list.length >= LIMIT_PER_MINUTE) return new Response('limited', { status: 429 });
    list.push(now);
    this.hits.set(ip, list);
    return new Response('ok');
  }
}

export default {
  async fetch(request, env) {
    const ch = corsHeaders;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: ch });
    }

    try {
    const url = new URL(request.url);

    // POST /record - 診断結果を記録
    if (url.pathname === '/record' && request.method === 'POST') {
      // 接続元IPは回数を数えるだけに使い、保存しない（プライバシーポリシーの「IPは含まない」と合わせる）
      if (env.LIMITER) {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const stub = env.LIMITER.get(env.LIMITER.idFromName('record'));
        const res = await stub.fetch('https://limiter/check', { method: 'POST', body: ip });
        if (res.status === 429) return json({ error: 'Too Many Requests' }, 429, ch);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400, ch);
      }

      // 16問の結果を見た時の送信。回数だけを数え、結果の中身は受け取らない
      if (body && body.stage === 16) {
        await env.DB.prepare(INCREMENT_SQL).bind('day16', jstDay(), MAX_DAYS).run();
        return json({ ok: true }, 200, ch);
      }

      const { champId, typeName, role, scores } = body || {};

      if (typeof champId !== 'string' || !CHAMP_ID_RE.test(champId)) {
        return json({ error: 'Invalid champId' }, 400, ch);
      }
      if (role && !VALID_ROLES.has(role)) {
        return json({ error: 'Invalid role' }, 400, ch);
      }

      const inc = env.DB.prepare(INCREMENT_SQL);
      const steps = [
        inc.bind('total', '', 1),
        inc.bind('champion', champId, MAX_CHAMPIONS),
        inc.bind('day32', jstDay(), MAX_DAYS),
      ];
      if (typeName && typeof typeName === 'string' && typeName.length <= 60) {
        steps.push(inc.bind('type', sanitize(typeName), MAX_TYPES));
      }
      if (role) {
        steps.push(inc.bind('role', role, VALID_ROLES.size));
      }
      // 点数が無い・形が違う時は点数だけ残さない（点数を送らない古いページのキャッシュでも集計は続ける）
      const vals = validScores(scores);
      if (vals) {
        const day = new Date().toISOString().slice(0, 10);
        const safeType = typeof typeName === 'string' && typeName.length <= 60 ? sanitize(typeName) : null;
        steps.push(env.DB.prepare(
          'INSERT INTO answers (day, role, champ_id, type_name, v, i, h, t, a, w, s, d) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(day, role || null, champId, safeType, ...vals));
      }
      await env.DB.batch(steps);

      return json({ ok: true, rankings: summary(await loadStats(env)) }, 200, ch);
    }

    // GET /rankings - ランキングデータを取得
    if (url.pathname === '/rankings' && request.method === 'GET') {
      const stats = await loadStats(env);
      return json(summary(stats), 200, { ...ch, 'Cache-Control': 'no-store' });
    }

    // GET /rankings/all - 全データを取得
    if (url.pathname === '/rankings/all' && request.method === 'GET') {
      const stats = await loadStats(env);
      const sorted = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
      return json({
        total: stats.total,
        champions: sorted(stats.champions),
        types: sorted(stats.types),
        roles: sorted(stats.roles),
      }, 200, { ...ch, 'Cache-Control': 'no-store' });
    }

    // GET /stats - ダッシュボード（stats.html）用。日ごとの16問・32問の回数と全ランキング
    if (url.pathname === '/stats' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT kind, key, n FROM counts').all();
      const out = { total: 0, champions: [], types: [], roles: [] };
      const lists = { champion: out.champions, type: out.types, role: out.roles };
      const days = {};
      for (const { kind, key, n } of results) {
        if (kind === 'total') out.total = n;
        else if (lists[kind]) lists[kind].push([key, n]);
        else if (kind === 'day16' || kind === 'day32') {
          days[key] = days[key] || { day: key, n16: 0, n32: 0 };
          days[key][kind === 'day16' ? 'n16' : 'n32'] = n;
        }
      }
      for (const list of Object.values(lists)) list.sort((a, b) => b[1] - a[1]);
      out.days = Object.values(days).sort((a, b) => (a.day < b.day ? -1 : 1));
      return json(out, 200, { ...ch, 'Cache-Control': 'no-store' });
    }

    return new Response('Not Found', { status: 404, headers: ch });
    } catch (e) {
      console.error(e);
      return json({ error: 'Internal Server Error' }, 500, ch);
    }
  },
};

// Cloudflare Worker - LOL-MBTI ランキング API

const VALID_ROLES = new Set(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'ANY']);

// 集計はすべて1つのキーにまとめる。KV の無料枠は書き込みが1日1,000回なので、
// 4キーに分けていた頃は1日250件で記録が止まっていた
const STATS_KEY = 'stats';

// でたらめな名前を大量に送られて集計が膨らみ続けないよう、種類の数に上限を置く。
// チャンピオンは現在167体、タイプは12種なので、新チャンピオン追加の余裕を見た値
const MAX_CHAMPIONS = 250;
const MAX_TYPES = 30;
const CHAMP_ID_RE = /^[A-Za-z]{2,30}$/;

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

async function loadStats(env) {
  const stats = await env.KV.get(STATS_KEY, 'json');
  return {
    total: stats?.total || 0,
    champions: stats?.champions || {},
    types: stats?.types || {},
    roles: stats?.roles || {},
  };
}

function increment(obj, key, max) {
  if (!(key in obj) && Object.keys(obj).length >= max) return;
  obj[key] = (obj[key] || 0) + 1;
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
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400, ch);
      }

      const { champId, typeName, role } = body;

      if (typeof champId !== 'string' || !CHAMP_ID_RE.test(champId)) {
        return json({ error: 'Invalid champId' }, 400, ch);
      }
      if (role && !VALID_ROLES.has(role)) {
        return json({ error: 'Invalid role' }, 400, ch);
      }

      // 読む→足す→書き戻す。同時に送られると後勝ちで数え落とすことがあるが、規模からみて許容
      const stats = await loadStats(env);
      stats.total += 1;
      increment(stats.champions, champId, MAX_CHAMPIONS);
      if (typeName && typeof typeName === 'string' && typeName.length <= 60) {
        increment(stats.types, sanitize(typeName), MAX_TYPES);
      }
      if (role) {
        increment(stats.roles, role, VALID_ROLES.size);
      }
      await env.KV.put(STATS_KEY, JSON.stringify(stats));

      // 書き込み直後のデータからランキングを返す（KV は反映に時間がかかるため）
      return json({ ok: true, rankings: summary(stats) }, 200, ch);
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

    return new Response('Not Found', { status: 404, headers: ch });
    } catch (e) {
      console.error(e);
      return json({ error: 'Internal Server Error' }, 500, ch);
    }
  },
};

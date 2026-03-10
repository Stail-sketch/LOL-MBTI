// Cloudflare Worker - LOL-MBTI ランキング API

const VALID_ROLES = new Set(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'ANY']);

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

export default {
  async fetch(request, env) {
    const ch = corsHeaders;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: ch });
    }

    const url = new URL(request.url);

    // POST /record - 診断結果を記録
    if (url.pathname === '/record' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400, ch);
      }

      const { champId, champName, typeName, role } = body;

      // バリデーション
      if (!champId || typeof champId !== 'string' || champId.length > 60) {
        return json({ error: 'Invalid champId' }, 400, ch);
      }
      if (role && !VALID_ROLES.has(role)) {
        return json({ error: 'Invalid role' }, 400, ch);
      }

      // カウンターを並列取得 → インクリメント → 書き込み
      const [totalStr, championsStr, typesStr, rolesStr] = await Promise.all([
        env.KV.get('total'),
        env.KV.get('champions'),
        env.KV.get('types'),
        env.KV.get('roles'),
      ]);

      const total = parseInt(totalStr || '0') + 1;
      const champions = JSON.parse(championsStr || '{}');
      const types = JSON.parse(typesStr || '{}');
      const roles = JSON.parse(rolesStr || '{}');

      champions[champId] = (champions[champId] || 0) + 1;
      if (typeName && typeof typeName === 'string' && typeName.length <= 60) {
        types[typeName] = (types[typeName] || 0) + 1;
      }
      if (role) {
        roles[role] = (roles[role] || 0) + 1;
      }

      await Promise.all([
        env.KV.put('total', String(total)),
        env.KV.put('champions', JSON.stringify(champions)),
        env.KV.put('types', JSON.stringify(types)),
        env.KV.put('roles', JSON.stringify(roles)),
      ]);

      // 書き込み直後のデータからランキングを生成して返す（KV eventual consistency 対策）
      const top = (obj, n) =>
        Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

      return json({
        ok: true,
        rankings: {
          total,
          champions: top(champions, 5),
          types: top(types, 5),
          roles: top(roles, 6),
        },
      }, 200, ch);
    }

    // GET /rankings - ランキングデータを取得
    if (url.pathname === '/rankings' && request.method === 'GET') {
      const [totalStr, championsStr, typesStr, rolesStr] = await Promise.all([
        env.KV.get('total'),
        env.KV.get('champions'),
        env.KV.get('types'),
        env.KV.get('roles'),
      ]);

      const total = parseInt(totalStr || '0');
      const champObj = JSON.parse(championsStr || '{}');
      const typeObj = JSON.parse(typesStr || '{}');
      const roleObj = JSON.parse(rolesStr || '{}');

      const top = (obj, n) =>
        Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

      return json({
        total,
        champions: top(champObj, 5),
        types: top(typeObj, 5),
        roles: top(roleObj, 6),
      }, 200, { ...ch, 'Cache-Control': 'no-store' });
    }

    return new Response('Not Found', { status: 404, headers: ch });
  },
};

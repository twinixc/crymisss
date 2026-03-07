// api/register.js
import { getRedis } from './_redis.js';

// [SEC-5] Санитизация строк — убираем управляющие символы и обрезаем длину
function sanitize(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen).trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const email      = sanitize(body.email, 254);
  const name       = sanitize(body.name, 100);
  const source     = ['web','telegram'].includes(body.source) ? body.source : 'web';
  const tgUsername = sanitize(body.tgUsername, 64);

  // [SEC-6] tgId должен быть числом
  const tgId = Number.isInteger(Number(body.tgId)) && Number(body.tgId) > 0
    ? Number(body.tgId) : null;

  // [SEC-7] pic — только https:// URL от доверенных доменов
  const rawPic = sanitize(body.pic || '', 500);
  const pic = (rawPic.startsWith('https://') &&
    /^https:\/\/(t\.me|telegram\.org|lh3\.googleusercontent\.com)/.test(rawPic))
    ? rawPic : '';

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'email required' });
  }

  try {
    const r = await getRedis();
    const now = Date.now();
    const userId = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,24);
    const today  = new Date().toISOString().slice(0,10);

    let existing = null;
    try {
      const raw = await r.get('user:' + userId);
      if (raw) existing = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch(_) {}

    const isNew = !existing;
    // ПЛАН: ТОЛЬКО из Redis — клиенту не доверяем
    const plan = existing?.plan || 'free';
    const banned = existing?.banned || false;

    await r.set('user:' + userId, JSON.stringify({
      id: userId, email, name, pic,
      plan, source, tgId,
      tgUsername,
      createdAt:  existing?.createdAt || now,
      lastSeenAt: now,
      loginCount: (existing?.loginCount || 0) + 1,
      banned,
    }));

    if (isNew) {
      await r.zAdd('users:all', [{ score: now, value: userId }]);
      await r.incr('stats:total_users');
      await r.incr('stats:users_by_day:' + today);
      await r.incr('stats:users_by_source:' + source);
    }
    await r.sAdd('stats:active_today:' + today, userId);

    return res.status(200).json({ ok: true, isNew, plan, banned });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(200).json({ ok: true, isNew: false, plan: 'free', banned: false });
  }
}

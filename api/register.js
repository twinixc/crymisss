// api/register.js
import { getRedis } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, name, pic, source, tgId, tgUsername } = req.body;
  // ВАЖНО: plan из тела запроса НЕ используем — берём только из Redis чтобы не затирать выданный план
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const r = await getRedis();
    const now = Date.now();
    const userId = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,24);
    const today = new Date().toISOString().slice(0,10);

    // Читаем существующего юзера
    let existing = null;
    try {
      const raw = await r.get('user:' + userId);
      if (raw) existing = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch(_) {}

    const isNew = !existing;

    // ПЛАН: если юзер уже есть в Redis — берём план оттуда (не затираем!)
    // Если новый — ставим free
    const plan = existing?.plan || 'free';

    await r.set('user:' + userId, JSON.stringify({
      id: userId,
      email, name,
      pic: pic || existing?.pic || '',
      plan,  // ← всегда из Redis, никогда из клиента
      source: source || 'web',
      tgId:       tgId       || existing?.tgId       || null,
      tgUsername: tgUsername || existing?.tgUsername || '',
      createdAt:  existing?.createdAt || now,
      lastSeenAt: now,
      loginCount: (existing?.loginCount || 0) + 1,
      banned:     existing?.banned || false,
    }));

    if (isNew) {
      await r.zAdd('users:all', [{ score: now, value: userId }]);
      await r.incr('stats:total_users');
      await r.incr('stats:users_by_day:' + today);
      await r.incr('stats:users_by_source:' + (source || 'web'));
    }
    await r.sAdd('stats:active_today:' + today, userId);

    return res.status(200).json({ ok: true, isNew, plan });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(200).json({ ok: true, isNew: false, kvError: err.message });
  }
}

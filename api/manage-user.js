// api/manage-user.js
import { getRedis } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, userId, action, value } = req.body;
  if (!process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!userId || !action) return res.status(400).json({ error: 'userId and action required' });

  try {
    const r = await (await import('./_redis.js')).getRedis();

    // Читаем юзера
    const raw = await r.get('user:' + userId);
    if (!raw) return res.status(404).json({ error: 'User not found' });
    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

    switch (action) {
      case 'set_plan': {
        if (!['free','pro','ultra'].includes(value)) {
          return res.status(400).json({ error: 'Invalid plan' });
        }
        const updated = { ...user, plan: value, updatedAt: Date.now() };
        await r.set('user:' + userId, JSON.stringify(updated));
        return res.status(200).json({ ok: true, plan: value });
      }

      case 'ban': {
        const updated = { ...user, banned: true, bannedAt: Date.now() };
        await r.set('user:' + userId, JSON.stringify(updated));
        await r.sAdd('users:banned', userId);
        return res.status(200).json({ ok: true });
      }

      case 'unban': {
        const updated = { ...user, banned: false, bannedAt: null };
        await r.set('user:' + userId, JSON.stringify(updated));
        await r.sRem('users:banned', userId);
        return res.status(200).json({ ok: true });
      }

      case 'delete': {
        await r.del('user:' + userId);
        await r.zRem('users:all', userId);
        await r.sRem('users:banned', userId);
        try { await r.decr('stats:total_users'); } catch(_){}
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    console.error('Manage user error:', err);
    return res.status(500).json({ error: err.message });
  }
}

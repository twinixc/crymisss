// api/manage-user.js — управление пользователями (выдать план, бан, удалить)
import { kvGet, kvSet, kvDel, kvZRem, kvSAdd, kvSRem, kvDecr } from './_redis.js';

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
    let user = null;
    try { user = await kvGet('user:' + userId); } catch(_){}
    if (!user) return res.status(404).json({ error: 'User not found' });

    switch (action) {
      case 'set_plan': {
        const plan = value;
        if (!['free','pro','ultra'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
        const updated = { ...user, plan, updatedAt: Date.now() };
        await kvSet('user:' + userId, updated);
        return res.status(200).json({ ok: true, user: updated });
      }
      case 'ban': {
        await kvSet('user:' + userId, { ...user, banned: true, bannedAt: Date.now() });
        await kvSAdd('users:banned', userId);
        return res.status(200).json({ ok: true });
      }
      case 'unban': {
        await kvSet('user:' + userId, { ...user, banned: false, bannedAt: null });
        await kvSRem('users:banned', userId);
        return res.status(200).json({ ok: true });
      }
      case 'delete': {
        await kvDel('user:' + userId);
        await kvZRem('users:all', userId);
        await kvSRem('users:banned', userId);
        try { await kvDecr('stats:total_users'); } catch(_){}
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

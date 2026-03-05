// api/manage-user.js
// Управление пользователями — только для владельца
// POST /api/manage-user  body: { token, userId, action, value }
// actions: set_plan | ban | unban | delete

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, userId, action, value } = req.body;
  const secret = process.env.ADMIN_SECRET;

  if (!secret || token !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!userId || !action) {
    return res.status(400).json({ error: 'userId and action required' });
  }

  try {
    const user = await kv.get(`user:${userId}`);
    if (!user) return res.status(404).json({ error: 'User not found' });

    switch (action) {
      case 'set_plan': {
        const plan = value; // 'free' | 'pro' | 'ultra'
        if (!['free','pro','ultra'].includes(plan)) {
          return res.status(400).json({ error: 'Invalid plan' });
        }
        await kv.set(`user:${userId}`, { ...user, plan, updatedAt: Date.now() });
        // Сохраняем флаг что план выдан вручную (для синхронизации с клиентом)
        await kv.set(`plan_override:${userId}`, { plan, grantedAt: Date.now() }, { ex: 60 * 60 * 24 * 30 }); // 30 дней
        return res.status(200).json({ ok: true, user: { ...user, plan } });
      }

      case 'ban': {
        await kv.set(`user:${userId}`, { ...user, banned: true, bannedAt: Date.now() });
        await kv.sadd('users:banned', userId);
        return res.status(200).json({ ok: true });
      }

      case 'unban': {
        await kv.set(`user:${userId}`, { ...user, banned: false, bannedAt: null });
        await kv.srem('users:banned', userId);
        return res.status(200).json({ ok: true });
      }

      case 'delete': {
        await kv.del(`user:${userId}`);
        await kv.zrem('users:all', userId);
        await kv.srem('users:banned', userId);
        await kv.decr('stats:total_users');
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

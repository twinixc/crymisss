// api/admin.js
import { getRedis } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const token = req.query.token || req.headers['x-admin-token'];
  if (!process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const r = await getRedis();
    const today = new Date().toISOString().slice(0,10);

    // Счётчики
    const safe = async (fn) => { try { return await fn(); } catch(_) { return null; } };

    const totalUsers  = Number(await safe(() => r.get('stats:total_users'))) || 0;
    const activeToday = Number(await safe(() => r.sCard('stats:active_today:' + today))) || 0;
    const webUsers    = Number(await safe(() => r.get('stats:users_by_source:web'))) || 0;
    const tgUsers     = Number(await safe(() => r.get('stats:users_by_source:telegram'))) || 0;

    // 7 дней
    const last7days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0,10);
      const count = Number(await safe(() => r.get('stats:users_by_day:' + d))) || 0;
      last7days.push({ date: d, count });
    }

    // Все пользователи — берём IDs из sorted set (от новых к старым)
    const allIds = await safe(() => r.zRange('users:all', '+inf', '-inf', {
      BY: 'SCORE', REV: true, LIMIT: { offset: 0, count: 100 }
    })) || [];

    const recentUsers = [];
    for (const id of allIds) {
      const raw = await safe(() => r.get('user:' + id));
      if (!raw) continue;
      const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
      recentUsers.push({
        ...u,
        // маскируем email только если нет TG username
        email: u.tgUsername ? u.email : (u.email||'').replace(/(.{2}).+(@.+)/, '$1***$2'),
      });
    }

    const planCounts = { free: 0, pro: 0, ultra: 0 };
    recentUsers.forEach(u => {
      const p = u.plan || 'free';
      planCounts[p] = (planCounts[p] || 0) + 1;
    });

    return res.status(200).json({
      totalUsers, activeToday, webUsers, tgUsers,
      last7days, recentUsers, planCounts
    });

  } catch (err) {
    console.error('Admin error:', err);
    return res.status(500).json({ error: err.message, kvError: true });
  }
}

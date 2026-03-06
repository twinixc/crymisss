// api/admin.js — статистика и список пользователей для владельца
import { kvGet, kvSet, kvZRange, kvSCard, kvIncr } from './_redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const token = req.query.token || req.headers['x-admin-token'];
  if (!process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const today = new Date().toISOString().slice(0,10);

    // Счётчики
    let totalUsers = 0, activeToday = 0, webUsers = 0, tgUsers = 0;
    try {
      const tv = await kvGet('stats:total_users'); totalUsers = Number(tv)||0;
    } catch(_){}
    try { activeToday = await kvSCard('stats:active_today:' + today); } catch(_){}
    try { const w = await kvGet('stats:users_by_source:web'); webUsers = Number(w)||0; } catch(_){}
    try { const t = await kvGet('stats:users_by_source:telegram'); tgUsers = Number(t)||0; } catch(_){}

    // Последние 7 дней
    const last7days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i*86400000).toISOString().slice(0,10);
      let count = 0;
      try { const v = await kvGet('stats:users_by_day:' + d); count = Number(v)||0; } catch(_){}
      last7days.push({ date: d, count });
    }

    // Последние 50 пользователей
    let recentIds = [];
    try { recentIds = await kvZRange('users:all', 0, 49, true); } catch(_){}

    const recentUsers = [];
    for (const id of recentIds) {
      try {
        const u = await kvGet('user:' + id);
        if (u) recentUsers.push({
          ...u,
          email: (u.email||'').replace(/(.{2}).+(@.+)/, '$1***$2'),
        });
      } catch(_){}
    }

    // Планы
    const planCounts = { free:0, pro:0, ultra:0 };
    recentUsers.forEach(u => { if(u.plan) planCounts[u.plan] = (planCounts[u.plan]||0)+1; });

    return res.status(200).json({ totalUsers, activeToday, webUsers, tgUsers, last7days, recentUsers, planCounts });
  } catch (err) {
    console.error('Admin error:', err);
    return res.status(500).json({ error: err.message, kvError: true });
  }
}

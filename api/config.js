// api/config.js — отдаёт публичные настройки фронтенду
// Google Client ID не секретный (он всё равно виден), но так удобнее управлять

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  return res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    models: {
      free: 'llama-3.1-8b-instant',
      pro: 'llama-3.3-70b-versatile',
      ultra: 'llama-3.3-70b-versatile',
    }
  });
}

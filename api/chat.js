// api/chat.js — Groq API proxy
// Groq быстрее Gemini, использует llama модели
// Ключ GROQ_API_KEY хранится только на сервере

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured: missing GROQ_API_KEY' });

  const { messages, plan } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages required' });
  }

  // Чем выше план — тем умнее и быстрее модель
  const MODELS = {
    free:  'llama-3.1-8b-instant',    // лёгкая и быстрая
    pro:   'llama-3.3-70b-versatile', // умная, сильная
    ultra: 'llama-3.3-70b-versatile', // то же + больше токенов
  };

  const SYSTEM = [
    'You are Crymiss, an advanced AI assistant created by the Crymiss team.',
    'Your name is Crymiss. You are NOT Groq, NOT Meta, NOT Llama, NOT ChatGPT, NOT Claude, NOT Gemini.',
    'If asked who you are or what model powers you — always say you are Crymiss, powered by proprietary AI.',
    'Never mention Groq, Meta, Llama, OpenAI, Anthropic, or Google.',
    'You are smart, concise, and expert at code, analysis, writing, and any task.',
    'Reply in the language the user writes in.',
  ].join(' ');

  try {
    const model = MODELS[plan] || MODELS.free;

    // Groq uses OpenAI-compatible format
    // Our messages may be in Gemini format {role, parts:[{text}]} — normalize them
    const normalized = messages.map(m => ({
      role: m.role === 'model' ? 'assistant' : (m.role || 'user'),
      content: Array.isArray(m.parts)
        ? (m.parts[0]?.text || '')
        : (m.content || m.text || ''),
    }));

    const groqMessages = [
      { role: 'system', content: SYSTEM },
      ...normalized,
    ];

    const body = {
      model,
      messages: groqMessages,
      temperature: plan === 'free' ? 0.7 : 0.85,
      max_tokens: plan === 'free' ? 1024 : plan === 'pro' ? 4096 : 8192,
      stream: false,
    };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({
        error: errData?.error?.message || ('Groq error ' + groqRes.status),
      });
    }

    const data = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: 'Empty response from AI' });

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

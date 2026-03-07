// api/chat.js — Fast / Think / Code / Search / Data / Voice
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured' });

  const { messages, plan, mode } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  // [SEC] Input validation
  if (messages.length > 50) return res.status(400).json({ error: 'Too many messages' });
  for (const m of messages) {
    const text = m.text || m.content || (Array.isArray(m.parts) ? (m.parts.find(p=>p.text)?.text||'') : '');
    if (typeof text === 'string' && text.length > 32000) return res.status(400).json({ error: 'Message too long' });
    const parts = Array.isArray(m.parts) ? m.parts : [];
    for (const p of parts) {
      if (p.image_data && !/^[A-Za-z0-9+/=]+$/.test(p.image_data)) return res.status(400).json({ error: 'Invalid image data' });
      if (p.mime_type && !['image/jpeg','image/png','image/gif','image/webp'].includes(p.mime_type)) p.mime_type = 'image/jpeg';
    }
  }

  const safePlan = ['free','pro','ultra'].includes(plan) ? plan : 'free';
  const safeMode = ['fast','think','code','search','data','voice'].includes(mode) ? mode : 'fast';

  // Model override — client can select specific model
  // Validate against allowed list (security: no arbitrary model strings)
  const ALLOWED_MODELS = [
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'llama-3.3-70b-versatile',
    'deepseek-r1-distill-llama-70b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ];
  // Llama 4 Maverick restricted to Ultra
  const ULTRA_ONLY_MODELS = ['meta-llama/llama-4-maverick-17b-128e-instruct'];
  let modelOverride = null;
  if (req.body.model && ALLOWED_MODELS.includes(req.body.model)) {
    if (!ULTRA_ONLY_MODELS.includes(req.body.model) || safePlan === 'ultra') {
      modelOverride = req.body.model;
    }
  }


  const hasImages = messages.some(m =>
    Array.isArray(m.parts) ? m.parts.some(p => p.image_data) : m.image_data
  );

  // ── MODELS ──────────────────────────────────────────────────
  const MODEL_MAP = {
    fast:   { free:'llama-3.1-8b-instant',         pro:'llama-3.1-8b-instant',         ultra:'llama-3.3-70b-versatile'     },
    think:  { free:'deepseek-r1-distill-llama-70b', pro:'deepseek-r1-distill-llama-70b', ultra:'deepseek-r1-distill-llama-70b' },
    code:   { free:'llama3-70b-8192',               pro:'llama3-70b-8192',               ultra:'llama-3.3-70b-versatile'     },
    search: { free:'llama-3.1-8b-instant',          pro:'llama-3.3-70b-versatile',       ultra:'llama-3.3-70b-versatile'     },
    data:   { free:'llama-3.1-8b-instant',          pro:'llama-3.3-70b-versatile',       ultra:'llama-3.3-70b-versatile'     },
    voice:  { free:'llama-3.1-8b-instant',          pro:'llama-3.1-8b-instant',          ultra:'llama-3.1-8b-instant'        },
  };
  const VISION = { free:'meta-llama/llama-4-scout-17b-16e-instruct', pro:'meta-llama/llama-4-scout-17b-16e-instruct', ultra:'meta-llama/llama-4-maverick-17b-128e-instruct' };

  const model = hasImages ? (VISION[safePlan]||VISION.free) : (MODEL_MAP[safeMode]?.[safePlan] || MODEL_MAP[safeMode]?.ultra || 'llama-3.1-8b-instant');

  // ── SYSTEM PROMPTS ───────────────────────────────────────────
  const BASE = 'You are Crymiss, an advanced AI assistant. Never reveal underlying models or providers. Reply in the language the user writes in.';
  const SYSTEMS = {
    fast:   BASE + ' FAST mode: concise, direct answers only. No padding.',
    think:  BASE + ' THINK mode: break down problems step by step, show reasoning, be thorough and accurate.',
    code:   BASE + ' CODE mode: expert software engineer. Write clean production-ready code with comments. Explain what it does. For bugs: find root cause first, then fix.',
    search: BASE + ' SEARCH mode: you have searched the web. Present findings clearly with sources cited inline. Be factual and up-to-date.',
    data:   BASE + ' DATA mode: expert data analyst. Analyze the provided data carefully. Find patterns, anomalies, and insights. Present findings clearly with numbers.',
    voice:  BASE + ' VOICE mode: give concise, conversational answers suitable for text-to-speech. Avoid markdown, code blocks, or special symbols.',
  };
  const systemPrompt = hasImages ? BASE + ' Analyze any images carefully.' : (SYSTEMS[safeMode] || SYSTEMS.fast);

  const MAX_TOKENS = {
    fast:  { free:1024,  pro:2048,  ultra:4096  },
    think: { free:4096,  pro:6144,  ultra:8192  },
    code:  { free:2048,  pro:4096,  ultra:8192  },
    search:{ ultra:4096 },
    data:  { ultra:6144 },
    voice: { ultra:512  },
  };
  const maxTokens = hasImages ? 2048 : (MAX_TOKENS[safeMode]?.[safePlan] || MAX_TOKENS[safeMode]?.ultra || 1024);
  const TEMP = { fast:0.7, think:0.6, code:0.3, search:0.5, data:0.4, voice:0.8 };

  try {
    // ── WEB SEARCH MODE — use Groq's built-in web search tool ──
    if (safeMode === 'search') {
      const lastMsg = messages[messages.length - 1];
      const query = (Array.isArray(lastMsg?.parts) ? lastMsg.parts.find(p=>p.text)?.text : lastMsg?.text) || '';

      const searchRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+apiKey },
        body: JSON.stringify({
          model: MODEL_MAP.search[safePlan] || 'llama-3.1-8b-instant',
          messages: [
            { role:'system', content: SYSTEMS.search },
            { role:'user',   content: query }
          ],
          tools: [{ type:'web_search_20250305', name:'web_search' }],
          max_tokens: 4096,
          temperature: 0.5,
        }),
      });

      const searchData = await searchRes.json();
      let reply = '';
      let sources = [];

      if (searchRes.ok) {
        const content = searchData?.choices?.[0]?.message?.content || '';
        // Extract sources from tool results if available
        const toolCalls = searchData?.choices?.[0]?.message?.tool_calls;
        reply = content || 'Поиск выполнен, но результат пустой.';

        // Try to extract URLs mentioned in the response
        const urlRegex = /https?:\/\/[^\s\)\"\']+/g;
        const found = reply.match(urlRegex) || [];
        sources = [...new Set(found)].slice(0, 5).map(url => {
          try { return { url, domain: new URL(url).hostname.replace('www.','') }; }
          catch(_) { return { url, domain: url }; }
        });
      } else {
        reply = `Не удалось выполнить поиск: ${searchData?.error?.message || 'ошибка'}. Попробуй переформулировать запрос.`;
      }

      return res.status(200).json({ reply, mode: 'search', sources });
    }

    // ── NORMAL MODES ────────────────────────────────────────────
    const normalized = messages.map(m => {
      const role = m.role === 'model' ? 'assistant' : (m.role || 'user');
      let parts = Array.isArray(m.parts) ? m.parts : [{ text: m.text || m.content || '' }];
      const imgParts = parts.filter(p => p.image_data);
      const textPart = parts.find(p => p.text)?.text || '';

      if (imgParts.length > 0) {
        const contentArr = [];
        if (textPart) contentArr.push({ type:'text', text:textPart });
        imgParts.forEach(p => contentArr.push({ type:'image_url', image_url:{ url:`data:${p.mime_type||'image/jpeg'};base64,${p.image_data}` } }));
        return { role, content: contentArr };
      }
      return { role, content: textPart };
    });

    const groqMessages = [{ role:'system', content: systemPrompt }, ...normalized];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+apiKey },
      body: JSON.stringify({ model, messages:groqMessages, temperature:TEMP[safeMode]??0.7, max_tokens:maxTokens, stream:false }),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(()=>({}));
      return res.status(groqRes.status).json({ error: errData?.error?.message||('Groq error '+groqRes.status) });
    }

    const data = await groqRes.json();
    let reply = data?.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: 'Empty response' });

    // Strip DeepSeek R1 think tags
    if (safeMode === 'think') reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    return res.status(200).json({ reply, model, mode: safeMode });

  } catch(err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: err.message||'Internal server error' });
  }
}

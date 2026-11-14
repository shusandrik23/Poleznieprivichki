// Cloudflare Worker «Попугай-ритор»: принимает расшифровку речи из приложения «Говорун»
// и возвращает живую обратную связь в 2–3 предложениях от нейросети Workers AI (бесплатная квота Cloudflare).
// Промпт собирается здесь, на сервере, — поэтому Worker нельзя использовать как «бесплатный чат» для чего-то другого.

const MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];
const RATE_LIMIT = 20; // запросов в минуту с одного IP (в пределах одного экземпляра Worker)
const hits = new Map();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE_LIMIT;
}

const SYSTEM = [
  'Ты — Попугай-ритор, весёлый и доброжелательный тренер по ораторскому искусству в приложении «Говорун».',
  'Отвечай только по-русски, 2–3 коротких предложения, обращайся на «ты», без списков, заголовков и markdown.',
  'Оцени, насколько убедительно звучит мысль и сработал ли нужный риторический приём (если он указан).',
  'Сначала похвали что-то конкретное из речи, затем дай один практичный совет. Можно одно попугайское словечко вроде «Кр-р-расота!».',
  'Не выдумывай того, чего нет в расшифровке. Расшифровка сделана автоматическим распознаванием, поэтому в ней нет знаков препинания и могут быть ошибки — не ругай за них.',
  'Если расшифровка пустая или бессмысленная, мягко попроси попробовать ещё раз.',
].join(' ');

function buildPrompt(b) {
  const lines = [];
  const mode = { lesson: 'Голосовое задание урока', pitch: 'Лифтовая презентация', improv: 'Импровизация со случайными словами' }[b.mode] || 'Упражнение';
  lines.push(`Упражнение: ${mode}.`);
  if (b.technique) lines.push(`Изучаемый приём: ${clip(b.technique, 120)}${b.techniqueHint ? ` (${clip(b.techniqueHint, 200)})` : ''}.`);
  if (b.task) lines.push(`Задание: ${clip(b.task, 300)}`);
  if (b.topic) lines.push(`Тема: ${clip(b.topic, 150)}.`);
  if (Array.isArray(b.words) && b.words.length) lines.push(`Слова, которые нужно было вплести: ${b.words.slice(0, 12).map((w) => clip(w, 30)).join(', ')}.`);
  if (b.seconds) lines.push(`Длительность: ${Math.round(Number(b.seconds) || 0)} с.`);
  if (b.wpm) lines.push(`Темп: ${Math.round(Number(b.wpm) || 0)} слов в минуту (комфортно 110–150).`);
  const f = b.fillers && typeof b.fillers === 'object' ? Object.entries(b.fillers).slice(0, 10) : [];
  lines.push(f.length ? `Слова-паразиты: ${f.map(([w, n]) => `«${clip(w, 20)}» ×${Number(n) || 0}`).join(', ')}.` : 'Слов-паразитов нет.');
  lines.push(`Расшифровка речи: ${clip(b.transcript, 1500) || '(пусто)'}`);
  return lines.join('\n');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (request.method === 'GET') return json({ ok: true, service: 'govorun-parrot' });
    if (request.method !== 'POST' || url.pathname !== '/feedback') return json({ error: 'not_found' }, 404);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (limited(ip)) return json({ error: 'rate_limited' }, 429);

    let body;
    try {
      const raw = await request.text();
      if (raw.length > 8000) return json({ error: 'too_large' }, 413);
      body = JSON.parse(raw);
    } catch (e) {
      return json({ error: 'bad_json' }, 400);
    }

    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildPrompt(body || {}) },
    ];

    for (const model of MODELS) {
      try {
        const out = await env.AI.run(model, { messages, max_tokens: 220, temperature: 0.7 });
        const text = clip(out?.response ?? out?.choices?.[0]?.message?.content, 900);
        if (text) return json({ text });
      } catch (e) {
        // пробуем следующую модель
      }
    }
    return json({ error: 'ai_unavailable' }, 503);
  },
};

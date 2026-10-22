// Shared state for Jay's card: a privacy-friendly visitor counter and a guestbook.
// No IP addresses, cookies, or other personal data are stored.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const clean = (v, max) =>
  String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

router.get('/stats', async () => {
  const visits = Number(await me.puter.kv.get('visits')) || 0;
  return { visits };
});

router.post('/visit', async () => {
  const visits = await me.puter.kv.incr('visits');
  return { visits: Number(visits) || 0 };
});

router.get('/guestbook', async () => {
  let rows = [];
  try { rows = (await me.puter.kv.list('gb:*', true)) || []; } catch (e) { rows = []; }
  const entries = rows
    .map(r => { try { return typeof r.value === 'string' ? JSON.parse(r.value) : r.value; } catch (e) { return null; } })
    .filter(e => e && e.name && e.message)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 30);
  return { entries };
});

router.post('/guestbook', async ({ request }) => {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid request' }, 400); }
  if (body && body.website) return { ok: true }; // honeypot for bots
  const name = clean(body && body.name, 40);
  const message = clean(body && body.message, 280);
  if (!name || !message) return json({ error: 'Please add a name and a message.' }, 400);
  const ts = Date.now();
  const id = crypto.randomUUID();
  const entry = { id, name, message, ts };
  await me.puter.kv.set(`gb:${ts}:${id}`, JSON.stringify(entry));
  return { ok: true, entry };
});

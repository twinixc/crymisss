// api/_redis.js — Redis клиент (node-redis v4)
import { createClient } from 'redis';

let client = null;

export async function getRedis() {
  if (client && client.isOpen) return client;
  const url = process.env.Popa_REDIS_URL;
  if (!url) throw new Error('Popa_REDIS_URL not set');
  client = createClient({ url });
  client.on('error', err => console.error('Redis:', err));
  await client.connect();
  return client;
}

export async function kvGet(key) {
  const r = await getRedis();
  const val = await r.get(key);
  if (val === null) throw new Error('not found');
  try { return JSON.parse(val); } catch(_) { return val; }
}

export async function kvSet(key, value, opts) {
  const r = await getRedis();
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (opts?.ex) await r.set(key, str, { EX: opts.ex });
  else await r.set(key, str);
  return value;
}

export async function kvDel(key) {
  const r = await getRedis();
  await r.del(key);
}

export async function kvIncr(key) {
  const r = await getRedis();
  return r.incr(key);
}

export async function kvDecr(key) {
  const r = await getRedis();
  return r.decr(key);
}

export async function kvZAdd(key, score, member) {
  const r = await getRedis();
  return r.zAdd(key, [{ score: Number(score), value: String(member) }]);
}

export async function kvZRem(key, member) {
  const r = await getRedis();
  return r.zRem(key, String(member));
}

export async function kvSAdd(key, member) {
  const r = await getRedis();
  return r.sAdd(key, String(member));
}

export async function kvSRem(key, member) {
  const r = await getRedis();
  return r.sRem(key, String(member));
}

export async function kvSCard(key) {
  const r = await getRedis();
  return r.sCard(key);
}

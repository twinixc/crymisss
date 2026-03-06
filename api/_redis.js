// api/_redis.js — общий Redis клиент для всех API
// Использует node-redis с переменной Popa_REDIS_URL

import { createClient } from 'redis';

let client = null;

export async function getRedis() {
  if (client && client.isOpen) return client;

  const url = process.env.Popa_REDIS_URL;
  if (!url) throw new Error('Popa_REDIS_URL not set');

  client = createClient({ url });
  client.on('error', (err) => console.error('Redis error:', err));
  await client.connect();
  return client;
}

// Helpers matching @vercel/kv interface so other files are easy to update

export async function kvGet(key) {
  const r = await getRedis();
  const val = await r.get(key);
  if (val === null) throw new Error('Key not found: ' + key);
  return JSON.parse(val);
}

export async function kvSet(key, value, opts) {
  const r = await getRedis();
  const args = [key, JSON.stringify(value)];
  if (opts?.ex) {
    await r.set(key, JSON.stringify(value), { EX: opts.ex });
  } else {
    await r.set(key, JSON.stringify(value));
  }
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
  return r.zAdd(key, [{ score, value: member }]);
}

export async function kvZRange(key, min, max, rev = false) {
  const r = await getRedis();
  if (rev) return r.zRange(key, max, min, { REV: true });
  return r.zRange(key, min, max);
}

export async function kvZRem(key, member) {
  const r = await getRedis();
  return r.zRem(key, member);
}

export async function kvSAdd(key, member) {
  const r = await getRedis();
  return r.sAdd(key, member);
}

export async function kvSRem(key, member) {
  const r = await getRedis();
  return r.sRem(key, member);
}

export async function kvSCard(key) {
  const r = await getRedis();
  return r.sCard(key);
}

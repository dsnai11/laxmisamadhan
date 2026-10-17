// Minimal REST client for preparing demo data behind the scenes.
import { BASE_URL } from '../accounts.mjs';

const API = `${BASE_URL}/api/v1`;

export async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export async function login({ email, password }) {
  const { json } = await call('POST', '/auth/login', null, { email, password });
  if (!json.success) throw new Error(`Login failed for ${email}: ${json.message}`);
  return { token: json.data.accessToken ?? json.data.tokens?.accessToken, user: json.data.user };
}

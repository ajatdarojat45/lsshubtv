// Replica of UrlTools.signPlayUrl from the original app:
//   token = urlEncode(base64(AES-256-CTR(rbSession, key, iv))) + 'a'
//   playUrl final = playUrl with "https://<host>/" -> "https://<host>/token-<token>/"
//
// key = 32 ASCII bytes, iv = 16 ASCII bytes — loaded from .env (see .env.example).

import { required } from './env';

const KEY = required(process.env.RB_SIGN_KEY, 'RB_SIGN_KEY');
const IV = required(process.env.RB_SIGN_IV, 'RB_SIGN_IV');

export async function signPlayUrl(playUrl: string, rbSession: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(KEY),
    { name: 'AES-CTR' },
    false,
    ['encrypt']
  );
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-CTR', counter: enc.encode(IV), length: 128 },
      key,
      enc.encode(rbSession)
    )
  );
  let bin = '';
  for (const b of ct) bin += String.fromCharCode(b);
  const token = encodeURIComponent(btoa(bin)) + 'a';
  const u = new URL(playUrl);
  return playUrl.replace(`https://${u.host}/`, `https://${u.host}/token-${token}/`);
}

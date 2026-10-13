import { createHmac } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function toBase32(bytes: Buffer): string {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function fromBase32(text: string): Buffer {
  let bits = '';
  for (const c of text.toUpperCase()) bits += ALPHABET.indexOf(c).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function codeForStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', fromBase32(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const value = hmac.readUInt32BE(offset) & 0x7fffffff;
  return (value % 1_000_000).toString().padStart(6, '0');
}

let lastStep = 0;

/**
 * A code the server will accept. The server rejects any step that is not newer than the last one used
 * (replay protection) and accepts one step of clock drift, so consecutive sign-ins take consecutive steps (never a future
 * one) and wait for the clock when that window is used up.
 */
export async function nextTotp(secret: string): Promise<string> {
  for (;;) {
    const now = Math.floor(Date.now() / 1000 / 30);
    const step = Math.max(lastStep + 1, now - 1);
    if (step <= now) {
      lastStep = step;
      return codeForStep(secret, step);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

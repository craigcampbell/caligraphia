// Argon2id password / recovery-code hashing. A small in-flight cap stops a login
// flood from exhausting the libuv pool and OOMing the shared box.
import { hash, verify } from "@node-rs/argon2";

// algorithm 2 = Argon2id (its const enum can't be referenced by value under
// isolatedModules, so use the literal).
const OPTS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

let inFlight = 0;
const MAX_INFLIGHT = 2;

export class KdfBusyError extends Error {}

async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_INFLIGHT) throw new KdfBusyError();
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
  }
}

export function hashPassword(plain: string): Promise<string> {
  return guarded(() => hash(plain, OPTS));
}

export function verifyPassword(stored: string, plain: string): Promise<boolean> {
  return guarded(() => verify(stored, plain)).catch((e) => {
    if (e instanceof KdfBusyError) throw e;
    return false;
  });
}

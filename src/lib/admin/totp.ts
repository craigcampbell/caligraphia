// TOTP (authenticator-app 2FA). window:0 means no acceptance window, so a code
// is valid for exactly its 30s step — combined with the lastTotpStep check, a
// captured code can't be replayed.
import { authenticator } from "otplib";
import QRCode from "qrcode";

authenticator.options = { window: 0, step: 30 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpUri(username: string, secret: string): string {
  return authenticator.keyuri(username, "Caligraphia Admin", secret);
}

export function totpQrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri);
}

// Returns the matched 30s timestep (for anti-replay) on success, else null.
export function verifyTotpStep(token: string, secret: string): number | null {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  let ok = false;
  try {
    ok = authenticator.verify({ token: clean, secret });
  } catch {
    ok = false;
  }
  return ok ? Math.floor(Date.now() / 1000 / 30) : null;
}

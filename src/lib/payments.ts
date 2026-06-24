import Stripe from "stripe";

// Stamp packs you can buy with real money. Tune freely. cents = USD price.
export const STAMP_PACKS = [
  { id: "p50", stamps: 50, cents: 500, label: "50 stamps" },
  { id: "p100", stamps: 100, cents: 1000, label: "100 stamps" },
  { id: "p300", stamps: 300, cents: 2500, label: "300 stamps · best value" },
] as const;

export type StampPack = (typeof STAMP_PACKS)[number];

export function getStampPack(id: string): StampPack | undefined {
  return STAMP_PACKS.find((p) => p.id === id);
}

// Stripe is optional: until STRIPE_SECRET_KEY is set, buying is simply disabled
// (the rest of the app, and the stamp economy, work without it).
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let _stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

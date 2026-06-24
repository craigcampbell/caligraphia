# Caligraphia — Print & Mail a Real Letter (integration plan)

> Idea: a sender pays to have their handwritten letter or postcard **physically
> printed and mailed** to the recipient's real address. A genuine,
> people-will-pay-for-it feature that fits the app's soul far better than ads.

## Why this is a good fit

The hard part is already done: **the app renders a high-fidelity PNG of every
letter and postcard** (`finalImageUrl`, and the photo-postcard front/back). Those
images are exactly what print-and-mail APIs ingest. So "what to print" is solved —
the work is address capture, payment, and an API call.

## The services (US, single-piece, REST API, price *includes* print + postage)

| Service | Postcard from | Letters | Notes |
|---|---|---|---|
| **Lob** | custom (API is free) | ✅ | Most established US provider, excellent docs + address verification. Great default. |
| **PostGrid** | **$0.82**/pc | ✅ | Clean API, free sandbox/test keys, built-in address verification. |
| **Click2Mail** | **$0.54–0.73**/pc | ✅ | Cheapest; international; next-day printing. |
| **Stannp** | ~**$0.88**/pc | ✅ | US + UK, template or custom-image based. |

**Recommendation:** prototype on **PostGrid** or **Lob** (free sandboxes, address
verification included). Use **Click2Mail** if per-piece cost is the priority.

_Prices are indicative (mid-2026) and include print + postage; verify on each
provider's pricing page._

## The user flow

1. Sender composes a letter/postcard (existing flow).
2. New option: **"Mail it for real."**
3. Enter the recipient's **postal address** → verified live by the API.
4. App shows the price = print + postage **+ your margin**.
5. Sender **pays** (Stripe).
6. App sends the rendered image + addresses to the print API.
7. Provider prints + mails; a **webhook** updates status → sender sees
   "printed → in transit → delivered."

## What it takes to build

- **Print provider client** — Lob/PostGrid SDK (API key in `.env`, server-side only).
- **Address capture + verification UI** — one screen; the API validates/normalizes.
- **Payments — the one genuinely new piece: Stripe.** You charge the sender
  (cost + postage + margin) and pay the provider. (Handling card data is out of
  scope for the app itself — Stripe Checkout hosts it; we never touch card numbers.)
- **`MailOrder` model** — `postId`, `provider`, `providerId`, `status`,
  `costCents`, `chargedCents`, `paidAt`, `recipientAddress`.
- **A print-spec render** — the provider wants a PDF/image at print trim + bleed.
  The app renders at 2400×3200 (letter) / 1600×1100 (postcard); for mail it should
  render a **300-DPI master** (US Letter 2550×3300, postcard 1800×1200 + 0.125"
  bleed). Small addition to the existing render pipeline. See
  `premium-stationery-spec.md` §6.
- **Compliance niceties** — a return address, postal content rules, an order
  history/receipts page.

## Money

You set the price; the provider cost is wholesale. Illustrative:

| Piece | Your cost (print+postage) | Suggested charge | Margin |
|---|---|---|---|
| Postcard | ~$0.55–0.85 | **$2.50–3.50** | ~$2–3 |
| Letter (1pg + envelope) | ~$0.90–1.50 | **$3.50–5.00** | ~$2.50–3.50 |

Unlike ads (needs huge traffic for pennies), **people happily pay a few dollars to
send a tangible, handwritten card** — especially for birthdays, thank-yous,
holidays. Even a handful of friends sending real mail beats AdSense on a private
site.

## Suggested phasing

1. **Postcards first** — single image, cheapest postage, the app already has a
   postcard render. Smallest surface area to get the Stripe + provider + webhook
   loop working.
2. **Letters + envelopes** next.
3. **Premium stationery** (see the other doc) becomes an upsell: "mail it on
   *Botanical Spring* paper, +$1."

## Prerequisites you'd handle

- Create accounts: a print provider (Lob/PostGrid/etc.) and **Stripe**. (I can't
  create accounts or enter payment credentials for you — but I'll wire all the
  code once you have the API keys, which go in `.env`.)
- Decide pricing/margin.

When you're ready, say the word and I'll start with the **postcard mail MVP**
(provider client + address screen + Stripe Checkout + `MailOrder` + a print-spec
postcard render).

---

Sources:
- [PostGrid — Print & Mail / Postcard API pricing](https://www.postgrid.com/postcard-api/)
- [Lob — pricing & APIs](https://www.lob.com/pricing)
- [Click2Mail — API services](https://click2mail.com/by-service)
- [Stannp — postcard API](https://www.stannp.com/us/direct-mail-api/postcards)

# Croquia — Honest Assessment & Kanban

*Written 2026-06-09 after a full read of VISION.md, ARCHITECTURE.md, the schema, all API routes, and the frontend.*

---

## The Verdict

**The core idea is good. The roadmap is what's dumb.**

A no-text, handwriting-only social space is genuinely differentiated and well-timed — anti-AI-slop sentiment is real, the fountain pen / journaling / penpal niche is large and passionate, and nobody owns this space. The craft in the codebase is real too: pressure-sensitive stroke capture, server-side rendering, OCR-as-discovery, the midnight ink easter egg. This is not a dumb project.

But VISION.md is two documents fighting each other:

1. **A love letter to slow, handmade correspondence** (envelopes, wax seals, paper aging, letter exchange) — this is the product.
2. **A tokenomics + Instagram-growth playbook** (5 rarity tiers, scarcity, burned currency, anti-farming detection, vertical swipe feed, CLIP embeddings, Hetzner cluster diagrams) — this is the distraction.

Document #2 should mostly die. You cannot out-Instagram Instagram with a quill, and a scarcity economy is hostile to the warm thing you're building — charging users a stamp to *like something* adds friction to the only growth loop a zero-user network has. Meanwhile the actual killer mechanic (**Letter Exchange** — pair two strangers, each writes the other a letter) is buried in an appendix labeled "wouldn't it be cool if."

**Is it worth it?** As a VC-scale social network: no — all new social networks are lottery tickets, and this one's posting friction is deliberately high. As a niche community product for the pen/stationery/penpal crowd (think 1k–50k devoted users, ~$20/mo infra): plausible and sustainable. As a portfolio piece: already strong. Build it for the niche and for yourself; if it catches a wave, great.

**Realistic effort to a private beta you could show people:** 4–6 focused weekends, *if* you cut scope as below. The blockers are small in number but absolute (auth is currently decorative — see Bugs).

**The reframe that makes it work:** Croquia is not "Instagram for handwriting." It is **correspondence-first**: the inbox, 1:1 letters, reply chains, and the stranger exchange are the product. The public feed is the lobby, not the building. The schema already half-knows this (`recipientId`, `isPrivate`, inbox route all exist).

---

## 🔥 NOW — Blockers (broken or insecure; nothing else matters until these are done)

- [ ] **Fix auth: anyone can log in as anyone.** `send-magic-link/route.ts` returns the magic link *in the API response* — no email is ever sent, so any visitor can mint a session for any address. Integrate a real sender (Resend is the least-effort: one API call, free tier) and never return the link in the response outside dev.
- [ ] **Remove hardcoded fallback secrets** in `src/lib/auth.ts` (`"dev-secret-change-in-production"`). Throw on boot if `JWT_SECRET`/`MAGIC_LINK_SECRET` are unset in production.
- [ ] **Regenerate the Prisma client.** `npx prisma generate` + `db push` — the generated client is stale, causing the 5 existing `tsc` errors (`recipientId`, `paperType`, `stampBalance` "don't exist"). The dev environment is mid-migration right now.
- [ ] **Fix the group feed — it always returns zero posts.** `posts/route.ts:40` uses `ocrHashtags: { hasSome: [] }`, which Prisma defines as match-nothing. The regex filter after it never sees a single post. Fetch recent posts plainly, then filter by the group pattern (and see the ReDoS item below).
- [ ] **Wrap stamp spend/refund in a transaction.** `posts/[id]/stamp/route.ts` does check-balance-then-update as separate queries — two concurrent requests can double-spend or double-refund. Use `prisma.$transaction` with a guarded `updateMany({ where: { stampBalance: { gte: 1 } } })` and check the affected count.
- [ ] **Don't compile user-supplied regex.** `tagPattern` from group creation is fed to `new RegExp()` server-side — ReDoS risk. Replace with plain substring/prefix matching on hashtags (`#poem|#poetry` can be a list of literals, not a regex).
- [ ] **Get `eng.traineddata` (5 MB, root-owned) out of git.** Download it at build/start time or in the Docker image; add to `.gitignore`.

## 🎯 NEXT — Make the core loop real (the product decisions)

- [ ] **Collapse three reaction systems into one.** Code currently has like, dislike, AND stamp. Drop dislike entirely (it's a downvote on someone's handwriting — pure meanness, no value). Make "stamp" the only reaction. **Make it free or near-free** — generous daily allowance, refilled automatically. Scarcity kills engagement at zero users.
- [ ] **Build Letter Exchange — this is the hero feature.** Weekly (or on-demand) pairing of two users who each write the other one letter. It solves cold start (every participant both creates content and receives some), it's the emotional core ("a stranger wrote this for *me*"), and no other app has it. Promote it from Appendix A to the front page.
- [ ] **Lean correspondence-first.** The inbox (`/inbox`, `recipientId`, `isPrivate`) already exists. Make "write a letter *to someone*" the primary CTA and the public feed secondary. Reply chains (the `Reply` model exists, unused) come right after.
- [ ] **Nail finger-and-stylus drawing on phones.** Be honest: most people's finger-handwriting is awful, and this app lives or dies on whether making a letter feels good on a phone/iPad. Budget real time for: palm rejection, line smoothing/stabilization (a simple moving-average or one-euro filter goes far), pinch-zoom-while-drawing, and an undo for the last stroke (the "no undo" purity rule fights mobile reality — keep no-undo for pen plotters, not humans).
- [ ] **One light "is this handwriting?" gate on photo posts.** You already run OCR on uploads; if a photo yields zero handwriting-like text and no strokes, queue it for the existing flag system rather than building ML detection. Cheap, good enough for the niche stage.
- [ ] **Add ~10 smoke tests + CI.** There are zero tests. Just cover: signup/login flow, post creation, stamp spend (the transaction), feed pagination, group matching. A GitHub Action running `tsc` + tests would have caught the stale-client breakage already.

## 🧊 LATER — Only after real humans are using it

- [ ] Stamp *designs* as cosmetic collectibles — seasonal artwork, no scarcity mechanics, no balance implications. Pure delight, zero tokenomics.
- [ ] Paper aging (CSS sepia/vignette by post age) — cheap to build, on-theme, genuinely charming. Do it when the core loop works.
- [ ] Marginalia tools (evolve Scratch: pencil/highlighter variants). The Scratch system already works; this is polish.
- [ ] Envelope-open animation polish & wax seal moment (partially built in `seal.ts` / `LetterEnvelope` — finish, don't expand).
- [ ] Move canvas render + OCR out of the request path into a simple queue — *when* posting volume makes the 3–5s sync render hurt. Not before.
- [ ] Counts as columns on Post (`likeCount`) to kill the N+1 dislike query in the feed — trivial, do it whenever you're in that file.
- [ ] PWA install + iPad-first layout. Your true early adopters own Apple Pencils.
- [ ] Dead Letter Office (Appendix A) — second-best X-factor idea, cheap to build, very on-brand.

## 🚫 DROP — Actively harmful or premature (deleting these from the vision is the win)

- [ ] **Stamp rarity tiers / scarcity / seasons / burned currency / "mittance" economy.** This is NFT-shaped gamification grafted onto a product whose soul is "slow and human." It also creates a wall of anti-abuse work (farming detection, atomic ledgers) before user #10 exists.
- [ ] **Anti-farming stroke analysis.** You don't have farmers. You have zero users. Rate limits + flags + min draw time (all already built) are plenty.
- [ ] **Instagram-style full-screen vertical swipe feed.** Wrong genre. Envelopes on a table (you built `PaperTableView` — a wooden desk with scattered letters!) is *more* distinctive than a TikTok clone.
- [ ] **CLIP embeddings / visual similarity discovery.** Serious infra for a discovery problem you won't have until ~10k posts. OCR hashtags already work.
- [ ] **Signature-as-biometric-verification.** A signature block is cute cosmetics; "biometric-like verification" is a claim you can't back and a feature nobody asked for.
- [ ] **Hetzner cluster planning / partitioning / PgBouncer / Redis feeds / k6 load testing.** Phase-3 scaling docs for a pre-launch app are procrastination with extra steps. One $5 VPS + Backblaze + Cloudflare is the whole infra story until ~5k users. (Keep the VISION §6 doc as a someday-reference; just don't *do* any of it.)
- [ ] **Priority mail / postage-paid reply / paid feed placement.** Pay-to-jump-the-queue mechanics in a community of 50 people reads as desperate. Revisit monetization only after retention exists.

## ✅ ALREADY GOOD — Don't touch, don't gold-plate

- Canvas engine: pressure, ink styles, paper textures, seeded ink randomness, midnight ink (2–4 AM silver — keep this secret and never document it).
- No-text-input enforcement at both frontend and API level — the identity constraint, well executed.
- Magic-link *flow* UX (once it actually sends email).
- OCR hashtags → groups: clever discovery without a search bar.
- Scratch overlays with server-side compositing.
- The new visual direction: IBM Plex Serif, black ink on cream, small radii. Refined, not vibe-coded.
- Docker Compose dev setup; cursor pagination.

---

## The one-paragraph strategy

Fix auth, collapse the reaction systems, and ship the Letter Exchange to 30 people from r/fountainpens and r/penpals. If the exchange creates even a handful of repeat correspondences, you have something real and the niche will tell their friends — that community is starving for exactly this. If nobody comes back to write a second letter, you'll know in a month, having spent six weekends and $20 — and you'll still own a beautiful, finished portfolio piece. Either outcome beats spending the year building a stamp economy for an empty post office.

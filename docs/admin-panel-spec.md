I have all the grounding I need. The key facts are confirmed: lenient `requireSecret` (only throws in prod), unpinned `jwt.verify`, in-memory rate-limit, `objectKeyFromUrl` falls through to returning the raw URL, `127.0.0.1:3000` published, legacy `serverComponentsExternalPackages`, bare Dockerfile, no security headers. Here is the synthesized spec.

---

# Caligraphia SUPER-SECURE Admin Panel — Implementation Spec (Frozen)

This is the single source of truth. Where the four design parts contradicted each other, the most secure concrete option is chosen and frozen below. Every threat-review mitigation (CRITICAL through LOW across authn-authz, injection, web, ops-data) is folded in. Implement exactly this.

## Frozen decisions (resolving cross-part contradictions)

| Primitive | FROZEN VALUE | Rejected alternatives |
|---|---|---|
| Password / recovery / code hashing | **Argon2id** (`@node-rs/argon2`) everywhere — no bcrypt anywhere | bcrypt (Parts 2/4 comments) — truncates at 72 bytes, blocks event loop |
| Admin cookie name | **`calig_admin`** (+ `calig_admin_csrf`) | `croquis_admin` (Part 4) |
| Admin route tree | **`src/app/admin/api/**`** served under URL `/admin/api/...` | `/api/admin/**` (Parts 2–4) — cookie `path=/admin` would never attach |
| Admin cookie path | **`/admin/`** (trailing slash, tightens prefix match) | `/admin` (leaks to `/admin-evil`), `/` (collapses isolation) |
| Recovery codes storage | **`AdminRecoveryCode` table** (per-row `usedAt`, transactional) | `Json` column (Parts 2/4) — defeats one-time guard |
| Session model | **DB `AdminSession` + 5-min JWT + 2h absolute cap** | 15-min JWT / 8h cap (Part 1) — shortened per M1/C2 |
| TOTP secret at rest | **AES-256-GCM**, key `ADMIN_TOTP_ENC_KEY` | plaintext (Part 1 "pragmatic") |
| Report status enum | **`open | resolved | dismissed`** | `actioned` (Part 4) |
| Audit model name | **`AdminAudit`** | `AuditLog` (Part 4) |
| Token kind | explicit `typ: "session" | "totp_pending" | "enroll" | "must_change_pw"` claim, mutually exclusive | implicit `scope`/`stage`/`sid`-presence (Part 1) |

A CI assertion test (`__tests__/admin-cookie-path.test.ts`) asserts the admin cookie `path` is a prefix of the admin URL base, and that `ADMIN_JWT_SECRET !== JWT_SECRET`.

---

## 1. Security model

### 1.0 Dependencies (exact versions)

`package.json` `dependencies`:
```jsonc
"@node-rs/argon2": "1.8.3",
"otplib": "12.0.1",
"qrcode": "1.5.4",
"jose": "5.9.6",        // Edge-safe JWT verify in middleware
"pg": "8.13.1"          // dedicated session for maintenance (no arbitrary-SQL helper — see §4)
```
`devDependencies`: `"@types/qrcode": "1.5.5"`.

`next.config.js`: add `@node-rs/argon2` to `serverComponentsExternalPackages` (L1 — prevents bundling the native module and silently falling back). Also add the security-headers block in §1.7.

> Native module: `@node-rs/argon2` ships prebuilt `linux-x64-gnu`; works on `node:20-slim` (glibc). **Never switch base image to Alpine/musl** without adding `@node-rs/argon2-linux-x64-musl`. All admin routes + middleware-Node paths run on **Node.js runtime** (`export const runtime = "nodejs"`), never Edge, except the thin `jose`-based middleware.

### 1.1 Secret bootstrapping — hard fail-fast (H2, L2)

`src/lib/admin/env.ts` — validated at **module import**, regardless of `NODE_ENV`:
```ts
function requireAdminSecret(name: string, minBytes = 32): string {
  const v = process.env[name];
  if (!v || Buffer.byteLength(v, "utf8") < minBytes) {
    throw new Error(`${name} must be set and >= ${minBytes} bytes`);
  }
  return v;
}
export const ADMIN_JWT_SECRET = requireAdminSecret("ADMIN_JWT_SECRET");
export const ADMIN_TOTP_ENC_KEY_B64 = requireAdminSecret("ADMIN_TOTP_ENC_KEY", 44); // 32 bytes base64
export const BACKUP_ENC_PUBKEY = process.env.BACKUP_ENC_PUBKEY ?? ""; // age recipient, see §4
if (ADMIN_JWT_SECRET === process.env.JWT_SECRET) {
  throw new Error("ADMIN_JWT_SECRET must differ from JWT_SECRET"); // L2: prevents cross-forgery
}
```
There is **no dev fallback** for admin secrets. The lenient `requireSecret` in `src/lib/auth.ts` is never reused for the admin subsystem.

### 1.2 Password & code hashing — `src/lib/admin/password.ts`

```ts
import { hash, verify, Algorithm } from "@node-rs/argon2";
const OPTS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

// Concurrency cap so a login flood can't exhaust the libuv pool / OOM the shared box (C2-web).
let inFlight = 0; const MAX_INFLIGHT = 2;
export class KdfBusyError extends Error {}
async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_INFLIGHT) throw new KdfBusyError();
  inFlight++; try { return await fn(); } finally { inFlight--; }
}
export const hashPassword = (p: string) => guarded(() => hash(p, OPTS));
export const verifyPassword = (stored: string, p: string) =>
  guarded(() => verify(stored, p)).catch((e) => { if (e instanceof KdfBusyError) throw e; return false; });
```
The route maps `KdfBusyError` → HTTP 503 `Retry-After`. `memoryCost` stays 19 MiB (shared host); rate-limit/lockout is the real brute-force defense.

### 1.3 TOTP — `src/lib/admin/totp.ts` + `crypto.ts`

`crypto.ts`: AES-256-GCM helpers `encryptSecret(plain): string` / `decryptSecret(enc): string` over `node:crypto` `createCipheriv("aes-256-gcm", key, iv)`, key = `Buffer.from(ADMIN_TOTP_ENC_KEY_B64,"base64")`, format `iv:tag:ciphertext` (base64). Used for `totpSecret` + `pendingTotpSecret`.

`totp.ts`:
```ts
import { authenticator } from "otplib";
import QRCode from "qrcode";
authenticator.options = { window: 0, step: 30 }; // window:0 — no replay window (H5/M4)
export const generateTotpSecret = () => authenticator.generateSecret();
export const totpUri = (u: string, s: string) => authenticator.keyuri(u, "Caligraphia Admin", s);
export const totpQrDataUrl = (uri: string) => QRCode.toDataURL(uri);
// returns the matched timestep for anti-replay, or null
export function verifyTotpStep(token: string, secret: string): number | null {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null; // only numeric 6-digit reaches TOTP path (M3)
  const ok = authenticator.verify({ token: clean, secret });
  return ok ? Math.floor(Date.now() / 1000 / 30) : null;
}
```
**Anti-replay (H5/M4):** on TOTP success, compare matched step to `AdminUser.lastTotpStep`; reject if `step <= lastTotpStep`; persist the new step transactionally with login success.

### 1.4 Recovery codes — `src/lib/admin/recovery.ts`

- 10 codes, format `xxxx-xxxx-xxxx`, alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (~60 bits each), argon2-hashed in `AdminRecoveryCode` rows. Shown plaintext once.
- **No O(n) argon2 loop (H6/M2):** each code carries a non-secret **4-char indexed `lookupPrefix`** (first segment). At login, look up the single row by `(adminUserId, lookupPrefix, usedAt:null)`, run **one** `verifyPassword`. Constant work, no remaining-count timing oracle.
- **Recovery path only entered when the client toggles "use recovery code"** and the value matches `xxxx-xxxx-xxxx` — never auto-fallback on a failed numeric TOTP (H6/M3). One-time use enforced in a transaction guarded on `usedAt IS NULL`.
- Recovery-stage failures count toward per-account lockout. Regenerated on every re-enroll (old rows hard-deleted in the same tx).

### 1.5 Session token & cookies — `src/lib/admin/session.ts`

JWT pinned algorithm + explicit type claim + `aud`/`iss` (L2):
```ts
import jwt from "jsonwebtoken";
import { ADMIN_JWT_SECRET } from "./env";
const ADMIN_COOKIE = "calig_admin", CSRF_COOKIE = "calig_admin_csrf";
type Typ = "session" | "totp_pending" | "enroll" | "must_change_pw";
export interface AdminJwt { sub: string; sid?: string; typ: Typ; }
const COMMON = { algorithm: "HS256", audience: "calig-admin", issuer: "caligraphia" } as const;
export const signAdmin = (p: AdminJwt, ttl: string) =>
  jwt.sign(p, ADMIN_JWT_SECRET, { ...COMMON, expiresIn: ttl });
export const verifyAdmin = (t: string) =>
  jwt.verify(t, ADMIN_JWT_SECRET, { algorithms: ["HS256"], audience: "calig-admin", issuer: "caligraphia" }) as AdminJwt;
```
Also retrofit `src/lib/auth.ts` `verifySessionToken` with `{ algorithms: ["HS256"] }` (H3).

| Property | Value |
|---|---|
| Cookie names | `calig_admin` (httpOnly), `calig_admin_csrf` (readable) |
| `secure` | `true` in production |
| `sameSite` | `strict` (both) |
| `path` | `/admin/` (both) |
| Signing secret | `ADMIN_JWT_SECRET` (≥32 bytes, ≠ `JWT_SECRET`) |
| Full-session JWT exp | **5 min** (rolling) |
| `totp_pending` / `enroll` / `must_change_pw` JWT exp | **5 min** |
| Absolute session cap | **2h** (`AdminSession.absoluteExpiresAt`, never extended) |
| Idle sliding cap | **60 min** (`lastActivityAt`, server-enforced) |

Cookie set/clear set/clear all three (session + csrf) with **identical** `path:/admin/` attrs (L1). Logout clears both.

### 1.6 `requireAdmin()` guard — `src/lib/admin/guard.ts` (fail-closed)

Order matters. Every check runs on **every** request including GET (C2: Origin enforced on all methods; do not slide/re-mint on Origin failure).

```ts
export async function requireAdmin(req: Request, opts?: { typ?: Typ }) {
  const expectTyp = opts?.typ ?? "session";
  // 0. Origin/Referer for ALL methods, fail closed (C2-authz, H2/H3-web, L3)
  assertSameOrigin(req); // throws 403 if BASE_URL unset OR origin/referer absent OR mismatched
  // 1. token + signature + exp + EXACT typ (C3)
  const token = (await cookies()).get("calig_admin")?.value;
  if (!token) throw new AdminAuthError(401, "No session");
  let c: AdminJwt; try { c = verifyAdmin(token); } catch { throw new AdminAuthError(401, "Invalid"); }
  if (c.typ !== expectTyp) throw new AdminAuthError(401, "Wrong token type");
  if (expectTyp === "session" && !c.sid) throw new AdminAuthError(401, "Incomplete");
  // 2. DB session is source of truth — NON-NEGOTIABLE every request (M1-authz)
  const s = await prisma.adminSession.findUnique({ where: { id: c.sid! }, include: { admin: true } });
  if (!s || s.revokedAt) throw new AdminAuthError(401, "Revoked");
  if (!s.admin.isActive) throw new AdminAuthError(403, "Disabled");
  const now = Date.now();
  if (now > s.absoluteExpiresAt.getTime()) { await revoke(s.id); throw new AdminAuthError(401, "Expired"); }
  if (now - s.lastActivityAt.getTime() > 60*60*1000) { await revoke(s.id); await clearAdminCookie(); throw new AdminAuthError(401, "Idle"); }
  if (s.admin.mustChangePassword) throw new AdminAuthError(409, "Password change required"); // M2-authz
  // 3. CSRF double-submit for mutations
  if (req.method !== "GET" && req.method !== "HEAD") {
    const hdr = req.headers.get("x-admin-csrf") ?? "";
    if (!safeEqual(hdr, s.csrfSecret)) throw new AdminAuthError(403, "CSRF");
  }
  // 4. slide + re-issue (throttled: only persist if advanced >30s; clock only, never gates revocation)
  if (now - s.lastActivityAt.getTime() > 30_000)
    await prisma.adminSession.update({ where: { id: s.id }, data: { lastActivityAt: new Date() } });
  await setAdminCookie(signAdmin({ sub: s.adminUserId, sid: s.id, typ: "session" }, "5m"));
  return { adminId: s.adminUserId, sid: s.id, session: s };
}
```
- `assertSameOrigin`: compares `Origin` (fallback `Referer`) host to `new URL(requireEnv("BASE_URL")).host`. **No localhost fallback in prod; reject if BASE_URL missing or both headers absent** (H2-web, L3).
- `safeEqual`: length-guarded `timingSafeEqual`.
- **`withAdmin(handler, opts)` HOF wrapper (H4):** all admin handlers are wrapped; it runs `requireAdmin` + writes the audit row, then calls the handler. A CI test (`__tests__/admin-route-coverage.test.ts`) enumerates every file under `src/app/admin/api/**` and asserts each exported `POST/DELETE/PATCH/PUT` is wrapped in `withAdmin` (or is an explicit login/enroll route with its own typed guard). Never rely on middleware for authorization.
- Dedicated guards reuse `requireAdmin` with `opts.typ`: `requireEnrollSession` (`typ:"enroll"`, also asserts `totpEnabledAt == null`), `requireTotpPending` (`typ:"totp_pending"`), `requireMustChangePw` (`typ:"must_change_pw"`).

### 1.7 Security headers & middleware — `src/middleware.ts` + `next.config.js`

**Clickjacking is wide open today (C3-web).** Add to both `next.config.js` `headers()` (global) and `src/middleware.ts` for `/admin/:path*`:
```
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```
CSP is **load-bearing**: the readable CSRF cookie + the `note` text-exemption mean same-origin XSS = full takeover, and only CSP stops that (H4-web).

Middleware (Edge, `jose`, pinned `algorithms:["HS256"]`, audience/issuer) is a **UX redirect only** — signature+exp+`typ==="session"`+`aud`/`iss`, no DB. It never makes an authorization decision. It also injects the security headers and `Cache-Control: no-store` for `/admin/api/2fa/**` (L3-web). `/admin/login` and `/admin/api/login*` are excluded from gating.

### 1.8 Client IP & rate-limit/lockout

**`cf-connecting-ip` is NOT trustworthy as shipped** — `127.0.0.1:3000` is published and cloudflared isn't in the loopback path (C1-web, H1/H3-authz, H3-ops). Resolution, all required:
1. **Remove the `127.0.0.1:3000:3000` mapping from prod `docker-compose.tunnel.yml`** (make "fully private" the default).
2. `src/lib/admin/ip.ts getClientIp(req)` trusts `cf-connecting-ip` **only** when a shared secret header `x-tunnel-secret` (injected by cloudflared config, value = env `TUNNEL_SHARED_SECRET`) is present and matches. Otherwise treat as untrusted/unknown and apply the strictest per-account gate.
3. **Per-account lockout is IP-independent and is the primary control.** A spoofable IP must never *cause* a real account lockout — per-IP is advisory throttling only (H1-authz).

Two layers:
- **In-memory fast path** (`src/lib/rate-limit.ts`, add `rateLimitAdminLogin(ip)` = 10/min). Cheap pre-filter; resets on restart (acceptable as pre-filter only).
- **DB-backed authoritative (survives restart):** `src/lib/admin/throttle.ts`
  - Per-account: failed step → `AdminUser.failedAttempts++`. Thresholds set `lockedUntil`: 5→+1min, 10→+15min, 15→+1h. Any success resets. Checked first in login + guard.
  - Per-IP (only when IP is *trusted* per §1.8.2): `> 20` failures / 15 min → reject from that IP for 15 min. **Stop writing attempt rows once an IP/account is already locked** (M4-authz, M3-ops).
  - Retention job prunes `AdminLoginAttempt` > 30 days (M3-ops).

**DoS-gate ordering on login (C2-web):** in-memory limiter → per-account `lockedUntil` → per-IP ledger → **only then** call `verifyPassword`. For an unknown username, run a fixed dummy argon2 hash for timing uniformity **only when the IP/account gate has not tripped**; once throttled, skip the real hash entirely.

---

## 2. Prisma schema additions + ban enforcement

`prisma/schema.prisma`. Drop the unused `Flag` model, `enum FlagReason`, and `flags` relations on `User`/`Post` (zero rows, zero callers).

```prisma
model AdminUser {
  id                 String    @id @default(uuid()) @db.Uuid
  username           String    @unique
  displayName        String?   @map("display_name")
  passwordHash       String    @map("password_hash")        // argon2id
  totpSecret         String?   @map("totp_secret")          // AES-256-GCM
  totpEnabledAt      DateTime? @map("totp_enabled_at")
  pendingTotpSecret  String?   @map("pending_totp_secret")  // AES-256-GCM
  lastTotpStep       Int?      @map("last_totp_step")       // anti-replay
  isActive           Boolean   @default(true) @map("is_active")
  mustChangePassword Boolean   @default(false) @map("must_change_password")
  enrollToken        String?   @map("enroll_token")         // argon2 hash of one-time CLI enroll token (C3-ops)
  enrollTokenExpires DateTime? @map("enroll_token_expires")
  lastLoginAt        DateTime? @map("last_login_at")
  failedAttempts     Int       @default(0) @map("failed_attempts")
  lockedUntil        DateTime? @map("locked_until")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  recoveryCodes   AdminRecoveryCode[]
  sessions        AdminSession[]
  loginAttempts   AdminLoginAttempt[]
  bansIssued      User[]    @relation("BannedByAdmin")
  warningsIssued  Warning[] @relation("WarningByAdmin")
  reportsResolved Report[]  @relation("ReportResolvedByAdmin")
  auditEntries    AdminAudit[]
  @@map("admin_users")
}

model AdminRecoveryCode {
  id           String    @id @default(uuid()) @db.Uuid
  adminUserId  String    @map("admin_user_id") @db.Uuid
  lookupPrefix String    @map("lookup_prefix")  // first 4 chars, indexed (H6 — single-candidate verify)
  codeHash     String    @map("code_hash")       // argon2id
  usedAt       DateTime? @map("used_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  admin AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  @@index([adminUserId, lookupPrefix, usedAt])
  @@map("admin_recovery_codes")
}

model AdminSession {
  id                String   @id @default(uuid()) @db.Uuid  // == JWT sid
  adminUserId       String   @map("admin_user_id") @db.Uuid
  createdAt         DateTime @default(now()) @map("created_at")
  lastActivityAt    DateTime @default(now()) @map("last_activity_at")
  absoluteExpiresAt DateTime @map("absolute_expires_at")     // now + 2h, never extended
  revokedAt         DateTime? @map("revoked_at")
  ip                String?
  userAgent         String?  @map("user_agent")
  csrfSecret        String   @map("csrf_secret")
  admin AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  @@index([adminUserId])
  @@map("admin_sessions")
}

model AdminLoginAttempt {
  id          String   @id @default(uuid()) @db.Uuid
  ip          String
  adminUserId String?  @map("admin_user_id") @db.Uuid
  success     Boolean
  stage       String   // "password" | "totp" | "recovery"
  createdAt   DateTime @default(now()) @map("created_at")
  admin AdminUser? @relation(fields: [adminUserId], references: [id], onDelete: SetNull)
  @@index([ip, createdAt])
  @@index([createdAt])
  @@map("admin_login_attempts")
}

enum ReportTargetType { post user }
enum ReportReason     { slop automated hateful harassment spam other }
enum ReportStatus     { open resolved dismissed }

model Report {
  id         String           @id @default(uuid()) @db.Uuid
  reporterId String           @map("reporter_id") @db.Uuid
  targetType ReportTargetType @map("target_type")
  targetId   String           @map("target_id") @db.Uuid
  postId     String?          @map("post_id") @db.Uuid     // server-set from lookup, never copied from client
  reason     ReportReason
  note       String?          // <=240, text-exempt, admin-only, escaped on render
  status     ReportStatus     @default(open)
  createdAt  DateTime         @default(now()) @map("created_at")
  updatedAt  DateTime         @updatedAt @map("updated_at")
  resolvedByAdminId String?   @map("resolved_by_admin_id") @db.Uuid
  resolvedAt        DateTime? @map("resolved_at")
  resolutionNote    String?   @map("resolution_note")
  reporter        User       @relation("ReportsByUser", fields: [reporterId], references: [id], onDelete: Cascade)
  post            Post?      @relation(fields: [postId], references: [id], onDelete: Cascade)
  resolvedByAdmin AdminUser? @relation("ReportResolvedByAdmin", fields: [resolvedByAdminId], references: [id])
  warnings        Warning[]
  @@index([status, createdAt])
  @@index([targetType, targetId])
  @@map("reports")
}

model Warning {
  id             String    @id @default(uuid()) @db.Uuid
  userId         String    @map("user_id") @db.Uuid
  adminId        String    @map("admin_id") @db.Uuid
  reason         String
  reportId       String?   @map("report_id") @db.Uuid
  acknowledgedAt DateTime? @map("acknowledged_at")
  emailedAt      DateTime? @map("emailed_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  user   User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  admin  AdminUser @relation("WarningByAdmin", fields: [adminId], references: [id])
  report Report?   @relation(fields: [reportId], references: [id])
  @@index([userId, createdAt])
  @@map("warnings")
}

enum AdminAuditAction {
  login_success login_failure post_delete post_restore image_delete
  user_warn user_ban user_unban report_resolve report_dismiss
  db_maintenance backup_download admin_enroll_totp admin_recovery_used
  maintenance_started maintenance_completed maintenance_failed
}

model AdminAudit {
  id         String           @id @default(uuid()) @db.Uuid
  adminId    String?          @map("admin_id") @db.Uuid
  action     AdminAuditAction
  targetType String?          @map("target_type")
  targetId   String?          @map("target_id")
  detail     Json?            // REDACTED allowlist only (H4-ops)
  ip         String?          // only from trusted source (§1.8)
  userAgent  String?          @map("user_agent")
  createdAt  DateTime         @default(now()) @map("created_at")
  admin AdminUser? @relation(fields: [adminId], references: [id])
  @@index([adminId, createdAt])
  @@index([action, createdAt])
  @@map("admin_audit")
}
```

Add to existing `model User`:
```prisma
  bannedAt        DateTime? @map("banned_at")
  banReason       String?   @map("ban_reason")
  bannedByAdminId String?   @map("banned_by_admin_id") @db.Uuid
  sessionEpoch    Int       @default(0) @map("session_epoch")
  bannedByAdmin   AdminUser? @relation("BannedByAdmin", fields: [bannedByAdminId], references: [id])
  warnings        Warning[]
  reportsMade     Report[]  @relation("ReportsByUser")
```

**Partial unique index — created at boot, not via appended migration SQL** (M1-ops: `db push` ignores hand-edited migration SQL). Add to the compose `command:` after `prisma db push`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS reports_open_unique
  ON reports (reporter_id, target_type, target_id) WHERE status = 'open';
```

### Ban enforcement (no skippable path — H1-ops)

`src/lib/auth.ts`: add `epoch` to `SessionPayload`; in `getSession`, after the user lookup:
```ts
if (user.bannedAt) return null;
if ((payload.epoch ?? 0) !== user.sessionEpoch) return null;  // ?? 0 keeps pre-migration tokens valid
return { userId, username, epoch: user.sessionEpoch };
```
- `(payload.epoch ?? 0)` avoids logging everyone out at deploy. **Documented weakness (M5-authz/M5-ops):** force-logout-everyone via epoch bump won't reach pre-migration tokens that were never banned until they expire (7d). Banning still works (it sets `bannedAt`, checked independently). Accept this; do not add a second mechanism.
- **Forbid any direct `verifySessionToken` use in routes** — funnel everything through `getSession()`. CI grep test asserts no route imports `verifySessionToken` directly (H1-ops).
- `getSessionState()` returns `{status:"anon"|"banned"|"ok", banReason?}` for the `/banned` page; `banReason` is **escaped text only**, derived from the validated session, never from a client-supplied id (M6-web).
- Both session-issuing routes (`verify-magic-link`, `signup`) pass `epoch: user.sessionEpoch`.
- A **Prisma client extension** injects `deletedAt: null` into all `Post` finds by default with a `withDeleted` escape hatch for admin (H5-ops) — soft-delete is otherwise not uniformly enforced.

---

## 3. API routes

All admin routes: `src/app/admin/api/**`, `runtime="nodejs"`, wrapped in `withAdmin` (which runs `requireAdmin` + writes audit), text-exempt (never call `enforceNoTextInput`). Audit `detail` is built by a central `writeAudit()` that **redacts via an allowlist** — never `email`, `*Hash`, `*Secret`, `*Token`, raw bodies, `code` (H4-ops).

### Admin auth (login/enroll routes own their typed guards, not `withAdmin`)

| Method · Route | Guard | Action · Audit |
|---|---|---|
| `POST /admin/api/login` | none (typed pre-session issued) | DoS-gate order §1.8; verify password; on success issue `typ:"totp_pending"` 5-min cookie, respond `{next:"totp"}`. If `totpEnabledAt==null` → require valid CLI `enrollToken` in body (C3-ops), issue `typ:"enroll"` cookie. Audit `login_failure` on fail (no body/username plaintext — hash only). |
| `POST /admin/api/login/totp` | `requireTotpPending` | numeric-only → `verifyTotpStep`, anti-replay vs `lastTotpStep`; or "use recovery" toggle → single-candidate recovery verify. On success: reset counters, set `lastLoginAt`, create `AdminSession` (`absoluteExpiresAt=now+2h`, fresh `csrfSecret`), mint `typ:"session"` JWT + CSRF cookie. If `mustChangePassword` → mint `typ:"must_change_pw"` instead. Audit `login_success`. |
| `POST /admin/api/2fa/enroll/start` | `requireEnrollSession` | gen secret, store encrypted `pendingTotpSecret`, return `{uri, qrDataUrl}`. `Cache-Control:no-store`. |
| `POST /admin/api/2fa/enroll/confirm` | `requireEnrollSession` | verify against `pendingTotpSecret`; reject if `totpEnabledAt` already set; move pending→`totpSecret`, set `totpEnabledAt`, generate+return 10 recovery codes once. Audit `admin_enroll_totp`. |
| `POST /admin/api/change-password` | `requireMustChangePw` | validate strength (≥16, breach-list optional), set hash, clear `mustChangePassword`, revoke other sessions, then issue full session. |
| `POST /admin/api/logout` | `withAdmin` | revoke `AdminSession`; clear `calig_admin` + `calig_admin_csrf` (identical paths). |

### Reports — user-facing

| `POST /api/reports` | `getSession()` (user) | Validate `{targetType,targetId,reason,note?}`. `targetId` must match `/^[0-9a-f-]{36}$/`. **Bind strictly to `targetType`** (H3-web): post → load Post + `canViewPost(post, userId)`, **uniform 404** whether missing or unviewable (kills existence oracle); user → load User. Reject if loaded type ≠ `targetType`. Self-report block. **DB-backed** dup + rate limits (H5-web): per-user 5/min **and** per-day cap **and** per-target cap, all `count(Report where ...)`; 24h cooldown on re-report of a dismissed target. `note` ≤240 server-capped, control-chars stripped, **no `enforceNoTextInput`**. `postId` set from server lookup only. 201. |
| `POST /api/warnings/[id]/ack` | `getSession()` | set `acknowledgedAt` (own warning only). |

### Reports — admin queue (all `withAdmin`)

| `GET /admin/api/reports` · `GET /admin/api/reports/[id]` | read | list/detail; hydrate target via admin media proxy. |
| `POST /admin/api/reports/[id]/resolve` / `/dismiss` | mutate | set status + `resolvedByAdminId/resolvedAt/resolutionNote`. Audit `report_resolve`/`report_dismiss`. |

### Moderation (all `withAdmin`)

| `DELETE /admin/api/posts/[id]` | soft-delete (`deletedAt=now`). Target from **route param + own lookup**, never from `Report` (H3-web). Audit `post_delete`. |
| `POST /admin/api/posts/[id]/restore` | clear `deletedAt`. Audit `post_restore`. |
| `DELETE /admin/api/posts/[id]/image` | **hard image purge** — see §4 confirmed-delete + composite enumeration (C2-ops). Audit `image_delete` **only after confirmed gone**. |
| `POST /admin/api/users/[id]/warn` | `{reason,email?,reportId?}` → Warning. Audit `user_warn`. |
| `POST /admin/api/users/[id]/ban` | `{reason, hideContent?}` → set ban fields + **bump `sessionEpoch`**; if `hideContent` bulk-soft-delete their posts in same tx (H2-ops), record count. Audit `user_ban`. |
| `POST /admin/api/users/[id]/unban` | clear ban fields + **bump `sessionEpoch`** again. Audit `user_unban`. |
| `GET /admin/api/users` · `GET /admin/api/users/[id]` · `GET /admin/api/users/[id]/posts` | read/search. |
| `GET /admin/api/media/post/[id]` | read; takes **only** `[id]`, DB-fetched validated key, `getObjectBuffer`, `Cache-Control: private, max-age=0` (L4/H2-web). Never accepts `url`/`key` param. |

### Stats / maintenance / backups (all `withAdmin`) — §4

`GET /admin/api/stats` · `POST /admin/api/maintenance/run` → `{jobId}` · `GET /admin/api/maintenance/status?jobId=` · `POST /admin/api/backup` (streams encrypted dump) · `GET /admin/api/backups/download?id=` (opaque DB-row id only) · `GET /admin/api/audit` · `GET /admin/api/audit/export.csv` (CSV-injection guarded).

---

## 4. Stats, maintenance, backups — snippets & infra

### Server/DB stats (read-only, safe)
- `src/lib/admin/server-stats.ts`: cgroup-v2-first memory (`/sys/fs/cgroup/memory.current` / `.max`), v1 fallback, `os` fallback; `fs.statfs("/")`; `process.memoryUsage()`. Read-only, no client input.
- `src/lib/admin/db-stats.ts`: parameterless `$queryRaw` **tagged templates** only (genuinely SQLi-safe — never convert to `$queryRawUnsafe`): `pg_database_size`, `pg_stat_user_tables`, `pg_stat_activity`, cache-hit, index-usage, bloat hints.
- `src/lib/admin/counts.ts`: typed Prisma `count()`. **Remove `as any`; never spread request JSON into a `where`** (H2-injection); whitelist filter keys; use a typed feature flag, not `prisma.user.fields` probing.

### One-click maintenance — `src/lib/admin/maintenance.ts`
- **Hardcoded** `ALLOWED_TABLES` constant — **never** `pg_tables`-derived (C3-injection). Includes the new admin tables (`admin_users`, `admin_sessions`, `admin_login_attempts`, `reports`, `warnings`, `admin_audit`) so high-churn tables can be maintained (L1-ops).
- **`table` is REQUIRED for every op** — no DB-wide form (C3-injection: removes the client-bypassable full-DB VACUUM DoS).
- **No `runMaintenancePg(sql: string)` arbitrary-SQL helper** (H1-injection). The dedicated `pg` client takes `(op, whitelistedTable)` and builds SQL internally.
- `op` validated against `VACUUM_ANALYZE|ANALYZE|REINDEX` at the route boundary.
- VACUUM/REINDEX run via lone `$executeRawUnsafe` (autocommit) or dedicated `pg` client; `REINDEX TABLE CONCURRENTLY`.
- **Single-flight lock (C4-ops):** `MaintenanceJob` row with partial unique index `WHERE status='running'`; reject concurrent ops with 409; refuse if backup lock present. Set `lock_timeout='5s'` and a finite `statement_timeout` (e.g. 30 min) even on VACUUM so a wedged op self-aborts. Fire-and-poll job model; never offer "REINDEX all tables".

```ts
const ALLOWED_TABLES = new Set([/* hardcoded list incl. admin tables */]);
function quoteIdent(name: string): string {
  if (!/^[a-z_]+$/.test(name) || !ALLOWED_TABLES.has(name)) throw new Error(`bad table ${name}`);
  return `"public"."${name}"`;
}
export async function runMaintenancePg(op: Op, table: string) {
  const target = quoteIdent(table);                  // table REQUIRED
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query(`SET lock_timeout = '5s'`);
    if (op !== "VACUUM_ANALYZE") await c.query(`SET statement_timeout = '1800000'`);
    const sql = op === "VACUUM_ANALYZE" ? `VACUUM (ANALYZE) ${target}`
             : op === "ANALYZE" ? `ANALYZE ${target}` : `REINDEX TABLE CONCURRENTLY ${target}`;
    await c.query(sql);
  } finally { await c.end(); }
}
```

### Backups — `src/app/admin/api/backup/route.ts` (`runtime="nodejs"`)
- **Pass `DATABASE_URL` whole** to `pg_dump` via env (`PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD` derived by libpq) — **do not decompose the URL** or `decodeURIComponent` it (C1/M2-injection: avoids param divergence + URIError stack leak).
- `spawn("pg_dump", argsArray, {env})` — arg array, **no shell**, `PGPASSWORD` via env not argv.
- **Encrypt before streaming (C1-ops):** pipe `pg_dump` stdout → `age`/`gpg` (recipient `BACKUP_ENC_PUBKEY`) or `crypto.createCipheriv` with `BACKUP_ENC_KEY` → `ReadableStream`. The B2/rclone off-box target only ever receives ciphertext.
- **Never surface `pg_dump` stderr to the client** — log server-side, return generic error (M2-injection).
- Audit pair `backup_download` started/completed (non-transactional — M2-web).

```ts
const env = { ...process.env, PGPASSWORD: undefined as never }; // libpq reads PG* from DATABASE_URL via -d
const child = spawn("pg_dump", ["-d", process.env.DATABASE_URL!, "-Fc", "--no-owner", "--no-privileges"], { env: process.env });
// child.stdout -> gpg/age encrypt transform -> ReadableStream
```

### Backup download by id — `src/app/admin/api/backups/download/route.ts`
- `id` is an **opaque DB-row id** (the `MaintenanceJob`/`BackupRun` status row); resolve filename **from that row**, never from the request (H3-injection path traversal). Then `path.resolve(BACKUP_DIR, basename(name))` and assert `resolved.startsWith(BACKUP_DIR + sep)`. Reject `id` containing `/ \ .. NUL`.

### CSV export — `src/app/admin/api/audit/export.csv/route.ts`
- Prefix any cell starting with `= + - @ \t \r` with `'` (CSV-injection guard, M1-injection). Render all free-text as escaped text in UI; no `dangerouslySetInnerHTML` anywhere in `/admin`.

### Image hard-delete — `src/app/admin/api/posts/[id]/image/route.ts` (C2-ops)
1. `objectKeyFromUrl` **must throw** if it can't positively extract a key (no fall-through to raw URL) and must reject keys with `..`, leading `/`, or not matching `^(posts|photos|native-drawings|scratches)/[A-Za-z0-9._-]+$` (C2-injection SSRF/traversal). Best: store object **keys** in dedicated columns and pass keys directly; never round-trip through URLs.
2. Enumerate **all** derived objects: `Scratch.compositeImageUrl` and reply/marginalia composites for the post — not just `finalImageUrl`/`uploadedPhotoUrl`.
3. After `removeObject`, `statObject` to **confirm** `NoSuchKey`; only then write `image_delete` audit. Surface failure; never claim success on a silent no-op.

### `storage.ts` hardening
- `objectKeyFromUrl` host-check + strict regex + throw-on-failure (above).
- Fail-fast on `MINIO_SECRET_KEY` in production (no `minioadmin` default, M3-injection).

### Dockerfile change
Add PostgreSQL 16 client (PGDG repo, version-matched) + `age` for backup encryption:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates gnupg wget age \
 && install -d /usr/share/postgresql-common/pgdg \
 && wget -qO /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-client-16 \
 && rm -rf /var/lib/apt/lists/*
```

### Compose changes (`docker-compose.tunnel.yml`)
- **Remove** `127.0.0.1:3000:3000` in prod (C1-web/H3-ops).
- Add new env to `app.environment`: `ADMIN_JWT_SECRET`, `ADMIN_TOTP_ENC_KEY`, `BACKUP_ENC_PUBKEY` (or `BACKUP_ENC_KEY`), `TUNNEL_SHARED_SECRET`, ensure `BASE_URL` set (no localhost fallback in prod), `NODE_ENV=production`.
- App boot `command:` runs `prisma db push` **then** the `CREATE UNIQUE INDEX IF NOT EXISTS reports_open_unique ...` (M1-ops).
- **Nightly backup sidecar** (`postgres:16-alpine`): **quote all env expansions** (no inline `sh -c` interpolation, H4-injection); use B2 app key scoped to one bucket with **no delete** (M4-ops); `chmod 600` dump files; pipe through `age` before off-box mirror. Retention: keep 14, prune `admin_login_attempts`/`admin_audit` by age. cloudflared injects `x-tunnel-secret` header.
- Restore runbook (`docs/deployment/`): restore into a container started with `SKIP_DB_PUSH=1`, verify, re-enable (M5-ops); document decrypt step; also back up MinIO (`mc mirror`/volume tar) off-box (the DB dump excludes images).

---

## 5. Admin UI pages & components

Mounted at `src/app/admin`, dark dense console, system font, scoped `.admin-root` theme, exempt from `no-text-input`. Server-gated layout via `getAdminSession()` (= `requireAdmin` page variant); CSP/XFO headers applied.

```
src/app/admin/
  layout.tsx                 ← getAdminSession gate + chrome (issues CSRF cookie)
  (public)/login/page.tsx    ← ungated: stage-1 password, stage-2 TOTP/recovery, generic errors, lockout/expired banners
  page.tsx                   ← dashboard (stat grid, system panel, DB panel, recent audit/reports; panels load/error independently)
  reports/page.tsx           ← queue: filters, ReportCard w/ inline image preview, d/w/b/e keyboard actions → ConfirmDialog
  users/page.tsx · users/[id]/page.tsx  ← search, status badges, ban/warn/unban, type-username-to-confirm danger zone
  posts/page.tsx             ← filters (needs-review/private/reported/deleted), thumbnails, soft-delete/restore/purge
  maintenance/page.tsx       ← VACUUM/REINDEX/ANALYZE (confirm + locking caption + fire-poll), backups status, off-box guidance
  audit/page.tsx             ← filters, expandable JSON (rendered as escaped text), CSV export
  _lib/adminFetch.ts         ← prefixes /admin/api, mirrors CSRF cookie→x-admin-csrf, credentials same-origin, 401→/admin/login?expired=1, 429→toast, 503→busy toast
  _components/  AdminShell Sidebar Topbar StatCard DataTable Pagination
                ConfirmDialog Toast ReportCard PostThumb ImagePreviewModal
                UserBadge ActionMenu CopyButton EmptyState ErrorState Skeletons
  admin.css
```
Keyboard-first (`g d/r/u/p/m/a`, `/` focus, `j/k` rows, `Enter` open, `?` cheatsheet, `Esc` close). Every destructive action → focus-trapped `ConfirmDialog` (never one-keystroke-fired); toast reports affected count. Four universal states (loading skeleton / empty / error+retry / populated). All free-text rendered escaped; audit `detail` as text only.

---

## 6. CLI scripts (`tsx scripts/*.ts`, run inside app container)

`package.json` scripts: `admin:create`, `admin:reset-pw`, `admin:reset-2fa`, `admin:list`. Run via `docker compose -f docker-compose.tunnel.yml exec app npm run admin:create` (Prisma over compose network; no `psql` needed).

- **`admin:create`** — prompt username + password (hidden), enforce **≥16 chars** (or generate high-entropy, print once); `hashPassword`; insert with `totpEnabledAt=null`; generate one-time **`enrollToken`** (random, argon2-hashed into `enrollToken`, 15-min `enrollTokenExpires`), print plaintext token. Login enroll requires this token (C3-ops) — closes the password-only enrollment window. Only way to mint the first admin.
- **`admin:reset-pw`** — set new hash (strength-checked), `mustChangePassword=true`, reset counters, **revoke all sessions**. The `must_change_pw` typed session forces an immediate change before any route (M2-authz).
- **`admin:reset-2fa`** — null `totpSecret`/`pendingTotpSecret`/`totpEnabledAt`/`lastTotpStep`, **delete recovery codes**, revoke sessions, **issue a fresh one-time `enrollToken`** (printed) so re-enroll still requires console possession as the second factor (C3-ops). Audit `admin_recovery_used`.
- **`admin:list`** — username, `isActive`, `totpEnabledAt`, `lastLoginAt`, `lockedUntil`, unused-recovery-count. No secrets.

---

## 7. Build order

1. **Foundations & frozen invariants:** `env.ts` (fail-fast secrets, `!= JWT_SECRET`), `next.config.js` headers + `serverComponentsExternalPackages`, security-headers middleware, CI tests (cookie-path prefix, route coverage, no direct `verifySessionToken`).
2. **Schema:** all admin models + `User` ban fields, drop `Flag`, Prisma `Post.deletedAt` client extension; boot-time partial unique index.
3. **Crypto primitives:** `password.ts` (concurrency cap), `crypto.ts` (AES-GCM), `totp.ts` (window:0 + anti-replay), `recovery.ts` (lookup-prefix single verify).
4. **Session + guard:** `session.ts` (typed JWT, HS256, aud/iss), `ip.ts` (tunnel-secret trust), `throttle.ts` (IP-independent per-account lockout), `guard.ts` + `withAdmin`, `requireEnroll/TotpPending/MustChangePw`.
5. **Compose/Docker:** remove `127.0.0.1:3000`, add env + tunnel secret, PG16 client + `age`, boot index.
6. **Auth routes:** login → totp → enroll → change-password → logout (DoS-gate ordering).
7. **Ban enforcement** in `getSession`/`getSessionState`; issuing routes pass `epoch`.
8. **User-facing reports** (strict targetType binding, uniform 404, DB-backed limits) + warning ack.
9. **Admin moderation routes** (route-param-derived targets, confirmed image purge + composites).
10. **Stats / maintenance (single-flight + required table) / backups (encrypted, whole-URL, opaque download id) / audit CSV guard.**
11. **Admin UI** (gate, login, dashboard, queues, maintenance).
12. **CLI scripts** with enroll tokens.

---

## 8. Security checklist (verify post-implementation)

**Auth/session**
- [ ] `ADMIN_JWT_SECRET` & `ADMIN_TOTP_ENC_KEY` fail-fast on import regardless of `NODE_ENV`; `ADMIN_JWT_SECRET !== JWT_SECRET` asserted.
- [ ] Every `jwt.verify`/`jwtVerify` (admin + middleware + user) pins `algorithms:["HS256"]`; admin tokens carry `aud`/`iss`.
- [ ] Token `typ` is mutually exclusive; each route asserts exact `typ`; a `totp_pending` token cannot reach enroll/confirm; enroll/confirm rejects when `totpEnabledAt` already set.
- [ ] DB `AdminSession` lookup runs on **every** request; a revoked `sid` is rejected within one request (test). Idle 60 min, absolute 2h enforced server-side.
- [ ] Origin/Referer enforced on **GET too**; no slide/re-mint on Origin failure; fails closed if `BASE_URL` unset or both headers absent.
- [ ] `withAdmin` wraps every admin mutation+read; route-coverage CI test passes; no admin route reads `croquis_session`.
- [ ] `mustChangePassword` blocks all normal routes until cleared.

**Brute-force/DoS**
- [ ] Per-account lockout is IP-independent and primary; a spoofed IP cannot lock a real account.
- [ ] `cf-connecting-ip` trusted only with valid `x-tunnel-secret`; `127.0.0.1:3000` removed in prod.
- [ ] argon2 concurrency cap returns 503; dummy-hash skipped once throttled; login DoS-gate order verified.
- [ ] TOTP `window:0`; replayed timestep `<= lastTotpStep` rejected.
- [ ] Recovery verify hits exactly one candidate (lookup-prefix); recovery path entered only via explicit toggle + format match; one-time use transactional.
- [ ] `admin_login_attempts` not written when already locked; retention job prunes >30d.

**Web**
- [ ] `frame-ancestors 'none'` + `X-Frame-Options: DENY` on `/admin/**`; strict CSP (`script-src 'self'`, `object-src 'none'`, `base-uri 'none'`) applied.
- [ ] No `dangerouslySetInnerHTML` in `/admin`; `note`/`banReason`/`resolutionNote` capped+control-char-stripped on write, escaped on render.
- [ ] `/api/reports` binds validation to `targetType`, returns uniform 404 (no existence oracle), uses `canViewPost`; admin actions derive target from route param + own lookup, never from `Report`.
- [ ] Report limits DB-backed (per-min + per-day + per-target + dismiss cooldown).
- [ ] Admin media proxy `Cache-Control: private, max-age=0`, takes only `[id]`.

**Injection/ops-data**
- [ ] Maintenance: `table` required, hardcoded whitelist, `/^[a-z_]+$/` + Set membership on raw input, `op` allowlisted, no arbitrary-SQL helper, single-flight lock, `lock_timeout`/`statement_timeout` set.
- [ ] `pg_dump` gets whole `DATABASE_URL` via env (no decomposition/`decodeURIComponent`), no shell, `PGPASSWORD` not in argv; stderr never returned to client.
- [ ] Backup output **encrypted** (age/gpg) before any off-box mirror; download-by-id resolves filename from DB row + `startsWith(BACKUP_DIR)` check; rejects `.. / \ NUL`.
- [ ] CSV export prefixes formula-trigger cells with `'`.
- [ ] `objectKeyFromUrl` throws on failure + strict key regex; image purge enumerates composites and confirms `NoSuchKey` before auditing.
- [ ] Audit `detail` redaction allowlist (no email/hash/secret/token/body); `ip` only from trusted source; non-transactional ops use started/completed/failed pairs.
- [ ] `Post` reads filter `deletedAt: null` via client extension; ban can bulk-hide content; `getSession` is the only ban-enforcement path (no direct `verifySessionToken`).
- [ ] Boot creates `reports_open_unique` partial index (db push won't); restore docs use `SKIP_DB_PUSH=1`; MinIO backed up off-box separately.

**Relevant files:** `/Users/craigcampbell/Projects/caligraphia/src/lib/auth.ts`, `/Users/craigcampbell/Projects/caligraphia/src/lib/rate-limit.ts`, `/Users/craigcampbell/Projects/caligraphia/src/lib/storage.ts`, `/Users/craigcampbell/Projects/caligraphia/next.config.js`, `/Users/craigcampbell/Projects/caligraphia/prisma/schema.prisma`, `/Users/craigcampbell/Projects/caligraphia/Dockerfile`, `/Users/craigcampbell/Projects/caligraphia/docker-compose.tunnel.yml`.
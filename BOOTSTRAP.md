# Production Bootstrap

How to get a fresh deployment of LeanOS (Vercel + Neon) into a logged-in, working state.

## Why this document exists

LeanOS stores SMTP (and Stripe) credentials in the database rather than in environment variables. The admin panel is the only way to write those credentials. This creates a bootstrap chicken-and-egg on a fresh deployment:

- Login rejects users whose `status` is `inactive` (see `src/lib/auth.ts`)
- A user becomes `active` only by clicking a verification link
- Verification emails require working SMTP
- SMTP is configured only from the admin panel
- Reaching the admin panel requires a logged-in admin

The fix is a one-time manual `INSERT` into the `users` table that creates an already-active admin, after which everything else can be configured through the UI.

---

## Runbook

### 1. Generate a bcrypt hash for the admin password

Run locally in the repo (uses the existing `bcryptjs` dependency):

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'PickAStrongPasswordHere'
```

Copy the `$2a$12$…` output. Do **not** paste the plaintext password into SQL.

### 2. Insert the admin row in Neon

Run in the Neon SQL editor, swapping in the admin email and the hash from step 1:

```sql
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  status,
  role,
  email_verified_at,
  referral_code
) VALUES (
  'admin@example.com',
  '$2a$12$PASTE_HASH_HERE',
  'Admin',
  'User',
  'active',      -- bypasses email verification
  'admin',       -- grants admin panel access
  NOW(),
  UPPER(SUBSTRING(MD5(RANDOM()::text), 1, 8))
)
RETURNING id, email, role, status;
```

If the row comes back with `role = admin` and `status = active`, the admin can now log in. No SMTP configuration is required for login itself — only signup and password reset flows use email.

### 3. Confirm required environment variables on Vercel

Four variables are required. The first three are needed for login; `ENCRYPTION_KEY` is only needed once SMTP configuration is saved.

| Variable | Purpose | Failure mode if missing |
|---|---|---|
| `DATABASE_URL` | Neon connection string | Nothing works |
| `NEXTAUTH_SECRET` | JWT signing | Login fails |
| `NEXTAUTH_URL` | Must match deployed URL exactly, no trailing slash | Verification/reset links point to wrong host |
| `ENCRYPTION_KEY` | 64-char hex string (32 bytes) for AES-256-GCM on SMTP/Stripe credentials | Saving email config throws |

Generate `ENCRYPTION_KEY` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

After adding or changing environment variables, redeploy the project — Vercel does not hot-reload them.

### 4. Log in and configure SMTP

1. Navigate to the deployed URL → `/login`
2. Use the admin credentials from step 1
3. Go to `/admin/email-config`
4. Fill in SMTP host, port, user, password, and from-address (see SMTP provider notes below)
5. Toggle **Enable Email Sending** on, then Save
6. Go to `/admin/test-emails`, send a test email to a real inbox, confirm it arrives

### 5. Seed the default email templates

From the browser console on any admin page:

```js
fetch("/api/admin/seed-templates", { method: "POST" }).then(r => r.json()).then(console.log)
```

This populates `email_templates` with the default welcome, verification, password-reset, purchase-confirmation, password-changed, account-suspended, and referral-reward templates.

### 6. Smoke test end-to-end

1. Open an incognito window → `/signup`
2. Create a fresh user with a different email
3. Confirm the verification email arrives
4. Click the verification link
5. Log in as the new user

If all six steps pass, the deployment is functional.

---

## SMTP provider notes

Any provider that exposes standard SMTP will work — the app only needs host, port, username, password, and from-address. No code changes are needed to switch providers.

| Provider | Free tier | Notes |
|---|---|---|
| Resend | 3,000 emails/month, 100/day | Straightforward setup, guided DKIM on your own domain |
| Postmark | 100 emails/month, then paid | Strongest deliverability reputation; separates transactional and broadcast streams |
| Amazon SES | 62,000/month from EC2 | Cheapest at scale, fiddly initial setup |
| Gmail (app password) | ~500 recipients/day | Works for demos; not recommended for production — see caveats below |

Using a personal Gmail account for production transactional email has known problems:

- Google's ToS restrict bulk/commercial use of free Gmail
- Free Gmail caps outbound at ~500 recipients/day
- No SPF/DKIM/DMARC for your product's own domain means emails often land in spam
- Credentials stored in the database are your personal Google account credentials
- Replies from users land in your personal inbox

For anything beyond an early course demo, using a dedicated transactional provider on a domain you control is strongly preferred.

---

## Known issues to address before inviting real users

These are not blockers for getting the app logged-in and functional, but should be fixed before the product goes to real end users.

1. **`/api/admin/seed-templates` has no auth guard.** Any unauthenticated POST can overwrite email templates. Fix by adding the same `auth()` + admin role check used in `/api/admin/email-config/route.ts`.
2. **Password-reset tokens are stored in plaintext.** `password_reset_tokens.token` holds the same value emailed to the user, so a database read gives reset capability for every outstanding token. The token should be hashed at rest (e.g., SHA-256) and compared by hash during reset.
3. **No rate limiting on auth endpoints.** `/api/auth/signup`, `/api/auth/resend-verification`, `/api/auth/forgot-password`, and `/api/auth/check-verification` are all unbounded. Add per-IP rate limiting (Upstash Ratelimit, Vercel Edge Middleware, or similar).
4. **Password hashing uses bcrypt.** Still acceptable per current OWASP guidance at cost factor ≥10 (this app uses 12), but Argon2id is the first-choice recommendation for new code. Migration is straightforward because the hash prefix is self-describing — verify with bcrypt for existing hashes, rehash to Argon2id opportunistically on successful login.

---

## Reference

- Schema: `src/lib/db/schema.ts`
- Auth configuration: `src/lib/auth.ts` and `src/auth.config.ts`
- Email sending: `src/lib/email.ts`
- Encryption helpers: `src/lib/encryption.ts`
- Initial migration: `drizzle/0000_yielding_wolfsbane.sql`

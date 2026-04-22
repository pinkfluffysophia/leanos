# Local Development Setup

How to get LeanOS running on a local machine, with an optional local mail server for safely testing email flows.

See `BOOTSTRAP.md` for the production (Vercel + Neon) bootstrap runbook. The admin-user bootstrap problem is the same locally — the same manual `INSERT` is required before login works.

## Prerequisites

- Node.js (this project uses Next.js 16 / React 19 — Node 20+ recommended)
- Docker Desktop (for the local Postgres container)
- npm (the repo is committed with `package-lock.json`)

## Setup

### 1. Start the database

A Postgres 16 container is already defined in `docker-compose.yml`.

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` with the following credentials (all hardcoded in the compose file, not secrets):

| | |
|---|---|
| Database | `leanos` |
| Username | `leanos_user` |
| Password | `leanos_password` |

To stop it later: `docker compose down`. To wipe the data volume and start fresh: `docker compose down -v`.

### 2. Create `.env.local`

Create the file at the repo root (it is gitignored by the repo's `.gitignore`):

```
DATABASE_URL=postgresql://leanos_user:leanos_password@localhost:5432/leanos
NEXTAUTH_SECRET=<paste-generated-value>
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=<paste-generated-hex>
```

Generate the two secret values:

```bash
# NEXTAUTH_SECRET — any strong random string:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# ENCRYPTION_KEY — must be exactly 64 hex chars (32 bytes):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Install dependencies and apply the schema

```bash
npm install
npm run db:push
```

`db:push` writes the current Drizzle schema directly to the database without generating a migration file. For production deploys, use `db:generate` to produce a migration under `drizzle/`, then `db:migrate` to apply it. The repo already ships with `drizzle/0000_yielding_wolfsbane.sql` as the initial migration.

### 4. Create a local admin user

The `authorize` function in `src/lib/auth.ts` rejects users with `status = 'inactive'`, so a fresh database has no way to log in. The same manual `INSERT` required for production (see `BOOTSTRAP.md`) is required locally.

Hash a password:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'localpass'
```

Pipe the INSERT into the Postgres container:

```bash
docker exec -i leanos-db psql -U leanos_user -d leanos <<'SQL'
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
  'dev@local.test',
  '$2a$12$PASTE_HASH_HERE',
  'Dev',
  'Admin',
  'active',
  'admin',
  NOW(),
  'LOCAL001'
)
RETURNING id, email, role, status;
SQL
```

Alternative GUI approach: `npm run db:studio` opens Drizzle Studio in the browser and lets you insert the row through a form.

### 5. Run the dev server

```bash
npm run dev
```

Log in at `http://localhost:3000/login` with `dev@local.test` and the password from step 4. The `/admin/dashboard` page should be accessible.

### 6. Seed the default email templates (optional)

From the browser console on any admin page:

```js
fetch("/api/admin/seed-templates", { method: "POST" }).then(r => r.json()).then(console.log)
```

This populates `email_templates` with the default welcome, verification, password-reset, purchase-confirmation, password-changed, account-suspended, and referral-reward templates.

---

## Capturing emails locally with Mailpit (optional)

The app does not need SMTP configured to log in or use the admin panel. It is only needed to exercise the signup / email verification / password reset / purchase confirmation flows.

To test those flows without sending real email, add **Mailpit** as an additional service in `docker-compose.yml`:

```yaml
  mailpit:
    image: axllent/mailpit
    container_name: leanos-mail
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # web UI
    networks:
      - leanos-network
```

Restart the Docker stack:

```bash
docker compose up -d
```

Then, logged in as the admin, navigate to `/admin/email-config` and save these settings:

| Field | Value |
|---|---|
| SMTP Host | `localhost` |
| SMTP Port | `1025` |
| SMTP Username | anything (Mailpit ignores authentication) |
| SMTP Password | anything |
| From | `dev@local.test` |
| Enable Email Sending | on |

All outgoing mail is captured in Mailpit and viewable at `http://localhost:8025`. Nothing is delivered to real inboxes. This is useful for inspecting the rendered HTML of email templates and for testing the signup → verification flow end-to-end.

---

## Useful Drizzle commands

| Command | Purpose |
|---|---|
| `npm run db:push` | Sync schema directly to DB (dev shortcut) |
| `npm run db:generate` | Generate a migration file from schema changes |
| `npm run db:migrate` | Apply pending migration files (prod path) |
| `npm run db:studio` | Open Drizzle Studio web UI for browsing/editing rows |

---

## Troubleshooting

**`ENCRYPTION_KEY must be a 64-character hex string`** — `.env.local` has the wrong key length. Re-generate with the `node -e` command in step 2.

**Login redirects back to `/login` with no error** — check that `NEXTAUTH_URL=http://localhost:3000` (no trailing slash, matches the dev server).

**`Email sending is not configured or is disabled`** thrown during signup — expected until email config is saved in the admin panel (step 6 or Mailpit section above).

**Docker container won't start on `5432`** — another Postgres is already running on the host. Either stop it (`sudo service postgresql stop` on Linux, or stop Postgres.app / the Windows service) or change the host-side port mapping in `docker-compose.yml` to `5433:5432` and update `DATABASE_URL` to match.

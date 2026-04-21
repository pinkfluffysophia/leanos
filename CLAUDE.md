# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Generate Drizzle migrations from schema
npm run db:migrate   # Run migrations
npm run db:push      # Push schema directly (dev shortcut)
npm run db:studio    # Open Drizzle Studio
```

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **NextAuth v5 beta 30** — JWT strategy, Credentials provider
- **Drizzle ORM** + PostgreSQL (via `postgres` driver)
- **Tailwind CSS v4** + shadcn/ui + lucide-react icons
- **Sonner** for toast notifications

## Architecture

### Route Groups
- `(auth)/` — Login, signup, verify-email (public routes)
- `(dashboard)/` — User pages with sidebar layout (`layout.tsx` wraps all)
- `(admin)/` — Admin panel (role-gated in middleware)
- `api/` — API routes for auth, users, etc.

### Auth Flow
- `src/lib/auth.ts` — Central NextAuth config with `authorized` callback for route protection
- JWT token stores: `id`, `role`, `firstName`, `lastName`, `profilePictureUrl`
- Session updates via `useSession().update({ key: value })` — JWT callback handles `trigger === "update"` with `session` param
- **Do NOT run DB queries in JWT callback** — it executes in middleware/edge runtime and will hang

### Database
- Schema: `src/lib/db/schema.ts` (10 tables with relations)
- Connection: `src/lib/db/index.ts`
- Config: `drizzle.config.ts` (reads `.env.local`)
- Prices/amounts stored in **cents** (integer)

### Session Type Extensions
- `src/types/next-auth.d.ts` — Extends Session/JWT types with custom fields (role, firstName, lastName, profilePictureUrl)

### Patterns
- Server components for data fetching (e.g., dashboard, purchases pages)
- Client components with `"use client"` for interactive pages (e.g., profile)
- API routes use `auth()` guard, return `NextResponse.json()`
- Toast feedback via `sonner` (`toast.success()`, `toast.error()`)
- Validation: letters-only regex `/^[a-zA-Z]+$/` for names
- File uploads: saved to `public/uploads/avatars/`, old files deleted on replacement

### Environment
- Only `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` in `.env.local`
- SMTP/Stripe credentials stored encrypted in DB, configured via admin panel

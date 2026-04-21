# LeanOS - Product Requirements Document (PRD)

## Overview

**Product Name:** LeanOS
**Description:** A SaaS platform for selling digital products/courses with comprehensive user management, email system, and Stripe payment integration.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router) |
| Backend | Next.js API Routes |
| Database | PostgreSQL |
| ORM | Drizzle |
| UI | Tailwind CSS + shadcn/ui |
| Authentication | NextAuth.js |
| Payments | Stripe |
| Email | SMTP |
| Deployment | Hetzner VPS |

---

## Core Features

### 1. Authentication System

**No Homepage** - Users land directly on login/signup pages.

#### Signup Flow
- Required fields: Email, Password, First Name, Last Name
- Email verification via SMTP
- User status: `inactive` (unverified) → `active` (verified)
- Only verified users can login

#### Login Flow
- Email + Password authentication
- Redirect to Dashboard on success
- Block unverified users with appropriate message

---

### 2. User Dashboard

#### Sidebar Navigation
- Dashboard
- Purchases
- Profile
- Settings

#### Top Navigation Bar
- Profile picture (circular) in top-right corner
- Dropdown menu on click:
  - Full Name
  - Email
  - Purchases (link)
  - Profile (link)
  - Settings (link)
  - Log out

#### Dashboard Page
**Stats Row (3 boxes):**
- Total Purchases
- Total Spent
- Study Progress

**Action Row (2 boxes):**
- Recent Activity
- Quick Actions:
  - Update Profile → redirects to Profile
  - Account Settings → redirects to Settings

**Admin Notice (if admin):**
- "You are an admin" box with redirect button to Admin Panel

---

### 3. Purchases Page

- Vertical log-style layout (1 purchase per row)
- Detailed information per purchase
- Layout: log under log (not grid)

---

### 4. Profile Page

#### Editable Fields
- First Name
- Last Name
- Nickname (optional)

#### Profile Picture
- Upload custom image
- Default: Initials on gray background (e.g., "MT" for Michael Text)

#### Email Display
- Shows email (read-only)
- Message: "Email address cannot be changed. Contact support if you need to update it."

#### Account Details Section
- User ID
- Email
- Member Since (date)

#### Referral Section
- Input field to enter referral code
- Display user's own referral link

---

### 5. Settings Page

#### Security Section
- **Change Password:**
  - Current Password
  - New Password
  - Confirm New Password
  - Update Password button
- **Two-Factor Authentication:**
  - Enable/Disable 2FA

#### Notifications Section
- Email Notifications (toggle)
- Push Notifications (toggle)

#### Preferences Section
- Timezone selection:
  - UTC
  - Eastern Time
  - Central Time
  - Mountain Time
  - Pacific Time

#### Danger Zone Section
- Delete Account button (with confirmation)

---

## Admin Panel

### Admin Sidebar Navigation
1. Back to User Dashboard
2. Admin Dashboard
3. Analytics
4. Products
5. Messenger
6. Waitlists
7. Email Templates
8. Test Emails
9. Email Config
10. Email History
11. Email Logs
12. Tags
13. Community
14. Transactions
15. Stripe Integration
16. System Settings

### Admin Dashboard
- Total Users count
- Products count
- Payment System status (Connected/Unconnected)
- Recent Signups (with timeframe)

### Email System

#### Email Templates
- Purchase Confirmation
- New User Welcome
- Course Access
- Small preview available for each

#### Test Emails
- Email input field
- Template selector dropdown
- Send test button

#### Email Config
- SMTP Settings configuration

#### Email History
- Email campaign history log

#### Email Logs
- Individual email send logs

### Tags Management
- View all tags
- Create new tags
- Delete tags
- Color assignment for tags
- Used for filtering and organizing

### Transactions
- View all transactions
- Transaction management

### Stripe Integration
- Connect Stripe account
- Required for payment functionality

### Placeholder Pages (to be built later)
- Analytics
- Products
- Messenger
- Waitlists
- Community
- System Settings

---

## Database Schema

### Users Table
```
- id (UUID, primary key)
- email (unique)
- password_hash
- first_name
- last_name
- nickname (nullable)
- profile_picture_url (nullable)
- status (enum: inactive, active)
- role (enum: user, admin)
- email_verified_at (timestamp, nullable)
- timezone (default: UTC)
- email_notifications (boolean, default: true)
- push_notifications (boolean, default: true)
- two_factor_enabled (boolean, default: false)
- two_factor_secret (nullable)
- referral_code (unique)
- referred_by (foreign key, nullable)
- created_at
- updated_at
```

### Purchases Table
```
- id (UUID, primary key)
- user_id (foreign key)
- product_id (foreign key)
- amount
- currency
- stripe_payment_id
- status
- created_at
```

### Products Table
```
- id (UUID, primary key)
- name
- description
- price
- currency
- stripe_product_id
- stripe_price_id
- status (active/inactive)
- created_at
- updated_at
```

### Email Templates Table
```
- id (UUID, primary key)
- name
- subject
- body_html
- body_text
- type (enum: welcome, purchase, course_access, etc.)
- created_at
- updated_at
```

### Email Logs Table
```
- id (UUID, primary key)
- user_id (foreign key, nullable)
- to_email
- template_id (foreign key, nullable)
- subject
- status (sent, failed, bounced)
- sent_at
- error_message (nullable)
```

### Tags Table
```
- id (UUID, primary key)
- name
- color (hex)
- created_at
```

### Transactions Table
```
- id (UUID, primary key)
- user_id (foreign key)
- purchase_id (foreign key, nullable)
- type (purchase, refund, etc.)
- amount
- currency
- stripe_transaction_id
- status
- created_at
```

### Email Config Table
```
- id (UUID, primary key)
- smtp_host (encrypted)
- smtp_port
- smtp_user (encrypted)
- smtp_password (encrypted)
- smtp_from
- is_active (boolean)
- updated_at
```

### Stripe Config Table
```
- id (UUID, primary key)
- secret_key (encrypted)
- publishable_key
- webhook_secret (encrypted)
- is_connected (boolean)
- updated_at
```

---

## Project Structure

```
/leanos
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── verify-email/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── purchases/
│   │   │   ├── profile/
│   │   │   └── settings/
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── dashboard/
│   │   │       ├── analytics/
│   │   │       ├── products/
│   │   │       ├── messenger/
│   │   │       ├── waitlists/
│   │   │       ├── email-templates/
│   │   │       ├── test-emails/
│   │   │       ├── email-config/
│   │   │       ├── email-history/
│   │   │       ├── email-logs/
│   │   │       ├── tags/
│   │   │       ├── community/
│   │   │       ├── transactions/
│   │   │       ├── stripe/
│   │   │       └── system-settings/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── purchases/
│   │   │   ├── products/
│   │   │   ├── email/
│   │   │   ├── tags/
│   │   │   ├── transactions/
│   │   │   └── stripe/
│   │   ├── layout.tsx
│   │   └── page.tsx (redirect to /login)
│   ├── components/
│   │   ├── ui/ (shadcn components)
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── admin/
│   │   └── shared/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts (Drizzle schema)
│   │   │   └── index.ts (DB connection)
│   │   ├── auth.ts (NextAuth config)
│   │   ├── email.ts (SMTP utils)
│   │   ├── stripe.ts (Stripe utils)
│   │   └── utils.ts
│   └── types/
├── drizzle/
│   └── migrations/
├── public/
├── .env.local
├── drizzle.config.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Implementation Phases

### Phase 1: Foundation
1. Initialize Next.js project with TypeScript
2. Set up Tailwind CSS + shadcn/ui
3. Configure PostgreSQL + Drizzle
4. Create database schema and migrations
5. Set up NextAuth.js with credentials provider

### Phase 2: Authentication
1. Build signup page with form validation
2. Build login page
3. Implement email verification flow (SMTP)
4. Create verify-email page
5. Add protected route middleware

### Phase 3: User Dashboard
1. Create dashboard layout with sidebar
2. Build top navigation with profile dropdown
3. Implement Dashboard page with stats boxes
4. Build Purchases page (log layout)
5. Build Profile page with all sections
6. Build Settings page with all sections

### Phase 4: Admin Panel
1. Create admin layout with sidebar
2. Build Admin Dashboard
3. Implement Email Templates CRUD
4. Build Test Emails functionality
5. Build Email Config (SMTP settings)
6. Build Email History + Logs pages
7. Implement Tags management
8. Build Transactions page
9. Implement Stripe integration page

### Phase 5: Polish & Deployment
1. Add loading states and error handling
2. Responsive design optimization
3. Set up Hetzner VPS
4. Configure production database
5. Deploy application

---

## Verification Plan

1. **Auth Flow:** Test signup → email verification → login → dashboard redirect
2. **User Features:** Test profile edit, password change, settings toggles
3. **Admin Features:** Test email templates, test emails, tag CRUD
4. **Stripe:** Test connection and payment flow
5. **Responsive:** Test on mobile, tablet, desktop

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# NextAuth (required for session encryption)
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

**Note:** SMTP and Stripe credentials are stored encrypted in the database and configured via the admin panel (Email Config and Stripe Integration pages). This allows admins to update settings without server access.

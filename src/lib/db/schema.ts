import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userStatusEnum = pgEnum("user_status", ["inactive", "active"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const emailStatusEnum = pgEnum("email_status", ["sent", "failed", "bounced"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["purchase", "refund"]);
export const productStatusEnum = pgEnum("product_status", ["active", "inactive"]);
export const productTypeEnum = pgEnum("product_type", ["one_time", "subscription"]);

// Users Table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  nickname: varchar("nickname", { length: 100 }),
  profilePictureUrl: text("profile_picture_url"),
  status: userStatusEnum("status").default("inactive").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  sessionVersion: integer("session_version").default(1).notNull(),
  referralCode: varchar("referral_code", { length: 20 }).notNull().unique(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
  referredBy: uuid("referred_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Products Table
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  stripeProductId: varchar("stripe_product_id", { length: 255 }),
  shortDescription: varchar("short_description", { length: 500 }),
  fullDescription: text("full_description"),
  imageUrl: text("image_url"),
  isPublic: boolean("is_public").default(true).notNull(),
  status: productStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Prices Table (multi-price per product)
export const prices = pgTable("prices", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // in cents
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  type: productTypeEnum("type").default("one_time").notNull(),
  interval: varchar("interval", { length: 10 }), // day, week, month, year — null for one_time
  intervalCount: integer("interval_count"), // null for one_time
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Purchases Table
export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  priceId: uuid("price_id").references(() => prices.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(), // in cents
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  stripePaymentId: varchar("stripe_payment_id", { length: 255 }),
  status: varchar("status", { length: 50 }).default("completed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Email Templates Table
export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  type: varchar("type", { length: 50 }).notNull(), // welcome, purchase, course_access, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Email Logs Table
export const emailLogs = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  toEmail: varchar("to_email", { length: 255 }).notNull(),
  templateId: uuid("template_id").references(() => emailTemplates.id, { onDelete: "set null" }),
  templateName: varchar("template_name", { length: 255 }),
  templateBodyHtml: text("template_body_html"),
  subject: varchar("subject", { length: 500 }).notNull(),
  status: emailStatusEnum("status").default("sent").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  errorMessage: text("error_message"),
});

// Tags Table
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(), // hex color
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// User Tags Junction Table (many-to-many)
export const userTags = pgTable("user_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_tags_unique").on(table.userId, table.tagId),
]);

// Transactions Table
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purchaseId: uuid("purchase_id").references(() => purchases.id, { onDelete: "set null" }),
  type: transactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(), // in cents
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  stripeTransactionId: varchar("stripe_transaction_id", { length: 255 }),
  status: varchar("status", { length: 50 }).default("completed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Email Config Table (encrypted fields stored as text)
export const emailConfig = pgTable("email_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  smtpHost: text("smtp_host"), // encrypted
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"), // encrypted
  smtpPassword: text("smtp_password"), // encrypted
  smtpFrom: varchar("smtp_from", { length: 255 }),
  isActive: boolean("is_active").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Stripe Config Table (encrypted fields stored as text)
export const stripeConfig = pgTable("stripe_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  secretKey: text("secret_key"), // encrypted
  publishableKey: varchar("publishable_key", { length: 255 }),
  webhookSecret: text("webhook_secret"), // encrypted
  isConnected: boolean("is_connected").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Admin Notes Table
export const adminNotes = pgTable("admin_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  attachmentUrl: varchar("attachment_url", { length: 500 }),
  attachmentName: varchar("attachment_name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Email Verification Tokens Table
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// System Settings Table (key-value)
export const systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Waitlists Table
export const waitlists = pgTable("waitlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  shortcode: varchar("shortcode", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Waitlist Members Table
export const waitlistMembers = pgTable("waitlist_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  waitlistId: uuid("waitlist_id").notNull().references(() => waitlists.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  verificationToken: varchar("verification_token", { length: 255 }).unique(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("waitlist_members_unique").on(table.waitlistId, table.email),
]);

// Password Reset Tokens Table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  purchases: many(purchases),
  transactions: many(transactions),
  emailLogs: many(emailLogs),
  userTags: many(userTags),
  adminNotes: many(adminNotes),
  referrer: one(users, {
    fields: [users.referredBy],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  purchases: many(purchases),
  prices: many(prices),
}));

export const pricesRelations = relations(prices, ({ one }) => ({
  product: one(products, {
    fields: [prices.productId],
    references: [products.id],
  }),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  user: one(users, {
    fields: [purchases.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [purchases.productId],
    references: [products.id],
  }),
  price: one(prices, {
    fields: [purchases.priceId],
    references: [prices.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  purchase: one(purchases, {
    fields: [transactions.purchaseId],
    references: [purchases.id],
  }),
}));

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  user: one(users, {
    fields: [emailLogs.userId],
    references: [users.id],
  }),
  template: one(emailTemplates, {
    fields: [emailLogs.templateId],
    references: [emailTemplates.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  userTags: many(userTags),
}));

export const userTagsRelations = relations(userTags, ({ one }) => ({
  user: one(users, {
    fields: [userTags.userId],
    references: [users.id],
  }),
  tag: one(tags, {
    fields: [userTags.tagId],
    references: [tags.id],
  }),
}));

export const adminNotesRelations = relations(adminNotes, ({ one }) => ({
  user: one(users, {
    fields: [adminNotes.userId],
    references: [users.id],
    relationName: "noteTarget",
  }),
  author: one(users, {
    fields: [adminNotes.authorId],
    references: [users.id],
    relationName: "noteAuthor",
  }),
}));

export const waitlistsRelations = relations(waitlists, ({ many }) => ({
  members: many(waitlistMembers),
}));

export const waitlistMembersRelations = relations(waitlistMembers, ({ one }) => ({
  waitlist: one(waitlists, {
    fields: [waitlistMembers.waitlistId],
    references: [waitlists.id],
  }),
}));

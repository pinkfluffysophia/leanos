import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * ⚠️ SECURITY ARCHITECTURE WARNING ⚠️
 *
 * This module uses AES-256-GCM to encrypt sensitive values (SMTP passwords,
 * Stripe keys) before storing them in the database. However, the encryption
 * key (ENCRYPTION_KEY) lives in the same environment (Vercel env vars) as
 * the database connection string (DATABASE_URL).
 *
 * This means:
 *   - Anyone with access to the Vercel dashboard has BOTH the key and the data.
 *   - A single compromised env var / leaked .env.local file exposes everything.
 *   - There is NO separation of concerns — the chest and the key are next
 *     to each other.
 *
 * For a production SaaS handling real customer data and payment credentials,
 * the encryption key should be stored in a dedicated Key Management Service
 * (KMS) such as AWS KMS, Google Cloud KMS, or HashiCorp Vault — NOT in the
 * same environment as the application.
 *
 * Using personal Gmail App Passwords as the SMTP credential makes this even
 * worse: a breach of this app gives an attacker full access to the owner's
 * personal Google account.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set in environment variables");
  }
  // Key must be 32 bytes for AES-256
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    );
  }
  return buf;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a hex string in the format: iv:encrypted:authTag
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
}

/**
 * Decrypts a string encrypted with encrypt().
 * Expects hex string in the format: iv:encrypted:authTag
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format");
  }

  const [ivHex, encryptedHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

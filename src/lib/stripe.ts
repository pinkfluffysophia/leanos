import Stripe from "stripe";
import { db } from "@/lib/db";
import { stripeConfig } from "@/lib/db/schema";
import { decrypt } from "@/lib/encryption";

export async function getStripe(): Promise<Stripe> {
  const config = await db.query.stripeConfig.findFirst();

  if (!config || !config.isConnected || !config.secretKey) {
    throw new Error(
      "Stripe is not configured. Please add your API keys in Admin > Stripe Integration."
    );
  }

  const secretKey = decrypt(config.secretKey);

  return new Stripe(secretKey);
}

import { db } from "./db";
import { systemSettings } from "./db/schema";
import { eq } from "drizzle-orm";

export const SETTING_DEFAULTS: Record<string, string> = {
  registrationOpen: "true",
};

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(systemSettings);
  const settings = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function getSetting(key: string): Promise<string> {
  const row = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, key),
  });
  return row?.value ?? SETTING_DEFAULTS[key] ?? "";
}

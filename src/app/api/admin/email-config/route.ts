import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, emailConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((result) => result[0]);

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await db.query.emailConfig.findFirst();

    if (!config) {
      return NextResponse.json({
        smtpHost: "",
        smtpPort: 587,
        smtpUser: "",
        smtpPassword: "",
        smtpFrom: "",
        isActive: false,
      });
    }

    return NextResponse.json({
      smtpHost: config.smtpHost ? decrypt(config.smtpHost) : "",
      smtpPort: config.smtpPort || 587,
      smtpUser: config.smtpUser ? decrypt(config.smtpUser) : "",
      smtpPassword: config.smtpPassword ? "••••••••" : "",
      smtpFrom: config.smtpFrom || "",
      isActive: config.isActive,
    });
  } catch (error) {
    console.error("Email config GET error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((result) => result[0]);

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom, isActive } = body;

    const existing = await db.query.emailConfig.findFirst();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (smtpHost !== undefined) updateData.smtpHost = smtpHost ? encrypt(smtpHost) : "";
    if (smtpPort !== undefined) updateData.smtpPort = smtpPort;
    if (smtpUser !== undefined) updateData.smtpUser = smtpUser ? encrypt(smtpUser) : "";
    // Only update password if it's not the masked value
    if (smtpPassword !== undefined && smtpPassword !== "••••••••") {
      updateData.smtpPassword = smtpPassword ? encrypt(smtpPassword) : "";
    }
    if (smtpFrom !== undefined) updateData.smtpFrom = smtpFrom;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (existing) {
      await db
        .update(emailConfig)
        .set(updateData)
        .where(eq(emailConfig.id, existing.id));
    } else {
      await db.insert(emailConfig).values({
        smtpHost: "",
        smtpPort: 587,
        smtpUser: "",
        smtpPassword: "",
        smtpFrom: "",
        isActive: false,
        ...updateData,
      });
    }

    return NextResponse.json({ message: "Email config updated successfully" });
  } catch (error) {
    console.error("Email config PATCH error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

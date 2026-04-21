"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

export function SessionGuard({ requireAdmin }: { requireAdmin?: boolean }) {
  const { update } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/users/session-check")
      .then((res) => {
        if (res.status === 401 || res.status === 404) {
          signOut({ callbackUrl: "/login" });
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then(async (data) => {
        if (!data) return;

        if (data.status === "deleted") {
          signOut({ callbackUrl: "/login" });
        } else if (data.status === "suspended") {
          signOut({ callbackUrl: "/login" });
        } else if (data.status === "outdated" && data.user) {
          await update(data.user);
          // Check admin access after session update
          if (requireAdmin && data.user.role !== "admin") {
            router.replace("/dashboard");
          }
        } else if (requireAdmin) {
          // "valid" response — check role
          if (data.role && data.role !== "admin") {
            router.replace("/dashboard");
          }
        }
      })
      .catch(() => {});
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

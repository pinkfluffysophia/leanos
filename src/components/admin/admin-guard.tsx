"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AdminGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/users/session-check")
      .then((res) => res.json())
      .then((data) => {
        const role =
          data.status === "outdated" ? data.user?.role : data.role;
        if (role && role !== "admin") {
          router.replace("/dashboard");
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  return null;
}

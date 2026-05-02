"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-pink-200/70 dark:border-pink-300/20 bg-white/60 dark:bg-white/5 backdrop-blur-sm text-pink-500 dark:text-pink-200 hover:bg-white dark:hover:bg-white/10 transition-colors"
    >
      {mounted ? (
        isDark ? (
          <Sun className="w-4 h-4" strokeWidth={1.75} />
        ) : (
          <Moon className="w-4 h-4" strokeWidth={1.75} />
        )
      ) : (
        <span className="w-4 h-4" />
      )}
    </button>
  );
}

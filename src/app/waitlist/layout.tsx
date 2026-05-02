import { ThemeToggle } from "@/components/theme-toggle";

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 dark:from-pink-950/40 dark:via-rose-950/30 dark:to-fuchsia-950/40">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}

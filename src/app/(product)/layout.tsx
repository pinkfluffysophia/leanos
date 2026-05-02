import { ThemeToggle } from "@/components/theme-toggle";

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 dark:from-slate-950 dark:via-pink-950/30 dark:to-fuchsia-950/40">
      {/* Banner */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/60 dark:bg-slate-950/60 border-b border-pink-100 dark:border-pink-300/10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-light tracking-wide bg-gradient-to-r from-pink-400 to-rose-400 dark:from-pink-300 dark:to-rose-300 bg-clip-text text-transparent">
            Pinkfluffysophia
          </h1>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-xs uppercase tracking-[0.2em] text-pink-400/80 dark:text-pink-200/70">
              Premium Products
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
        {children}
      </main>
    </div>
  );
}

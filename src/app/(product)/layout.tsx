export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Banner */}
      <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 py-6 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-black text-white text-center drop-shadow-lg">
            Pinkfluffysophia
          </h1>
          <p className="text-center text-white/90 mt-2 text-sm sm:text-base">
            Premium Products & Branding
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {children}
      </main>
    </div>
  );
}

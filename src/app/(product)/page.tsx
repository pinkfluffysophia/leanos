"use client";

import { Heart, Sparkles, Shield } from "lucide-react";

export default function ProductPage() {
  return (
    <div className="space-y-32">
      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto">
        <span className="inline-block text-xs uppercase tracking-[0.25em] text-pink-400 dark:text-pink-300 mb-6">
          About Our Brand
        </span>
        <h2 className="text-4xl sm:text-6xl font-light text-slate-800 dark:text-slate-100 mb-6 leading-tight">
          Elegance, quality,
          <br />
          <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400 dark:from-pink-300 dark:via-rose-300 dark:to-fuchsia-300 bg-clip-text text-transparent font-normal">
            beautifully crafted.
          </span>
        </h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 font-light leading-relaxed">
          Pinkfluffysophia brings you premium products and experiences designed
          with care, intention, and a touch of softness.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
          <a
            href="/signup"
            className="px-8 py-3 text-sm font-medium text-white bg-gradient-to-r from-pink-300 to-rose-300 hover:from-pink-400 hover:to-rose-400 dark:from-pink-400 dark:to-rose-400 dark:hover:from-pink-500 dark:hover:to-rose-500 rounded-full transition-all shadow-sm hover:shadow-md"
          >
            Create Account
          </a>
          <a
            href="/login"
            className="px-8 py-3 text-sm font-medium text-pink-500 dark:text-pink-300 hover:text-pink-600 dark:hover:text-pink-200 rounded-full transition-colors"
          >
            Sign In →
          </a>
        </div>
      </section>

      {/* Features */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-pink-100/60 dark:bg-pink-300/10 rounded-3xl overflow-hidden">
          {[
            {
              icon: Heart,
              title: "Crafted with Love",
              desc: "Every product is carefully designed with attention to detail and quality.",
            },
            {
              icon: Sparkles,
              title: "Premium Quality",
              desc: "We source the finest materials to ensure superior durability in every piece.",
            },
            {
              icon: Shield,
              title: "Guaranteed Satisfaction",
              desc: "Your satisfaction is our priority with easy returns and dedicated support.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm p-10 hover:bg-white dark:hover:bg-slate-900/80 transition-colors"
            >
              <Icon
                className="w-6 h-6 text-pink-400 dark:text-pink-300 mb-6"
                strokeWidth={1.5}
              />
              <h4 className="text-base font-medium text-slate-800 dark:text-slate-100 mb-2">
                {title}
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-light leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center bg-gradient-to-br from-pink-100 via-rose-100 to-fuchsia-100 dark:from-pink-900/40 dark:via-rose-900/30 dark:to-fuchsia-900/40 rounded-3xl px-8 py-20">
        <h3 className="text-3xl sm:text-4xl font-light text-slate-800 dark:text-slate-100 mb-4">
          Ready to explore?
        </h3>
        <p className="text-base text-slate-500 dark:text-slate-300 font-light mb-10 max-w-md mx-auto">
          Discover our collection of thoughtfully curated premium products.
        </p>
        <a
          href="/products"
          className="inline-block px-10 py-3 text-sm font-medium text-white bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 dark:from-pink-300 dark:to-rose-300 dark:hover:from-pink-400 dark:hover:to-rose-400 rounded-full transition-all shadow-sm hover:shadow-md"
        >
          View Products
        </a>
      </section>
    </div>
  );
}

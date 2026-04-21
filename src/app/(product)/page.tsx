"use client";

import { Heart, Sparkles, Shield } from "lucide-react";

export default function ProductPage() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-8">
        <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
          About Our Brand
        </h2>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto">
          Pinkfluffysophia is dedicated to bringing you premium products and
          experiences that combine elegance, quality, and innovation.
        </p>
      </section>

      {/* Features Grid */}
      <section>
        <h3 className="text-3xl font-bold text-slate-900 mb-8 text-center">
          Why Choose Us
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
            <Heart className="w-12 h-12 text-pink-500 mb-4" />
            <h4 className="text-xl font-semibold text-slate-900 mb-2">
              Crafted with Love
            </h4>
            <p className="text-slate-600">
              Every product is carefully designed and crafted with attention to
              detail and quality.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
            <Sparkles className="w-12 h-12 text-purple-500 mb-4" />
            <h4 className="text-xl font-semibold text-slate-900 mb-2">
              Premium Quality
            </h4>
            <p className="text-slate-600">
              We source the finest materials to ensure superior quality and
              durability in every product.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
            <Shield className="w-12 h-12 text-pink-600 mb-4" />
            <h4 className="text-xl font-semibold text-slate-900 mb-2">
              Guaranteed Satisfaction
            </h4>
            <p className="text-slate-600">
              Your satisfaction is our priority with easy returns and dedicated
              customer support.
            </p>
          </div>
        </div>
      </section>

      {/* Auth Buttons */}
      <section className="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/login" className="inline-block">
          <button className="w-full sm:w-auto px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-lg transition-all">
            Sign In
          </button>
        </a>
        <a href="/auth/signup" className="inline-block">
          <button className="w-full sm:w-auto px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold border-2 border-pink-500 text-pink-500 hover:bg-pink-500/10 rounded-lg transition-all">
            Create Account
          </button>
        </a>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg p-12 text-center text-white">
        <h3 className="text-3xl font-bold mb-4">Ready to Explore?</h3>
        <p className="text-lg mb-8 text-white/90">
          Check out our amazing collection of premium products.
        </p>
        <a
          href="/products"
          className="inline-block px-8 py-3 bg-white text-pink-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
        >
          View Products
        </a>
      </section>
    </div>
  );
}

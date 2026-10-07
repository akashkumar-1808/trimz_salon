import React from 'react';
import Link from 'next/link';
import { 
  Scissors, 
  Sparkles, 
  Clock, 
  MapPin, 
  Phone, 
  Calendar, 
  ArrowRight, 
  ShieldCheck, 
  Star,
  CheckCircle2
} from 'lucide-react';

export default function StorefrontPage() {
  const serviceHighlights = [
    { name: 'Signature Hair Sculpture & Styling', duration: '45 mins', price: '₹650', cat: 'Hair Craft' },
    { name: 'Royal Beard Sculpt & Hot Towel Treatment', duration: '35 mins', price: '₹450', cat: 'Grooming' },
    { name: 'Brazilian Keratin Infusion', duration: '120 mins', price: '₹4,500', cat: 'Hair Therapy' },
    { name: 'Hydra Facial & Radiance Skin Glow', duration: '60 mins', price: '₹2,500', cat: 'Skin Spa' },
    { name: 'Moroccan Oil Deep Moisture Therapy', duration: '50 mins', price: '₹1,800', cat: 'Hair Spa' },
    { name: 'Executive Grooming Package', duration: '90 mins', price: '₹3,200', cat: 'Packages' },
  ];

  return (
    <div className="min-h-screen bg-dark-bg text-gray-100 flex flex-col selection:bg-brand-500 selection:text-dark-bg">
      {/* Navigation Header */}
      <header className="border-b border-dark-border/60 bg-dark-bg/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 flex items-center justify-center text-dark-bg font-black text-2xl shadow-lg shadow-brand-500/20">
              <Scissors className="w-6 h-6 rotate-45" />
            </div>
            <div>
              <span className="font-extrabold tracking-wider text-xl bg-gradient-to-r from-brand-200 via-brand-400 to-amber-200 bg-clip-text text-transparent">
                TRIMZ SALON
              </span>
              <p className="text-[10px] tracking-widest uppercase font-semibold text-brand-400/80">
                Luxury Grooming Lounge
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#services" className="hover:text-brand-300 transition-colors">Services</a>
            <a href="#experience" className="hover:text-brand-300 transition-colors">The Experience</a>
            <a href="#contact" className="hover:text-brand-300 transition-colors">Location & Hours</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-dark-surface border border-dark-border hover:border-brand-500/50 text-gray-200 hover:text-brand-300 text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-brand-400" />
              <span>Staff Terminal</span>
            </Link>
            <a
              href="tel:+919876543210"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-dark-bg font-bold text-xs transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Book Appointment</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 px-6 overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Exquisite Hair & Skin Artistry</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] text-white">
            Redefining Luxury Grooming at{' '}
            <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-amber-200 bg-clip-text text-transparent">
              Trimz Salon
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-gray-400 font-normal leading-relaxed">
            Where precision craftsmanship meets modern aesthetic wellness. Experience tailor-made haircuts, restorative hair rituals, and rejuvenating skin therapies.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#services"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-dark-bg font-extrabold text-sm tracking-wide transition-all shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2"
            >
              <span>Explore Services & Rates</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-dark-surface border border-dark-border hover:border-brand-500/40 text-gray-200 hover:text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Launch Operations Portal</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Highlights / Value Pillars */}
      <section id="experience" className="py-16 border-y border-dark-border bg-dark-surface/50">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-dark-surface border border-dark-border space-y-3">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Star className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white">Master Stylists</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Internationally certified hair artisans trained in bespoke consultation and contemporary geometric scissor work.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-dark-surface border border-dark-border space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white">Botanical Organic Formulations</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Exclusively utilizing premium dermatologically tested, cruelty-free professional hair and skin formulations.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-dark-surface border border-dark-border space-y-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white">Private VIP Suites</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Quiet comfort, bespoke acoustic ambiance, premium espresso, and hygienic single-use sterilized kits for every client.
            </p>
          </div>
        </div>
      </section>

      {/* Service Menu Highlights */}
      <section id="services" className="py-20 px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-400">The Salon Menu</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Curated Services & Treatments</h2>
            <p className="text-sm text-gray-400 max-w-xl mx-auto">
              Transparent, standardized pricing with zero hidden surcharges. All services include complimentary hair consultation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serviceHighlights.map((svc, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-dark-surface border border-dark-border hover:border-brand-500/40 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark-card border border-dark-border text-brand-300 uppercase">
                      {svc.cat}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{svc.duration}</span>
                  </div>
                  <h4 className="font-bold text-sm text-gray-100 group-hover:text-brand-300 transition-colors mt-1.5">
                    {svc.name}
                  </h4>
                </div>
                <div className="font-mono font-black text-brand-300 text-lg">
                  {svc.price}
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-900/30 via-dark-surface to-brand-900/30 border border-brand-500/30 text-center space-y-3">
            <h3 className="font-bold text-white text-base">Full Custom Consultations Available</h3>
            <p className="text-xs text-gray-400 max-w-lg mx-auto">
              Looking for bridal styling, global hair color transformations, or scalp detox? Visit our salon or call our desk.
            </p>
            <div className="pt-2">
              <a
                href="tel:+919876543210"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-all shadow-md shadow-brand-500/20"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Desk: +91 98765 43210</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Location & Hours Section */}
      <section id="contact" className="py-16 border-t border-dark-border bg-dark-surface/40 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="p-5 rounded-xl bg-dark-card border border-dark-border space-y-2">
            <div className="flex items-center gap-2 text-brand-400 font-bold uppercase text-[11px]">
              <MapPin className="w-4 h-4" />
              <span>Location</span>
            </div>
            <p className="text-gray-300 font-medium">123 Elite Boulevard, Road No. 36</p>
            <p className="text-gray-400">Jubilee Hills, Hyderabad, TS 500033</p>
          </div>

          <div className="p-5 rounded-xl bg-dark-card border border-dark-border space-y-2">
            <div className="flex items-center gap-2 text-brand-400 font-bold uppercase text-[11px]">
              <Clock className="w-4 h-4" />
              <span>Operating Hours</span>
            </div>
            <p className="text-gray-300 font-medium">Monday – Sunday: 9:00 AM – 9:00 PM</p>
            <p className="text-gray-400">Walk-ins & Appointments welcome</p>
          </div>

          <div className="p-5 rounded-xl bg-dark-card border border-dark-border space-y-2">
            <div className="flex items-center gap-2 text-brand-400 font-bold uppercase text-[11px]">
              <Calendar className="w-4 h-4" />
              <span>Reservations</span>
            </div>
            <p className="text-gray-300 font-medium">Direct Line: +91 98765 43210</p>
            <p className="text-gray-400">Email: concierge@trimzsalon.com</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-dark-border text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Trimz Salon. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-brand-300 transition-colors">Owner & Staff Login</Link>
            <span>•</span>
            <span className="font-mono text-gray-600">Enterprise Operations Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

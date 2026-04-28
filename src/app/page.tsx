"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/Wordmark";
import { Footer } from "@/components/Footer";
import { ArrowRight, FileText, Settings, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-[100dvh] flex flex-col bg-paper relative overflow-hidden">
      {/* Background ambient gradient */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-mesh-gradient opacity-10 pointer-events-none" />

      {/* Sticky Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-hairline bg-paper/80 backdrop-blur-lg">
        <div className="container py-4 flex items-center justify-between">
          <Wordmark className="h-6 w-auto text-ink" />
          <div className="flex items-center gap-4">
            <Link href="/merchant/login" className="hidden sm:block text-sm font-medium text-ink/70 hover:text-accent transition-colors">
              Merchant Login
            </Link>
            <Button asChild size="sm" variant="primary">
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container flex-1 flex flex-col justify-center py-24 md:py-32 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-accent/10 text-accent text-sm font-semibold mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            Now live on campus
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-6xl md:text-8xl font-serif font-semibold tracking-tighter leading-tight text-balance text-ink"
          >
            Skip the <span className="text-accent italic pr-2">print queue.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 text-xl text-ink/60 max-w-2xl mx-auto leading-relaxed"
          >
            Upload your PDFs. Pick a slot. Pay. Walk in at your time and collect from a numbered bin without waiting in line.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 flex flex-wrap justify-center gap-4"
          >
            <Button asChild size="lg" variant="accent" className="group">
              <Link href="/login">
                Start Printing
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="#how-it-works">How it works</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Marquee Ticker */}
      <div className="w-full bg-ink text-paper py-4 overflow-hidden border-y border-ink">
        <div className="flex w-max animate-marquee space-x-12 px-6 items-center">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center space-x-12">
              <span className="text-sm smallcaps text-paper/80">Premium Quality</span>
              <span className="text-accent">✦</span>
              <span className="text-sm smallcaps text-paper/80">Zero Waiting Time</span>
              <span className="text-accent">✦</span>
              <span className="text-sm smallcaps text-paper/80">Live Pricing</span>
              <span className="text-accent">✦</span>
            </div>
          ))}
        </div>
      </div>

      {/* Features/How it Works */}
      <section id="how-it-works" className="container py-24 md:py-32 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif font-semibold text-ink">Three steps to done.</h2>
          <p className="mt-4 text-ink/60 text-lg">We&apos;ve made printing as seamless as ordering food.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              step: "01",
              title: "Upload",
              desc: "PDFs, photos, screenshots. We convert HEIC and images for you automatically.",
              icon: FileText,
            },
            {
              step: "02",
              title: "Configure",
              desc: "Paper, color, sides, layout, copies. See live price updates as you adjust.",
              icon: Settings,
            },
            {
              step: "03",
              title: "Walk in",
              desc: "Show your token. Grab your prints from a numbered bin. You're done.",
              icon: Zap,
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group glass-panel rounded-2xl p-8 hover:shadow-glass-md transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-accent transition-all duration-300">
                <feature.icon className="w-6 h-6 text-accent group-hover:text-paper transition-colors duration-300" />
              </div>
              <div className="font-mono text-ink/40 text-sm font-medium mb-2">{feature.step}</div>
              <h3 className="font-semibold text-2xl mb-3 text-ink">{feature.title}</h3>
              <p className="text-ink/70 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}

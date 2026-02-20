"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Sliders, Code2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeUp, staggerContainer } from "@/lib/animations";

const features = [
  {
    title: "Generative AI",
    desc: "Latent space exploration via prompt engineering.",
    link: "/studio",
    icon: Sparkles,
  },
  {
    title: "Parametric Control",
    desc: "Granular manipulation of algorithmic variables.",
    link: "/studio/manual",
    icon: Sliders,
  },
  {
    title: "Raw Canvas",
    desc: "Direct JS/SVG manipulation environment.",
    link: "/studio/code",
    icon: Code2,
  },
];

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 py-20 lg:py-32 relative overflow-hidden min-h-screen">
      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Decorative background grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "100px 100px",
          backgroundPosition: "center center",
        }}
      />

      <div className="max-w-[1200px] w-full flex flex-col items-center text-center relative z-10">
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="space-y-8 flex flex-col items-center"
        >
          {/* Title */}
          <motion.div variants={fadeUp} className="relative">
            <h1 className="font-serif text-7xl md:text-[140px] leading-none tracking-tight text-white mb-4 italic pr-8">
              ArtMint
            </h1>
            <div className="absolute bottom-4 right-0 font-mono text-xl md:text-3xl uppercase tracking-[0.3em] text-[var(--accent)] bg-[var(--bg)] px-2">
              Studio
            </div>
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="font-mono text-xs md:text-sm text-[var(--text-dim)] max-w-[500px] leading-relaxed uppercase tracking-widest"
          >
            The intersection of algorithmic logic and fine art. Parameterize,
            generate, and immortalize deterministic artworks on the Solana
            protocol.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-6 pt-12"
          >
            <Link href="/studio">
              <Button size="lg">Enter Studio</Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="secondary">
                View Archives
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)] mt-32 w-full border border-[var(--border)]"
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="bg-[var(--bg)] p-10 hover:bg-[var(--bg-card)] transition-colors group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 group-hover:text-[var(--accent)] transition-all transform group-hover:scale-110">
                <f.icon size={120} strokeWidth={0.5} />
              </div>
              <h3 className="font-serif text-2xl text-white mb-4 relative z-10">
                {f.title}
              </h3>
              <p className="font-mono text-xs text-[var(--text-dim)] leading-relaxed uppercase tracking-widest mb-12 max-w-[200px] relative z-10">
                {f.desc}
              </p>
              <Link
                href={f.link}
                className="font-mono text-xs text-white group-hover:text-[var(--accent)] transition-colors flex items-center gap-3 tracking-widest uppercase relative z-10 no-underline"
              >
                Initialize{" "}
                <ArrowRight
                  size={14}
                  className="group-hover:translate-x-2 transition-transform"
                />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

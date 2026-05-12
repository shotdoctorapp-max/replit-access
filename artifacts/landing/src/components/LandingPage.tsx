import React, { useState } from "react";
import { Link } from "wouter";
import { WaitlistForm } from "./WaitlistForm";

const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSd2uxUHZsvlQpCCCt_ix76NkO-pbqNRoVIzWX2qUzmgG2_rrQ/viewform?usp=dialog";

function BetaTesterSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const cards = [
    {
      emoji: "🐛",
      heading: "Found a bug?",
      body: "Tap the bug icon inside the app to report it instantly — we get it right away.",
      action: null,
      actionLabel: null,
    },
    {
      emoji: "💬",
      heading: "Have feedback?",
      body: "Tell us what's working and what's not. Your input shapes every update.",
      action: () => window.open(FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer"),
      actionLabel: "Open Feedback Form →",
    },
    {
      emoji: "🏀",
      heading: "Love it? Spread the word.",
      body: "Send this page to a teammate who needs to fix their shot.",
      action: handleCopy,
      actionLabel: copied ? "✓ Copied!" : "Copy Link",
    },
  ];

  return (
    <section className="py-20 px-6 border-t border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center border border-primary/30 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium tracking-wide uppercase mb-5">
            <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2 animate-pulse" />
            For Beta Testers
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            Already have the app?{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">
              Here's how to help.
            </span>
          </h2>
          <p className="text-white/50 text-base max-w-xl mx-auto">
            You're not just a user — you're shaping what Shot Doctor becomes. Three things make a huge difference:
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {cards.map((card) => (
            <div
              key={card.heading}
              className="relative p-7 rounded-2xl border border-primary/25 bg-primary/5 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300 flex flex-col gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-2xl">
                {card.emoji}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">{card.heading}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{card.body}</p>
              </div>
              {card.action && card.actionLabel && (
                <button
                  onClick={card.action}
                  className="self-start text-primary text-sm font-semibold hover:text-emerald-300 transition-colors duration-200 underline underline-offset-4"
                >
                  {card.actionLabel}
                </button>
              )}
              {!card.action && (
                <p className="self-start text-white/25 text-xs font-medium tracking-wide uppercase">
                  In-app only
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CourtVisual() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 flex items-center justify-center z-0">
      <div className="relative w-full max-w-4xl aspect-[2/1] border border-primary/30 rounded-[100%] scale-150 transform translate-y-[20%] rotate-x-60 perspective-[1000px]">
        <div className="absolute inset-x-0 top-1/2 h-px bg-primary/30"></div>
        <div className="absolute inset-y-0 left-1/2 w-px bg-primary/30"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 border border-primary/40 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 border border-primary/20 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute top-1/2 left-1/2 w-[40rem] h-[40rem] border border-primary/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        
        {/* Pulsing dots simulating analysis */}
        <div className="absolute top-[40%] left-[45%] w-2 h-2 bg-primary rounded-full animate-[pulse-ring_2s_infinite]"></div>
        <div className="absolute top-[60%] left-[55%] w-2 h-2 bg-primary rounded-full animate-[pulse-ring_2s_infinite_0.5s]"></div>
        <div className="absolute top-[50%] left-[60%] w-2 h-2 bg-primary rounded-full animate-[pulse-ring_2s_infinite_1s]"></div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
    </div>
  );
}

function BodyMapPhone() {
  return (
    <div className="relative w-64 h-[500px] bg-card border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-[float_6s_ease-in-out_infinite] z-10">
      {/* Phone Header */}
      <div className="absolute top-0 inset-x-0 h-14 bg-black/50 backdrop-blur border-b border-white/5 flex items-center justify-center z-20">
        <div className="w-1/3 h-1 bg-white/20 rounded-full"></div>
      </div>
      
      {/* Video Frame */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black pt-14 pb-20">
        <div className="w-full h-full relative flex items-center justify-center">
          {/* Abstract Player Silhouette */}
          <svg viewBox="0 0 100 200" className="w-4/5 h-4/5 opacity-50">
            <path d="M 50 20 C 50 15, 55 10, 60 10 C 65 10, 70 15, 70 20 C 70 25, 65 30, 60 30 C 55 30, 50 25, 50 20 Z" fill="currentColor" className="text-white/20"/>
            <path d="M 60 30 L 50 70 L 30 90 L 40 100 L 55 80 L 60 110 L 45 160 L 55 165 L 70 110 L 75 160 L 85 155 L 75 100 L 85 60 L 70 40 Z" fill="currentColor" className="text-white/20"/>
            <path d="M 50 70 L 20 60 L 10 30" stroke="currentColor" strokeWidth="4" fill="none" className="text-white/20"/>
          </svg>
          
          {/* Analysis Overlay - Skeleton tracking */}
          <svg viewBox="0 0 100 200" className="absolute inset-0 w-full h-full">
            {/* Lines */}
            <path d="M 60 20 L 60 30 L 50 70 L 20 60 L 10 30" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4 2" fill="none" className="opacity-80"/>
            <path d="M 50 70 L 60 110 L 45 160" stroke="hsl(var(--destructive))" strokeWidth="1.5" fill="none" className="opacity-80"/>
            <path d="M 60 110 L 75 160" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" className="opacity-80"/>
            
            {/* Dots */}
            <circle cx="60" cy="20" r="3" fill="hsl(var(--primary))" /> {/* Head/Eyes */}
            <circle cx="60" cy="30" r="3" fill="hsl(var(--primary))" /> {/* Neck */}
            <circle cx="50" cy="70" r="3" fill="hsl(var(--primary))" /> {/* Hip */}
            <circle cx="20" cy="60" r="3" fill="#fbbf24" /> {/* Elbow - Warning */}
            <circle cx="10" cy="30" r="3" fill="hsl(var(--primary))" /> {/* Wrist */}
            
            <circle cx="60" cy="110" r="3" fill="hsl(var(--destructive))" /> {/* Knee - Issue */}
            <circle cx="45" cy="160" r="3" fill="hsl(var(--primary))" /> {/* Foot */}
            <circle cx="75" cy="160" r="3" fill="hsl(var(--primary))" /> {/* Foot */}
          </svg>
          
          {/* Scanning Line */}
          <div className="absolute w-full h-[2px] bg-primary shadow-[0_0_8px_hsl(var(--primary))] animate-[scanline_3s_ease-in-out_infinite]"></div>
        </div>
      </div>
      
      {/* Floating Insight Cards */}
      <div className="absolute top-20 right-2 bg-black/80 backdrop-blur border border-primary/30 p-2 rounded-lg text-[10px] text-white/90">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]"></div>
          <span className="font-semibold">Elbow Flare</span>
        </div>
        <div className="text-white/50">Tucked 15° out</div>
      </div>
      
      <div className="absolute bottom-28 left-2 bg-black/80 backdrop-blur border border-destructive/50 p-2 rounded-lg text-[10px] text-white/90">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive"></div>
          <span className="font-semibold">Knee Bend</span>
        </div>
        <div className="text-white/50">Insufficient load</div>
      </div>
    </div>
  );
}

function TimelinePhone() {
  return (
    <div className="relative w-64 h-[500px] bg-card border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-[float_6s_ease-in-out_infinite_1s] z-10 translate-y-12">
      <div className="absolute top-0 inset-x-0 h-14 bg-black/50 backdrop-blur border-b border-white/5 flex items-center justify-center z-20">
        <div className="w-1/3 h-1 bg-white/20 rounded-full"></div>
      </div>
      
      <div className="absolute inset-0 bg-black pt-16 px-4 flex flex-col">
        <div className="mb-6">
          <h3 className="text-white font-semibold text-sm mb-1">Shot Rhythm</h3>
          <div className="flex items-end gap-1 h-8">
            <div className="w-full bg-white/10 h-2 rounded-sm"></div>
            <div className="w-full bg-white/10 h-3 rounded-sm"></div>
            <div className="w-full bg-primary h-6 rounded-sm shadow-[0_0_8px_hsl(var(--primary)/0.5)]"></div>
            <div className="w-full bg-white/10 h-8 rounded-sm"></div>
          </div>
        </div>
        
        <div className="space-y-3">
          {["Setup", "Dip", "Set Point", "Release"].map((phase, i) => (
            <div key={phase} className={`p-3 rounded-xl border ${i === 2 ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5'} flex items-center gap-3`}>
              <div className={`w-8 h-8 rounded-md bg-black border ${i === 2 ? 'border-primary' : 'border-white/10'} flex items-center justify-center overflow-hidden relative`}>
                 <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
                   <path d={`M 50 ${70 - i*10} L 50 30`} stroke="white" strokeWidth="4" />
                 </svg>
                 {i === 2 && <div className="absolute inset-0 bg-primary/20"></div>}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-white/90">{phase}</div>
                <div className="text-[10px] text-white/50">{
                  i === 0 ? "0.0s • Balanced" :
                  i === 1 ? "0.2s • Smooth" :
                  i === 2 ? "0.4s • Perfect angle" :
                  "0.6s • Good follow"
                }</div>
              </div>
              {i === 2 && <div className="text-[10px] font-bold text-primary">BEST</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-black text-white selection:bg-primary selection:text-black font-sans">
      
      {/* Header */}
      <header className="fixed top-0 inset-x-0 h-20 border-b border-white/5 bg-black/80 backdrop-blur-md z-50 flex items-center px-6 md:px-12">
        <div className="font-bold text-xl tracking-tight flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <div className="w-2 h-2 bg-black rounded-full"></div>
          </div>
          Shot Doc
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-6 overflow-hidden">
        <CourtVisual />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center border border-primary/30 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium tracking-wide uppercase mb-6">
              <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2 animate-pulse"></span>
              Private Beta
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 leading-[1.1]">
              Stop guessing.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">
                Fix your shot.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/60 mb-10 leading-relaxed">
              Upload a video. Our AI extracts key frames, analyzes your biomechanics, and gives you the exact fixes to shoot lights out. Like having a shooting coach in your pocket.
            </p>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Mockups Section */}
      <section className="py-20 bg-black relative border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,200,83,0.05)_0%,transparent_70%)]"></div>
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            <BodyMapPhone />
            <div className="hidden md:block w-px h-64 bg-gradient-to-b from-transparent via-primary/30 to-transparent"></div>
            <TimelinePhone />
          </div>
        </div>
      </section>

      <BetaTesterSection />

      {/* How it works */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">How it works</h2>
            <p className="text-white/50 text-lg">Three steps to a perfect jumper.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: "01", title: "Record", desc: "Film your shot from any angle. Game speed or practice, doesn't matter." },
              { num: "02", title: "Analyze", desc: "AI maps your body, breaks down the phases, and finds the leaks in your kinetic chain." },
              { num: "03", title: "Fix", desc: "Get targeted drills and biomechanical cues to rebuild your form." }
            ].map((step, i) => (
              <div key={i} className="relative p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 transition-colors duration-500 group">
                <div className="text-primary/20 text-6xl font-black absolute top-4 right-6 group-hover:text-primary/40 transition-colors">{step.num}</div>
                <h3 className="text-xl font-bold mt-12 mb-3">{step.title}</h3>
                <p className="text-white/60 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 border-t border-white/5 bg-gradient-to-b from-black to-card">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to level up?</h2>
          <p className="text-white/50 mb-10 text-lg">Join the private beta and be the first to get access when we launch.</p>
          <WaitlistForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/10 text-center text-white/30 text-sm space-y-2">
        <p>&copy; {new Date().getFullYear()} Shot Doc. All rights reserved.</p>
        <p>
          <Link href="/privacy" className="hover:text-white/60 underline underline-offset-4 transition-colors duration-200">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  );
}

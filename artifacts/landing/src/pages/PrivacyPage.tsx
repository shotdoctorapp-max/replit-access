import React from "react";
import { Link } from "wouter";

export function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] bg-black text-white font-sans">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 h-20 border-b border-white/5 bg-black/80 backdrop-blur-md z-50 flex items-center px-6 md:px-12">
        <Link
          href="/"
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-200 text-sm font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Shot Doc
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-36 pb-24">
        <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Privacy Policy</p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
          Your privacy,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">
            straight up.
          </span>
        </h1>
        <p className="text-white/40 text-sm mb-12">Last updated: May 2026</p>

        <div className="space-y-10 text-white/70 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Introduction</h2>
            <p>
              Shot Doc ("we", "us") is an AI-powered basketball shooting form analyzer currently in private beta.
              This policy explains what data we collect, why we collect it, and how we handle it.
              We keep it minimal — you're here to fix your shot, not fill out paperwork.
            </p>
          </section>

          <div className="w-full h-px bg-white/5" />

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Information We Collect</h2>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <div>
                  <p className="text-white font-medium mb-1">Email address</p>
                  <p>Collected when you join the waitlist or create an account. Used only to notify you of beta access and product updates.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <div>
                  <p className="text-white font-medium mb-1">Video frames</p>
                  <p>When you analyze a shot, your video is processed on-device into JPEG frames. Those frames are sent to our AI model for analysis and are <strong className="text-white">not stored</strong> after your session result is returned. We do not retain your video or frames on our servers.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <div>
                  <p className="text-white font-medium mb-1">Bug reports</p>
                  <p>If you submit a bug report, we collect the text you write plus basic device information (model, OS version, app version, platform). This is used solely to diagnose and fix issues.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <div>
                  <p className="text-white font-medium mb-1">Analysis results</p>
                  <p>Your session results (scores, drill recommendations, biomechanics breakdown) are stored locally on your device. We do not upload or sync your personal analysis history to our servers.</p>
                </div>
              </li>
            </ul>
          </section>

          <div className="w-full h-px bg-white/5" />

          <section>
            <h2 className="text-lg font-bold text-white mb-3">How We Use It</h2>
            <p className="mb-4">We use your data to:</p>
            <ul className="space-y-2">
              {[
                "Send you beta access and product update emails (email only)",
                "Process your video and return AI analysis results",
                "Diagnose bugs and improve the app (bug reports + device info)",
                "Understand aggregate usage patterns to improve the product",
              ].map((item) => (
                <li key={item} className="flex gap-3 items-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">We do not sell your data. We do not share it with advertisers. Full stop.</p>
          </section>

          <div className="w-full h-px bg-white/5" />

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Data Retention</h2>
            <p>
              Email addresses are kept until you ask us to remove yours.
              Video frames are deleted immediately after analysis is complete — typically within seconds.
              Bug reports are kept for as long as needed to resolve the reported issue.
              Local session data lives on your device and is cleared when you uninstall the app.
            </p>
          </section>

          <div className="w-full h-px bg-white/5" />

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Third-Party Services</h2>
            <p className="mb-3">
              We use the following third-party services to operate Shot Doc:
            </p>
            <ul className="space-y-2">
              {[
                "OpenAI — AI model for shot analysis (frames are sent to their API; see openai.com/policies/privacy)",
                "Clerk — User authentication and account management",
                "Replit — Hosting and infrastructure",
              ].map((item) => (
                <li key={item} className="flex gap-3 items-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="w-full h-px bg-white/5" />

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Contact</h2>
            <p>
              Questions about this policy or want your data removed? Reach us through the feedback form inside the app or by replying to any email you've received from us.
              We'll respond within a few days.
            </p>
          </section>

        </div>
      </main>

      <footer className="py-8 border-t border-white/10 text-center text-white/30 text-sm">
        <p>&copy; {new Date().getFullYear()} Shot Doc. All rights reserved.</p>
      </footer>
    </div>
  );
}

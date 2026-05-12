import React, { useState } from "react";
import { useJoinWaitlist } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, Check } from "lucide-react";

function SharePrompt() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const tweetText = encodeURIComponent(
    "I just joined the Shot Doctor beta — AI that fixes your shooting form 🏀"
  );
  const tweetUrl = encodeURIComponent(window.location.href);
  const tweetHref = `https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`;

  return (
    <div className="mt-4 pt-4 border-t border-primary/20 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <p className="text-white/50 text-sm text-center">
        Know a baller who'd want early access? Send them this link.
      </p>
      <div className="flex gap-2 justify-center flex-wrap">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-200"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
        <a
          href={tweetHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors duration-200"
        >
          {/* X (Twitter) icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share on X
        </a>
      </div>
    </div>
  );
}

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const joinWaitlist = useJoinWaitlist();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    joinWaitlist.mutate(
      { data: { email, source: "landing" } },
      {
        onSuccess: () => {
          setEmail("");
        },
      }
    );
  };

  if (joinWaitlist.isSuccess) {
    return (
      <div className="w-full max-w-md mx-auto animate-in fade-in zoom-in duration-300">
        <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-md text-sm font-medium flex items-center justify-center">
          <span data-testid="text-success">Check your email to confirm your spot.</span>
        </div>
        <SharePrompt />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto relative">
      <div className="relative flex-1">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-12 bg-black/50 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-primary focus-visible:border-primary"
          data-testid="input-email"
          disabled={joinWaitlist.isPending}
        />
      </div>
      <Button
        type="submit"
        className="h-12 px-8 bg-primary hover:bg-primary/90 text-black font-bold uppercase tracking-wider disabled:opacity-50"
        data-testid="button-submit"
        disabled={joinWaitlist.isPending || !email}
      >
        {joinWaitlist.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join Beta"}
      </Button>
      {joinWaitlist.isError && (
        <p className="absolute -bottom-6 left-0 text-destructive text-xs" data-testid="text-error">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}

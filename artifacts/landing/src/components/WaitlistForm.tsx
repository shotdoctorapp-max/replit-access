import React, { useState } from "react";
import { useJoinWaitlist } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

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
      <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-md text-sm font-medium flex items-center justify-center animate-in fade-in zoom-in duration-300">
        <span data-testid="text-success">You're on the list. We'll be in touch.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
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

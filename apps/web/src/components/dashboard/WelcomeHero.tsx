"use client";

import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

interface WelcomeHeroProps {
  wallet: string | null;
  authenticated: boolean;
  signingIn: boolean;
  onSignIn: () => void;
}

export function WelcomeHero({ wallet, authenticated, signingIn, onSignIn }: WelcomeHeroProps) {
  const truncated = wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : null;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-6 mb-6"
    >
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-lg">
            {wallet ? wallet.slice(0, 2).toUpperCase() : "?"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {authenticated ? "Welcome back" : "Welcome to ArtMint"}
          </h1>
          <p className="text-sm text-muted">
            {truncated ? truncated : "Connect your wallet to get started"} &middot; {today}
          </p>
        </div>
      </div>

      {!authenticated && wallet && (
        <Button onClick={onSignIn} disabled={signingIn} size="lg">
          <Wallet className="mr-2 h-4 w-4" />
          {signingIn ? "Signing in..." : "Sign In With Solana"}
        </Button>
      )}
    </motion.div>
  );
}

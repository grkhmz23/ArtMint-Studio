"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/lib/use-auth";
import { Header } from "@/components/Header";
import { WelcomeHero } from "@/components/dashboard/WelcomeHero";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RecentMintsGrid } from "@/components/dashboard/RecentMintsGrid";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ActivityTable } from "@/components/dashboard/ActivityTable";
import type { DashboardData } from "@/types/dashboard";

export default function DashboardClient() {
  const { publicKey } = useWallet();
  const { authenticated, signingIn, signIn } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      try {
        const res = await fetch("/api/dashboard");
        const json: DashboardData = await res.json();
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [authenticated]);

  const wallet = publicKey?.toBase58() ?? null;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-5 py-8">
          <WelcomeHero
            wallet={wallet}
            authenticated={authenticated}
            signingIn={signingIn}
            onSignIn={signIn}
          />
          <StatsCards
            stats={data?.stats}
            quotaRemaining={data?.quota?.remaining}
            quotaLimit={data?.quota?.limit}
            loading={loading}
          />
          <RecentMintsGrid mints={data?.recentMints} loading={loading} />
          <QuickActions wallet={wallet} />
          <ActivityTable activity={data?.recentActivity} loading={loading} />
        </div>
      </main>
    </div>
  );
}

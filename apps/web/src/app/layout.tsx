import type { Metadata } from "next";
import { Providers } from "./providers";
import { SiteAnalytics } from "./SiteAnalytics";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArtMint Studio – AI Art Director",
  description: "Generate, mint, and sell deterministic generative art on Solana",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <Providers>{children}</Providers>
        <Footer />
        <SiteAnalytics />
      </body>
    </html>
  );
}

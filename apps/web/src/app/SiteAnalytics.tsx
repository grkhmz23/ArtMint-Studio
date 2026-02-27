"use client";

import { Analytics } from "@vercel/analytics/react";

const analyticsEnabled =
  process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "true";

export function SiteAnalytics() {
  return analyticsEnabled ? <Analytics /> : null;
}

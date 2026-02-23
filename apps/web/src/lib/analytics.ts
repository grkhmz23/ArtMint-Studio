/**
 * Custom Analytics Tracking
 * 
 * Tracks important user actions beyond basic page views.
 * Works alongside Vercel Analytics for comprehensive insights.
 */

export type AnalyticsEvent =
  // AI Generation
  | "ai_generate"
  | "ai_variation_click"
  | "ai_more_like_this"
  // Minting
  | "mint_initiated"
  | "mint_confirmed"
  | "mint_failed"
  // Listings
  | "listing_initiated"
  | "listing_confirmed"
  | "listing_cancelled"
  // Offers
  | "offer_made"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_cancelled"
  // Auctions
  | "auction_created"
  | "auction_bid"
  | "auction_won"
  // Social
  | "favorite_added"
  | "favorite_removed"
  | "follow"
  | "unfollow"
  // Collections
  | "collection_created"
  | "collection_item_added"
  // Navigation
  | "share"
  | "export_4k"
  | "download_artifact";

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Track a custom analytics event
 * Sends to Vercel Analytics and logs in development
 */
export function trackEvent(
  event: AnalyticsEvent,
  properties?: EventProperties
) {
  // Log in development
  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics]", event, properties);
  }

  // Send to Vercel Analytics via window.va
  if (typeof window !== "undefined" && "va" in window) {
    try {
      (window as any).va("event", event, properties);
    } catch (err) {
      // Silently fail if analytics isn't loaded
    }
  }
}

/**
 * Track AI generation events
 */
export function trackAIGeneration(
  templateId: string,
  preset: string,
  variationCount: number
) {
  trackEvent("ai_generate", {
    template_id: templateId,
    preset,
    variation_count: variationCount,
  });
}

/**
 * Track minting events
 */
export function trackMint(
  stage: "initiated" | "confirmed" | "failed",
  templateId?: string,
  error?: string
) {
  const eventName = `mint_${stage}` as AnalyticsEvent;
  trackEvent(eventName, {
    template_id: templateId,
    ...(error && { error }),
  });
}

/**
 * Track listing events
 */
export function trackListing(
  stage: "initiated" | "confirmed" | "cancelled",
  priceSol?: number
) {
  const eventName = `listing_${stage}` as AnalyticsEvent;
  trackEvent(eventName, {
    ...(priceSol && { price_sol: priceSol }),
  });
}

/**
 * Track offer events
 */
export function trackOffer(
  action: "made" | "accepted" | "rejected" | "cancelled",
  priceSol: number
) {
  const eventName = `offer_${action}` as AnalyticsEvent;
  trackEvent(eventName, { price_sol: priceSol });
}

/**
 * Track auction events
 */
export function trackAuction(
  action: "created" | "bid" | "won",
  auctionType: "english" | "dutch",
  amountSol?: number
) {
  const eventName = `auction_${action}` as AnalyticsEvent;
  trackEvent(eventName, {
    auction_type: auctionType,
    ...(amountSol && { amount_sol: amountSol }),
  });
}

/**
 * Track social interactions
 */
export function trackSocial(
  action: "favorite_added" | "favorite_removed" | "follow" | "unfollow"
) {
  trackEvent(action);
}

/**
 * Track collection actions
 */
export function trackCollection(
  action: "created" | "item_added",
  itemCount?: number
) {
  const eventName = `collection_${action}` as AnalyticsEvent;
  trackEvent(eventName, {
    ...(itemCount && { item_count: itemCount }),
  });
}

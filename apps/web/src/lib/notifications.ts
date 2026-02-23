import { prisma } from "@/lib/db";

export type NotificationType =
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_cancelled"
  | "bid_placed"
  | "outbid"
  | "auction_won"
  | "auction_ended"
  | "follow"
  | "favorite";

interface CreateNotificationParams {
  recipientWallet: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  mintAddress?: string;
}

export async function createNotification({
  recipientWallet,
  type,
  title,
  message,
  data,
  mintAddress,
}: CreateNotificationParams) {
  try {
    // Don't create notification if recipient is the actor (for self-actions)
    if (data && "actorWallet" in data && data.actorWallet === recipientWallet) {
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        recipientWallet,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
        mintAddress,
      },
    });

    return notification;
  } catch (err) {
    console.error("Failed to create notification:", err);
    return null;
  }
}

// Helper to notify when an offer is received
export async function notifyOfferReceived(
  sellerWallet: string,
  buyerWallet: string,
  mintAddress: string,
  priceSol: number
) {
  return createNotification({
    recipientWallet: sellerWallet,
    type: "offer_received",
    title: "New Offer Received",
    message: `Someone offered ${priceSol.toFixed(4)} SOL for your artwork`,
    data: { actorWallet: buyerWallet, priceSol },
    mintAddress,
  });
}

// Helper to notify when an offer is accepted
export async function notifyOfferAccepted(
  buyerWallet: string,
  sellerWallet: string,
  mintAddress: string,
  priceSol: number
) {
  return createNotification({
    recipientWallet: buyerWallet,
    type: "offer_accepted",
    title: "Offer Accepted!",
    message: `Your offer of ${priceSol.toFixed(4)} SOL was accepted`,
    data: { actorWallet: sellerWallet, priceSol },
    mintAddress,
  });
}

// Helper to notify when an offer is rejected
export async function notifyOfferRejected(
  buyerWallet: string,
  sellerWallet: string,
  mintAddress: string,
  priceSol: number
) {
  return createNotification({
    recipientWallet: buyerWallet,
    type: "offer_rejected",
    title: "Offer Rejected",
    message: `Your offer of ${priceSol.toFixed(4)} SOL was rejected`,
    data: { actorWallet: sellerWallet, priceSol },
    mintAddress,
  });
}

// Helper to notify when a bid is placed (for seller)
export async function notifyBidPlaced(
  sellerWallet: string,
  bidderWallet: string,
  mintAddress: string,
  bidSol: number,
  auctionId: string
) {
  return createNotification({
    recipientWallet: sellerWallet,
    type: "bid_placed",
    title: "New Bid Received",
    message: `New bid of ${bidSol.toFixed(4)} SOL on your auction`,
    data: { actorWallet: bidderWallet, bidSol, auctionId },
    mintAddress,
  });
}

// Helper to notify when outbid
export async function notifyOutbid(
  previousBidder: string,
  newBidder: string,
  mintAddress: string,
  newBidSol: number,
  auctionId: string
) {
  return createNotification({
    recipientWallet: previousBidder,
    type: "outbid",
    title: "You've Been Outbid!",
    message: `Someone bid ${newBidSol.toFixed(4)} SOL. Place a higher bid to win!`,
    data: { actorWallet: newBidder, newBidSol, auctionId },
    mintAddress,
  });
}

// Helper to notify when auction is won
export async function notifyAuctionWon(
  winnerWallet: string,
  sellerWallet: string,
  mintAddress: string,
  finalPriceSol: number,
  auctionId: string
) {
  return createNotification({
    recipientWallet: winnerWallet,
    type: "auction_won",
    title: "Auction Won! 🎉",
    message: `You won the auction for ${finalPriceSol.toFixed(4)} SOL`,
    data: { actorWallet: sellerWallet, finalPriceSol, auctionId },
    mintAddress,
  });
}

// Helper to notify seller when auction ends with no bids
export async function notifyAuctionEndedNoBids(
  sellerWallet: string,
  mintAddress: string,
  auctionId: string
) {
  return createNotification({
    recipientWallet: sellerWallet,
    type: "auction_ended",
    title: "Auction Ended",
    message: "Your auction ended with no bids",
    data: { auctionId },
    mintAddress,
  });
}

// Helper to notify when someone follows you
export async function notifyFollow(
  targetWallet: string,
  followerWallet: string
) {
  return createNotification({
    recipientWallet: targetWallet,
    type: "follow",
    title: "New Follower",
    message: "Someone started following you",
    data: { actorWallet: followerWallet },
  });
}

// Helper to notify when someone favorites your artwork
export async function notifyFavorite(
  ownerWallet: string,
  favoriterWallet: string,
  mintAddress: string
) {
  return createNotification({
    recipientWallet: ownerWallet,
    type: "favorite",
    title: "New Favorite",
    message: "Someone favorited your artwork",
    data: { actorWallet: favoriterWallet },
    mintAddress,
  });
}

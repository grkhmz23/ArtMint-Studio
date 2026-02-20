export interface DashboardStats {
  totalMints: number;
  confirmedMints: number;
  activeListings: number;
  totalListingValue: number; // in SOL
}

export interface DashboardMint {
  id: string;
  mintAddress: string;
  title: string | null;
  imageUrl: string;
  status: string;
  createdAt: string;
  listing: {
    priceLamports: string;
    status: string;
  } | null;
}

export interface ActivityItem {
  id: string;
  type: "mint" | "listing";
  title: string;
  mintAddress: string;
  status: string;
  timestamp: string;
}

export interface DashboardData {
  authenticated: boolean;
  wallet?: string;
  stats?: DashboardStats;
  recentMints?: DashboardMint[];
  recentActivity?: ActivityItem[];
  quota?: { remaining: number; limit: number };
}

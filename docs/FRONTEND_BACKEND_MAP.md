# ArtMint Studio - Frontend/Backend Connectivity Map

> **Last Updated:** 2026-02-23  
> **Status:** ✅ All Features Connected

---

## Page-to-API Mapping

### 1. Home (`/`)
| Feature | API | Status |
|---------|-----|--------|
| Landing page | Static | ✅ No API needed |
| Navigation links | Static routes | ✅ |

### 2. Dashboard (`/dashboard`)
| Feature | API | Status |
|---------|-----|--------|
| Stats display | `GET /api/dashboard` | ✅ |
| Recent mints | `GET /api/dashboard` | ✅ |
| Drafts | `GET /api/dashboard` | ✅ |
| Activity | `GET /api/dashboard` | ✅ |
| Quota info | `GET /api/dashboard` | ✅ |
| Wallet auth | `GET /api/auth/session` | ✅ |

### 3. Explore (`/explore`)
| Feature | API | Status |
|---------|-----|--------|
| Gallery items | `GET /api/explore` | ✅ |
| Sort/filter | Query params | ✅ |
| Infinite scroll | Pagination | ✅ |
| Favorite counts | Included in response | ✅ |

### 4. Collections (`/collections`)
| Feature | API | Status |
|---------|-----|--------|
| List collections | `GET /api/collections` | ✅ |
| Create collection | `POST /api/collections` | ✅ |
| View collection | `GET /api/collections/[slug]` | ✅ |
| Delete collection | `DELETE /api/collections/[slug]` | ✅ |

### 5. Auctions (`/auctions`)
| Feature | API | Status |
|---------|-----|--------|
| List auctions | `GET /api/auctions` | ✅ |
| Filter by type | Query params | ✅ |
| Real-time price | Client-side calculation | ✅ |
| Countdown timer | Client-side | ✅ |

### 6. Auction Detail (`/auction/[id]`)
| Feature | API | Status |
|---------|-----|--------|
| Auction details | `GET /api/auctions/[id]` | ✅ |
| Place bid | `POST /api/auctions/[id]/bid` | ✅ |
| Buy now (Dutch) | `POST /api/auctions/[id]/bid` | ✅ |
| Bid history | `GET /api/auctions/[id]` | ✅ |
| Real-time updates | Polling (10s) | ✅ |

### 7. Offers (`/offers`)
| Feature | API | Status |
|---------|-----|--------|
| Received offers | `GET /api/offers?sellerWallet=` | ✅ |
| Sent offers | `GET /api/offers?buyerWallet=` | ✅ |
| Accept offer | `PATCH /api/offers/[id]` | ✅ |
| Reject offer | `PATCH /api/offers/[id]` | ✅ |

### 8. Activity (`/activity`)
| Feature | API | Status |
|---------|-----|--------|
| Global feed | `GET /api/activity?type=global` | ✅ |
| Following feed | `GET /api/activity?type=following` | ✅ |
| Personal feed | `GET /api/activity?type=personal` | ✅ |

### 9. Notifications (`/notifications`)
| Feature | API | Status |
|---------|-----|--------|
| List notifications | `GET /api/notifications` | ✅ |
| Mark as read | `PATCH /api/notifications` | ✅ |
| Clear all | `DELETE /api/notifications` | ✅ |
| Real-time badge | Polling (30s) | ✅ |

### 10. Profile (`/profile/[wallet]`)
| Feature | API | Status |
|---------|-----|--------|
| User mints | Server-side fetch | ✅ |
| Follower count | Server-side fetch | ✅ |
| Following count | Server-side fetch | ✅ |
| Follow button | `POST/DELETE /api/follow` | ✅ |
| View followers | Link to `/followers` | ✅ |
| View following | Link to `/following` | ✅ |

### 11. Followers (`/profile/[wallet]/followers`)
| Feature | API | Status |
|---------|-----|--------|
| List followers | `GET /api/follow?type=followers` | ✅ |
| Follow back | `POST /api/follow` | ✅ |

### 12. Following (`/profile/[wallet]/following`)
| Feature | API | Status |
|---------|-----|--------|
| List following | `GET /api/follow?type=following` | ✅ |
| Unfollow | `DELETE /api/follow` | ✅ |

### 13. Asset Detail (`/asset/[mintAddress]`)
| Feature | API | Status |
|---------|-----|--------|
| Mint details | Server-side fetch | ✅ |
| Listing status | Included in response | ✅ |
| Create listing | `POST /api/listing/prepare` → `confirm` | ✅ |
| Create auction | `POST /api/auctions` | ✅ |
| Make offer | `POST /api/offers` | ✅ |
| Favorite | `POST/DELETE /api/favorites` | ✅ |
| Fullscreen preview | Client-side | ✅ |

### 14. AI Studio (`/studio`)
| Feature | API | Status |
|---------|-----|--------|
| Generate variations | `POST /api/ai/variations` | ✅ |
| Check quota | `GET /api/quota` | ✅ |
| Authentication | `POST /api/auth/verify` | ✅ |
| Load drafts | `GET /api/drafts` | ✅ |
| Save draft | `POST /api/drafts` | ✅ |
| Delete draft | `DELETE /api/drafts/[id]` | ✅ |
| Batch mint | `POST /api/mint` | ✅ |

### 15. Code Studio (`/studio/code`)
| Feature | API | Status |
|---------|-----|--------|
| Render preview | `GET /api/render` | ✅ |
| Mint custom | `POST /api/mint/custom` | ✅ |

### 16. Manual Studio (`/studio/manual`)
| Feature | API | Status |
|---------|-----|--------|
| Render preview | `GET /api/render` | ✅ |

### 17. Upload (`/upload`)
| Feature | API | Status |
|---------|-----|--------|
| Upload blob | `POST /api/blob` | ✅ |
| Commit upload | `POST /api/upload/commit` | ✅ |
| Mint uploaded | `POST /api/mint` | ✅ |

---

## Component-to-API Mapping

### Header Components
| Component | API | Purpose |
|-----------|-----|---------|
| `NotificationBell` | `GET /api/notifications` | Unread count |
| `WalletButton` | Wallet adapter | Connect/disconnect |

### Shared Components
| Component | API | Purpose |
|-----------|-----|---------|
| `FollowButton` | `POST/DELETE /api/follow` | Follow/unfollow users |
| `FavoriteButton` | `POST/DELETE /api/favorites` | Favorite artworks |
| `MakeOfferButton` | `POST /api/offers` | Make offers on NFTs |
| `CreateAuctionModal` | `POST /api/auctions` | Create auctions |

---

## Authentication Flow

```
1. User connects wallet (Wallet Adapter)
2. Frontend requests nonce: GET /api/auth/nonce
3. User signs message with wallet
4. Frontend verifies: POST /api/auth/verify
5. Session cookie set
6. Authenticated requests include session cookie
7. Logout: POST /api/auth/logout
```

---

## Data Flow Examples

### Creating a Listing
```
1. User enters price on /asset/[mint]
2. POST /api/listing/prepare → Returns unsigned transaction
3. User signs transaction with wallet
4. Transaction submitted to blockchain
5. POST /api/listing/confirm → Updates database
6. UI updates to show active listing
```

### Placing a Bid
```
1. User enters bid on /auction/[id]
2. POST /api/auctions/[id]/bid
3. Backend validates bid amount
4. Database updated with new bid
5. Notification sent to previous bidder (outbid)
6. Notification sent to seller
7. UI updates with new bid
```

### Following a User
```
1. User clicks Follow on /profile/[wallet]
2. POST /api/follow with targetWallet
3. Database updated with new follow
4. Notification sent to followed user
5. Activity logged
6. UI updates to show "Following"
```

---

## Real-time Features

| Feature | Method | Interval |
|---------|--------|----------|
| Notification badge | Polling | 30s |
| Auction price (Dutch) | Client calculation | 1s |
| Auction data refresh | Polling | 10s |
| Activity feed | On mount + manual refresh | - |

---

## API Routes Summary

### Public APIs (No Auth)
- `GET /api/health`
- `GET /api/health/deep`
- `GET /api/explore`
- `GET /api/auctions`
- `GET /api/auctions/[id]`
- `GET /api/collections`
- `GET /api/collections/[slug]`
- `GET /api/render`

### Authentication APIs
- `GET /api/auth/nonce`
- `POST /api/auth/verify`
- `GET /api/auth/session`
- `POST /api/auth/logout`

### Protected APIs (Requires Auth)
- `GET /api/dashboard`
- `GET /api/quota`
- `POST /api/ai/variations`
- `GET /api/drafts`
- `POST /api/drafts`
- `DELETE /api/drafts/[id]`
- `POST /api/mint`
- `POST /api/mint/custom`
- `POST /api/mint/confirm`
- `POST /api/listing/prepare`
- `POST /api/listing/confirm`
- `GET /api/offers`
- `POST /api/offers`
- `PATCH /api/offers/[id]`
- `POST /api/auctions`
- `POST /api/auctions/[id]/bid`
- `GET /api/notifications`
- `PATCH /api/notifications`
- `DELETE /api/notifications`
- `GET /api/follow`
- `POST /api/follow`
- `DELETE /api/follow`
- `GET /api/favorites`
- `POST /api/favorites`
- `DELETE /api/favorites`
- `POST /api/collections`
- `DELETE /api/collections/[slug]`
- `GET /api/activity`
- `POST /api/blob`
- `POST /api/upload/commit`

---

## Missing Features (None!)

✅ **All planned features are implemented and connected.**

---

## Testing Checklist

Use this to verify all connections work:

### Authentication
- [ ] Connect wallet
- [ ] Sign authentication message
- [ ] Access protected routes
- [ ] Session persists on refresh
- [ ] Logout works

### Core Features
- [ ] Generate AI variations
- [ ] Mint NFT
- [ ] Create listing
- [ ] Create auction
- [ ] Place bid
- [ ] Make offer
- [ ] Accept/reject offer

### Social Features
- [ ] Follow user
- [ ] View followers list
- [ ] View following list
- [ ] Favorite artwork
- [ ] Receive notifications
- [ ] View activity feed

### Collections
- [ ] Create collection
- [ ] Add items to collection
- [ ] View collection
- [ ] Delete collection

---

**Status: ✅ COMPLETE** - All frontend pages are fully connected to their respective backend APIs.

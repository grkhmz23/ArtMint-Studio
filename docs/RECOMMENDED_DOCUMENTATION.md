# ArtMint Studio - Recommended Documentation

> **For Developers and Contributors**

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [API Reference](#api-reference)
4. [Database Schema](#database-schema)
5. [Deployment Guides](#deployment-guides)
6. [Troubleshooting](#troubleshooting)
7. [Contributing](#contributing)

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18 ([Download](https://nodejs.org/))
- **pnpm** >= 8 ([Install](https://pnpm.io/installation))
- **Git** ([Download](https://git-scm.com/))
- **Solana Wallet** (Phantom or Solflare)
- **AI API Key** (Anthropic or OpenAI)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/artmint-studio.git
cd artmint-studio

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# 4. Set up database
pnpm db:migrate

# 5. Run development server
pnpm dev

# 6. Open http://localhost:3000
```

---

## Architecture Overview

### Monorepo Structure

```
artmint-studio/
├── apps/
│   └── web/              # Next.js 14 application
│       ├── src/
│       │   ├── app/      # App Router pages
│       │   ├── components/ # React components
│       │   ├── lib/      # Utilities and helpers
│       │   └── hooks/    # Custom React hooks
│       └── public/       # Static assets
├── packages/
│   ├── ai/               # AI client wrapper
│   ├── common/           # Shared types and utilities
│   ├── exchangeart/      # Exchange Art integration
│   └── render/           # SVG rendering engine
├── prisma/               # Database schema
├── docs/                 # Documentation
└── scripts/              # Build and deployment scripts
```

### Key Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 | React framework with App Router |
| Styling | Tailwind CSS | Utility-first CSS |
| UI Components | shadcn/ui | Accessible component primitives |
| Animation | Framer Motion | Page and component animations |
| State | React Hooks | Local state management |
| Backend | Next.js API Routes | Server-side logic |
| Database | PostgreSQL + Prisma | Data persistence |
| Storage | Vercel Blob | Image and file storage |
| Blockchain | Solana Web3.js | Solana interactions |
| AI | Anthropic/OpenAI | Art generation |

---

## API Reference

### Authentication

All protected APIs require session authentication. The session is established via wallet signature.

```typescript
// Authenticate a request
const res = await fetch('/api/protected', {
  credentials: 'include', // Important: sends session cookie
});
```

### Core Endpoints

#### AI Generation
```http
POST /api/ai/variations
Content-Type: application/json

{
  "prompt": "cosmic ocean waves",
  "preset": "minimal",
  "count": 12
}
```

#### Minting
```http
POST /api/mint
Content-Type: application/json

{
  "variation": { /* variation data */ }
}
```

#### Listings
```http
POST /api/listing/prepare
Content-Type: application/json

{
  "mintAddress": "...",
  "priceLamports": "100000000"
}
```

See [FRONTEND_BACKEND_MAP.md](./FRONTEND_BACKEND_MAP.md) for complete API documentation.

---

## Database Schema

### Core Models

#### Mint
Stores minted NFT information.

```prisma
model Mint {
  id           String    @id @default(cuid())
  mintAddress  String    @unique
  inputJson    String    // Generation parameters
  hash         String    // SHA-256 of input
  imageUrl     String
  animationUrl String
  wallet       String    // Owner
  status       String    // pending, confirmed
  createdAt    DateTime  @default(now())
  
  // Relations
  favorites    Favorite[]
  listing      Listing?
  auction      Auction?
}
```

#### Auction
Auction configuration and state.

```prisma
model Auction {
  id              String   @id @default(cuid())
  mintAddress     String   @unique
  type            String   // english | dutch
  startPriceLamports BigInt
  reservePriceLamports BigInt?
  minBidIncrement BigInt   @default(50000000)
  startTime       DateTime
  endTime         DateTime
  status          String   @default("active")
  highestBid      BigInt?
  highestBidder   String?
  
  bids            Bid[]
}
```

See `prisma/schema.prisma` for complete schema.

---

## Deployment Guides

### Development

```bash
# Run locally
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

### Production Deployment

See detailed guides:
- [Vercel Environment Setup](./VERCEL_ENV_SETUP.md)
- [Mainnet Deployment](./MAINNET_DEPLOYMENT.md)
- [Production Checklist](./PRODUCTION_CHECKLIST.md)

### Quick Production Deploy

```bash
# 1. Set environment variables
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add SOLANA_CLUSTER production
# ... (see VERCEL_ENV_SETUP.md for all variables)

# 2. Deploy
vercel --prod

# 3. Run database migrations
pnpm db:migrate
```

---

## Troubleshooting

### Common Issues

#### "SESSION_SECRET not set"
```bash
# Generate a new secret
openssl rand -hex 32

# Add to .env
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
```

#### "Database connection failed"
- Check `DATABASE_URL` includes `sslmode=require`
- Verify database allows connections from your IP
- Check PostgreSQL is running (local development)

#### "AI generation failing"
- Verify `AI_API_KEY` is valid
- Check quota hasn't been exceeded
- Review AI provider status page

#### "Transaction failing"
- Ensure wallet has sufficient SOL
- Check RPC endpoint is responsive
- Verify correct cluster (mainnet vs devnet)

### Debug Mode

Enable detailed logging:

```bash
# Set log level
LOG_LEVEL=debug pnpm dev
```

---

## Contributing

### Code Style

- **TypeScript**: Strict mode enabled
- **Components**: Functional with hooks
- **Styling**: Tailwind CSS with custom properties
- **Formatting**: Prettier (run `pnpm format`)
- **Linting**: ESLint (run `pnpm lint`)

### Commit Convention

```
feat: add new feature
fix: fix a bug
docs: update documentation
style: formatting changes
refactor: code restructuring
test: add tests
chore: maintenance tasks
```

### Pull Request Process

1. Create a feature branch
2. Make your changes
3. Run tests: `pnpm test`
4. Update documentation
5. Submit PR with description

---

## Resources

### External Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Prisma ORM](https://www.prisma.io/docs)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Anthropic API](https://docs.anthropic.com/)

### Community

- **Twitter**: [@artmintstudio](https://twitter.com/artmintstudio)
- **Discord**: [Join Server](https://discord.gg/artmint)
- **GitHub Discussions**: [View Forum](https://github.com/your-repo/artmint-studio/discussions)

---

## FAQ

### What blockchains are supported?

Currently only **Solana** mainnet-beta and devnet.

### What AI models work best?

We recommend **Claude 3.5 Sonnet** for art generation. GPT-4o also works well.

### Can I use my own storage?

Yes. Change `STORAGE_PROVIDER` to your preferred provider and update the storage adapter in `apps/web/src/lib/storage.ts`.

### How do I add a new template?

1. Create renderer in `packages/render/src/templates/`
2. Add Zod schema in `packages/common/src/schemas.ts`
3. Update template registry
4. Add documentation

---

## License

MIT © ArtMint Studio

---

**Need more help?** Open an issue on GitHub or contact support@artmint.studio

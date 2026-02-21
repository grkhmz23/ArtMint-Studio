# ArtMint Studio – AI Art Director for Exchange Art

AI-powered generative art studio: type a prompt, explore parameterized variations, mint deterministic art on Solana, and list for sale on Exchange Art.

## Key Features

- **AI Variation Engine**: Enter a prompt, get 12 deterministic art variations with full parameter control
- **Deterministic Renderer**: SVG-based rendering with seeded PRNG — same params always produce the same art
- **Reproducible Provenance**: Every minted piece stores its full input params on-chain, enabling re-rendering at any resolution
- **Self-Contained HTML Artifacts**: Each mint includes an offline-capable HTML file (animation_url) that re-renders from embedded params
- **Exchange Art Integration**: Mint via Metaplex + list via Exchange Art Buy Now program
- **4K Export**: Re-render any piece at 3840x3840 from the provenance panel

## Architecture

```
apps/web          → Next.js 14 (App Router) + TypeScript
packages/render   → Deterministic SVG generator + PNG export (resvg)
packages/ai       → AI client wrapper + Zod validation
packages/exchangeart → Exchange Art IDL loaders + tx builders
packages/common   → Schemas, stable stringify, hash utilities
prisma/           → SQLite schema + migrations
```

## Exchange Art Program IDs (from official IDLs)

| Program | ID |
|---------|-----|
| Code Canvas | `CoCaSGpuNso2yQP3oqi1tXt82wBp3y78SJDwLCboc8WS` |
| Buy Now + Editions | `EXBuYPNgBUXMTsjCbezENRUtFQzjUNZxvPGTd11Pznk5` |
| Offers | `exofLDXJoFji4Qyf9jSAH59J4pp82UT5pmGgR6iT24Z` |

Source: https://github.com/exchangeart/contracts-idls

## Setup

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- A Solana wallet (Phantom or Solflare recommended)
- An AI API key (Anthropic or OpenAI)

### Install

```bash
git clone <repo-url>
cd ArtMint-Studio
pnpm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
AI_PROVIDER=anthropic          # or openai
AI_API_KEY=your-api-key-here   # Your Anthropic or OpenAI API key
AI_MODEL=claude-sonnet-4-20250514  # or gpt-4o, etc.
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
STORAGE_PROVIDER=local         # local for dev
DATABASE_URL=file:./dev.db
```

### Initialize Database

```bash
pnpm db:migrate
```

### Run

```bash
pnpm dev
```

Open http://localhost:3000

## Templates

### Flow Fields (`flow_fields`)
Flowing lines and particles following a noise-based vector field. Parameters: density, lineWidth, curvature, grain, contrast, fieldScale, lineCount, stepCount, turbulence.

### Jazz Noir (`jazz_noir`)
Dark abstract cityscapes with neon circles, lines, and skyline bands. Parameters: neonIntensity, skylineBands, glow, rainGrain, circleCount, lineCount, depth, blur.

## Style Presets

- **Minimal**: Clean lines, muted tones, geometric simplicity
- **Glitch**: Digital artifacts, neon fragments, corrupted data
- **Jazz Noir**: Dark cityscapes, neon reflections, smoky atmosphere
- **BONK Mode**: Chaotic energy, maximum vibrancy

## Upload & Mint (Raster Pipeline)

Use `/upload` to mint existing artwork while preserving provenance.

**What gets stored**
- Original file (downloadable) for provenance
- Optimized mint image (WebP/PNG) for marketplace performance
- Thumbnail (WebP, 512px max)

**Limits & rules**
- Allowed: PNG, JPG, WebP (GIF optional)
- SVG is rejected (use Live Coding flow)
- Max original file size: 25MB
- Max input dimensions: 8192px
- Mint size: 2048 or 4096 max side
- Thumbnail size: 512 max side
- EXIF is stripped from optimized outputs

**Flow**
1. Open `/upload`
2. Upload an image and choose optimization settings
3. Click **Prepare for Mint** (client-side resize/compress)
4. Click **Mint** to upload original + mint + thumbnail

## Demo Script (3-min video)

1. **Open Studio** (`/studio`) — show the prompt input and preset buttons
2. **Enter prompt**: "Cosmic ocean waves with aurora borealis"
3. **Select preset**: Click "Glitch" or "Jazz Noir"
4. **Generate**: Click "Generate 12 Variations" — show the grid loading
5. **Browse**: Click through a few variations, showing the detail panel with params + palette
6. **More like this**: Click "More like this" on a favorite to generate nearby variations
7. **Connect wallet**: Click the wallet button, connect Phantom on devnet
8. **Mint**: Select a variation, click "Mint this" — show the provenance data
9. **Asset page** (`/asset/[mint]`):
   - Toggle PNG/Live Render views
   - Show the Provenance panel (prompt, seed, hash, palette)
   - Click "Copy params" — paste to show the canonical JSON
   - Click "Re-render 4K" — show the HTML artifact in a new tab
10. **List**: Enter a price in SOL, click "List Buy Now"
11. **Profile** (`/profile/[wallet]`): Show the minted items grid with listing status

## Testing

```bash
pnpm test
```

Runs unit tests for:
- Stable JSON stringify + deterministic hashing
- Zod validation (valid + invalid AI outputs)
- Renderer determinism (same input → same SVG)
- PRNG correctness
- Exchange Art program ID verification

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm test` | Run all tests |
| `pnpm build` | Build all packages + Next.js |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |

## How Determinism Works

1. AI returns **only JSON parameters** (never executable code)
2. Parameters are validated against strict Zod schemas
3. Renderer uses seeded PRNG (mulberry32) — no `Math.random()`
4. SVG uses fixed `viewBox 0 0 1080 1080` — no device/screen variability
5. Canonical input is hashed with SHA-256 for provenance verification
6. HTML artifact embeds renderer + params inline — works offline forever

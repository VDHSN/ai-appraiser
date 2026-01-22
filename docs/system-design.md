# Auction Proxy Agent - Systems Design

## Overview

An AI-powered auction exploration agent that acts as an expert curator, helping users discover, track, and compare items across multiple auction platforms (LiveAuctioneers, eBay, etc.).

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌───────────────────┐  ┌───────────────────────────┐           │
│  │   Chat/Search     │  │  Item Cards & Compare     │           │
│  │    Interface      │  │       View                │           │
│  └───────────────────┘  └───────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel AI SDK Layer                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Agent Orchestrator                        ││
│  │  • Streaming responses  • Tool calling  • Context mgmt      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Tool Registry                               │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │
│  │  search   │  │  getItem  │  │ compare   │  │ priceHist │    │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Platform Adapter Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ LiveAuctioneers │  │      eBay       │  │    (Future)     │  │
│  │    Adapter      │  │    Adapter      │  │   Adapters      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Agent Orchestrator

The brain of the system using Vercel AI SDK's `streamText` with tool calling.

**Persona**: Expert appraiser/curator with deep knowledge of:

- Antiques & collectibles valuation
- Market trends and pricing history
- Authenticity indicators
- Condition assessment terminology

**Capabilities**:

- Natural language item search
- Proactive recommendations based on conversation context
- Price guidance and market analysis
- Comparative analysis between items

### 2. Platform Adapter (Abstract Class Pattern)

```typescript
/**
 * Abstract base class for all platform adapters.
 * Concrete implementations extend this class.
 */
abstract class PlatformAdapter {
  abstract readonly platform: string;

  abstract search(query: SearchQuery): Promise<SearchResult[]>;
  abstract getItem(itemId: string): Promise<ItemDetails>;
  abstract getPriceHistory(query: SearchQuery): Promise<SearchResult[]>;

  // Optional - not all platforms support
  watchItem?(itemId: string): Promise<WatchResult>;
  getBidHistory?(itemId: string): Promise<BidHistory[]>;
}

interface SearchQuery {
  keywords: string;
  category?: string;
  priceRange?: { min?: number; max?: number };
  condition?: string[];
  endingSoon?: boolean;
  location?: string;
}

interface SearchResult {
  platform: string;
  itemId: string;
  title: string;
  currentPrice: number;
  currency: string;
  imageUrl: string;
  endTime?: Date;
  bidCount?: number;
  url: string;
}
```

### 3. Unified Item Model

Normalized representation across all platforms:

```typescript
interface UnifiedItem {
  // Identity
  id: string; // Internal ID
  platformItemId: string; // Platform-specific ID
  platform: string;
  url: string;

  // Core details
  title: string;
  description: string;
  images: string[];
  category: string[];

  // Pricing
  currentPrice: number;
  currency: string;
  estimateRange?: { low: number; high: number };
  buyNowPrice?: number;

  // Auction state
  auctionType: "timed" | "live" | "buy-now";
  endTime?: Date;
  bidCount?: number;

  // Seller/source
  seller: {
    name: string;
    rating?: number;
    location?: string;
  };

  // Condition
  condition?: string;
  conditionNotes?: string;
}
```

### 4. Agent Tools

Tools exposed to the AI agent via Vercel AI SDK:

| Tool              | Description                            |
| ----------------- | -------------------------------------- |
| `searchItems`     | Search across one or all platforms     |
| `getItemDetails`  | Fetch full details for a specific item |
| `compareItems`    | Side-by-side comparison of 2+ items    |
| `getPriceHistory` | Historical pricing for similar items   |
| `assessValue`     | AI-powered valuation analysis          |

## API Routes Structure

```
/api
├── /chat                    # Main AI chat endpoint (POST, streaming)
├── /items
│   ├── /search             # Unified search across platforms
│   └── /[platform]/[id]    # Get item details
└── /price-history          # Historical sold items for valuation
```

## Data Flow: Search Query

```
User: "Find me Art Deco table lamps under $500"
                    │
                    ▼
            ┌───────────────┐
            │ AI Agent      │
            │ Parses intent │
            └───────────────┘
                    │
                    ▼ calls searchItems tool
            ┌───────────────┐
            │ Tool Registry │
            └───────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│ LiveAuct.     │       │ eBay          │
│ Adapter       │       │ Adapter       │
└───────────────┘       └───────────────┘
        │                       │
        └───────────┬───────────┘
                    ▼
            ┌───────────────┐
            │ Normalize &   │
            │ Dedupe        │
            └───────────────┘
                    │
                    ▼
            ┌───────────────┐
            │ AI Agent      │
            │ Curates &     │
            │ Explains      │
            └───────────────┘
                    │
                    ▼
            Streaming response with
            item cards + expert commentary
```

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | Next.js 14+ (App Router)            |
| AI         | Vercel AI SDK + Claude              |
| Styling    | Tailwind CSS                        |
| State      | React Server Components + `useChat` |
| Testing    | Vitest (TDD approach)               |
| Deployment | Vercel                              |

## Architecture Principles

- **Abstract class pattern** for adapters - clean extensibility
- **Functional programming** - pure functions for transformations
- **TDD** - write tests first with Vitest
- **Server-side execution** - adapters run as Vercel functions

## Platform Adapter Implementation Notes

### LiveAuctioneers

- Undocumented public API available
- Rich data: provenance, auction house details, live auction schedules
- Primary platform for MVP

### eBay

- Official API available (eBay Browse API)
- OAuth required
- Good for: Buy It Now, completed sales data for comps

### Future Platforms

- Christie's / Sotheby's (high-end)
- Invaluable
- 1stDibs
- Ruby Lane
- Etsy (vintage category)

## MVP Scope

**Phase 1 - Core Search & Chat**

- [ ] Basic chat UI with streaming
- [ ] LiveAuctioneers adapter
- [ ] `searchItems` and `getItemDetails` tools
- [ ] Item card display with images

**Phase 2 - Price History & Valuation**

- [ ] `getPriceHistory` tool (sold items database)
- [ ] `assessValue` tool (AI-powered appraisal)
- [ ] Compare view for side-by-side analysis

**Phase 3 - Multi-Platform (Future)**

- [ ] eBay adapter
- [ ] Unified search across platforms
- [ ] Basic deduplication

## Decisions

| Decision       | Choice          | Rationale                               |
| -------------- | --------------- | --------------------------------------- |
| First Platform | LiveAuctioneers | Undocumented public API available       |
| Scraping       | Case-by-case    | Prefer APIs, scrape only when necessary |

## Next Steps

1. Scaffold Next.js project with Vercel AI SDK
2. Build LiveAuctioneers adapter (TDD)
3. Implement core chat UI with `searchItems` tool
4. Add item detail views and comparison
5. Add price history and valuation tools

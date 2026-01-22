# Auction Proxy Agent - MVP Specification

## Design Documents

- `docs/system-design.md` - High-level architecture
- `docs/system-design-liveauctioneers-adapter.md` - LiveAuctioneers API reference

## Implementation Steps

### Phase 1: Project Setup

1. Initialize Next.js 14+ project with App Router
2. Install dependencies: `ai` (Vercel AI SDK), `zod`, Tailwind CSS
3. Set up project structure:
   ```
   /app
     /api
       /chat/route.ts              # AI chat endpoint (Vercel function)
       /items/
         /search/route.ts          # Search proxy (Vercel function)
         /[id]/route.ts            # Item details proxy (Vercel function)
       /price-history/route.ts     # Price history (Vercel function)
   /lib
     /adapters/
       types.ts                    # PlatformAdapter interface
       liveauctioneers.ts          # LA adapter (server-side only)
     /tools/                       # AI agent tool definitions
     /types/                       # Shared types
   /components
     /chat/                        # Chat UI components
     /items/                       # Item display components
   ```

**Note:** All adapters and tools execute server-side as Vercel functions. The frontend only calls `/api/*` routes.

### Phase 2: LiveAuctioneers Adapter

1. Implement search function (active auctions + price results)
2. Implement getItemDetails (combining 3 endpoints)
3. Add response normalization to UnifiedItem format
4. Add rate limiting and caching

### Phase 3: AI Agent & Tools

1. Set up Vercel AI SDK with Claude
2. Implement tools: `searchItems`, `getItemDetails`, `getPriceHistory`, `assessValue`
3. Create expert curator system prompt
4. Wire up streaming chat endpoint

### Phase 4: Frontend

1. Chat interface with `useChat` hook
2. Item card components with images
3. Compare view for side-by-side analysis

## Verification

- [ ] Search returns results from LiveAuctioneers
- [ ] Item details load with images and pricing
- [ ] Price history returns comparable sold items
- [ ] AI provides expert commentary on items
- [ ] Chat streams responses properly

---

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | Next.js 14+ (App Router)            |
| AI         | Vercel AI SDK + Claude              |
| Styling    | Tailwind CSS                        |
| State      | React Server Components + `useChat` |
| Testing    | Vitest                              |
| Deployment | Vercel                              |

## Architecture Principles

### Adapter Pattern

- Abstract base class `PlatformAdapter` defines the contract
- Concrete implementations (e.g., `LiveAuctioneersAdapter`) extend the base
- Clean separation of concerns for testability

```typescript
abstract class PlatformAdapter {
  abstract readonly platform: string;
  abstract search(query: SearchQuery): Promise<SearchResult[]>;
  abstract getItem(itemId: string): Promise<ItemDetails>;
  abstract getPriceHistory(query: SearchQuery): Promise<SearchResult[]>;
}

class LiveAuctioneersAdapter extends PlatformAdapter {
  readonly platform = "liveauctioneers";
  // Implementation...
}
```

### Functional Programming

- Pure functions for data transformation and normalization
- No side effects in core logic
- Immutable data structures
- Composable utilities

```typescript
// Pure transformation functions
const normalizeSearchResult = (raw: LASearchResult): SearchResult => ({ ... });
const buildSearchParams = (query: SearchQuery): URLSearchParams => ({ ... });
const parsePrice = (price: string | number): number => ({ ... });
```

### Testing (TDD)

- Write tests first, implement second
- Unit tests for all pure functions
- Integration tests for adapter methods
- Mock external API calls

```
/lib
  /adapters/
    __tests__/
      liveauctioneers.test.ts
    liveauctioneers.ts
  /utils/
    __tests__/
      normalize.test.ts
    normalize.ts
```

## Decisions

| Decision       | Choice                 | Rationale                                  |
| -------------- | ---------------------- | ------------------------------------------ |
| First Platform | LiveAuctioneers        | Undocumented public API available          |
| Scraping       | Case-by-case           | Prefer APIs, scrape only when necessary    |
| Execution      | Server-side            | All adapters/tools run as Vercel functions |
| Adapters       | Abstract class pattern | Clean extensibility for new platforms      |
| Code Style     | Functional + Pure      | Testability, predictability                |
| Testing        | Vitest + TDD           | Write tests first                          |

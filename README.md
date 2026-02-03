# Auction Proxy Agent

> AI-powered auction exploration and appraisal assistant

An intelligent multi-agent system that helps users discover, research, and evaluate items from leading auction platforms. Built with Next.js 16 and powered by Google Gemini AI.

## Features

- **Multi-Agent Architecture**: Specialized Curator and Appraiser agents for comprehensive item research
- **Platform Adapters**: Unified interface to LiveAuctioneers and 1stDibs marketplaces
- **AI-Powered Tools**: Item search, price history analysis, and valuation assessment
- **Real-time Chat**: Interactive conversational interface with streaming responses
- **Analytics & Monitoring**: PostHog integration for user behavior tracking and logging
- **Type-Safe**: Full TypeScript implementation with Zod validation

## Tech Stack

| Category            | Technologies                           |
| ------------------- | -------------------------------------- |
| **Framework**       | Next.js 16 (React 19)                  |
| **AI/ML**           | Vercel AI SDK, Google Gemini 2.0 Flash |
| **Styling**         | Tailwind CSS v4                        |
| **Authentication**  | Clerk                                  |
| **Analytics**       | PostHog, Vercel Analytics              |
| **Testing**         | Vitest, Playwright, Testing Library    |
| **Validation**      | Zod                                    |
| **Package Manager** | pnpm                                   |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10.5.2+
- Google Gemini API key
- Clerk account (for authentication)
- PostHog account (optional, for analytics)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd auction-proxy-agent

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Environment Variables

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Running Locally

```bash
# Start development server
pnpm dev

# Open http://localhost:3000
```

### Testing

```bash
# Run unit tests
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run all tests with UI
pnpm test:ui

# Run E2E tests
pnpm test:e2e

# Generate coverage report
pnpm test:coverage
```

## Project Structure

```
auction-proxy-agent/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/chat/          # Chat API endpoint with AI agents
│   │   └── (routes)/          # Application pages
│   ├── lib/
│   │   ├── adapters/          # Platform adapters (LiveAuctioneers, 1stDibs)
│   │   ├── analytics/         # PostHog integration
│   │   └── utils/             # Shared utilities
│   └── components/            # React components
├── .claude/                   # Claude Code configuration
│   ├── agents/               # Custom agent definitions
│   ├── commands/             # Custom commands
│   └── skills/               # Reusable skills
└── docs/                     # Documentation
```

## Adapters

The system uses a unified adapter pattern to interface with auction platforms:

### LiveAuctioneers

- Item search by keyword
- Price history retrieval
- Rate-limited API calls (1 req/sec)
- Upcoming and past auction data

### 1stDibs

- Luxury antiques and collectibles search
- Dealer and item information
- Filtered search by categories
- Price and availability data

## Agents

### Curator Agent

The Curator specializes in item discovery and research:

- Searches across multiple auction platforms
- Retrieves comprehensive item details
- Provides price history and market trends
- Helps users discover interesting items

### Appraiser Agent

The Appraiser focuses on valuation and assessment:

- Analyzes item condition and authenticity
- Evaluates market value based on historical data
- Provides comparative market analysis
- Offers insights on investment potential

## Development

### Code Style

- Follow SOLID and DRY principles
- Use pure functions wherever possible
- TDD approach: write tests first
- Architect before implementing

### Git Workflow

```bash
# Commit changes
pnpm run commit

# This project uses Husky for pre-commit hooks
# - Linting and formatting
# - Type checking
# - Running tests
```

## License

Copyright Adam Veldhousen 2026. All rights reserved.

# North Star Metric: Successful Agent Interactions

## Overview

Our north star metric measures when users receive tangible value from interacting with the AI agent. A "successful interaction" occurs when a user engages with the agent, the agent takes meaningful action, and the user follows through on the results.

This document outlines the metric definition, rationale, and implementation approach based on PostHog best practices.

## Why This Metric?

### The Problem with Vanity Metrics

Common metrics like "messages sent" or "daily active users" don't capture whether users actually received value. A user could send 50 messages in frustration without ever getting what they need.

### What "Success" Means for AI Agents

For AI chat/agent products, research from successful companies (ChatGPT, Claude, Perplexity) shows that effective north star metrics share common traits:

| Metric Type     | Example                          | Why It Works                    |
| --------------- | -------------------------------- | ------------------------------- |
| Task completion | Queries answered, code generated | Directly measures agent utility |
| User engagement | Links clicked, outputs used      | Confirms user found value       |
| Return behavior | Sessions per week, retention     | Indicates habit formation       |

Our product combines discovery (finding auction items) with analysis (valuation guidance). Success means users find items they care about and take action on them.

## Metric Definition

### The Funnel

```
Successful Agent Interaction

Step 1: User sends a message
        └── They have intent, they're asking for something

Step 2: Agent calls a tool
        └── The agent took action (searched, fetched details, assessed value)

Step 3: User clicks a link
        └── They engaged with the results (viewed item on auction site)
```

### Configuration

| Parameter         | Value        | Rationale                           |
| ----------------- | ------------ | ----------------------------------- |
| Conversion window | 30 minutes   | Typical session length for browsing |
| Attribution       | Same session | Events must be causally linked      |
| Funnel type       | Strict order | Steps must happen in sequence       |

### Breakdowns

- **By agent_id**: Compare curator vs appraiser effectiveness
- **By tool_name**: Which tools drive the most engagement?
- **By platform**: Do certain auction platforms convert better?

## Interpretation Guide

### What the Conversion Rate Tells Us

| Rate   | Interpretation                              |
| ------ | ------------------------------------------- |
| < 10%  | Agent not providing actionable results      |
| 10-30% | Normal browsing behavior, room to improve   |
| 30-50% | Strong product-market fit signal            |
| > 50%  | Exceptional - users consistently find value |

### Supporting Metrics

The north star should be supported by diagnostic metrics:

1. **Links per session** - Engagement depth (more = better)
2. **Tool calls per conversation** - Agent activity level
3. **Drop-off by step** - Where do users lose interest?
4. **Time to first link click** - Speed to value

## PostHog Best Practices

### Why Funnels Over Custom Events

PostHog explicitly recommends using their built-in metric types rather than firing computed events:

> "Use ratio metrics, funnels, retention metrics, or shared metrics for tracking composite or north star metrics that combine multiple events."
> — PostHog Docs

**Benefits of funnels:**

- No code changes needed to adjust the metric
- Built-in conversion rate calculations
- Native support for breakdowns and trends
- Can be saved as "Shared Metrics" for experiments

### Shared Metrics

Once the funnel is created, save it as a Shared Metric to:

- Reuse across dashboards
- Use as primary/secondary metric in A/B experiments
- Maintain consistency in reporting

### Session Stitching

PostHog automatically tracks `$session_id` on client-side events. To include server-side events in the same session:

- Pass the client's session ID to API endpoints
- Include `$session_id` in server-side event properties
- Use the same `distinctId` across client and server

## Current Implementation Status

### Events Available

| Event               | Funnel Step | Status  |
| ------------------- | ----------- | ------- |
| `chat_message_sent` | Step 1      | Tracked |
| `tool_called`       | Step 2      | Tracked |
| `link_clicked`      | Step 3      | Tracked |

### Gaps to Address

1. **Conversation grouping**: Events lack a `conversation_id` to group related interactions
2. **Session continuity**: Server events don't link to client sessions
3. **Dashboard**: Funnel not yet created in PostHog

See [GitHub Issue #10](https://github.com/VDHSN/ai-appraiser/issues/10) for implementation plan.

## Research Sources

### PostHog Documentation

- [Finding your North Star metric](https://posthog.com/founders/north-star-metrics) - Framework for choosing metrics
- [Experiment Metrics](https://posthog.com/docs/experiments/metrics) - Best practices for composite metrics
- [B2B SaaS Product Metrics](https://posthog.com/product-engineers/b2b-saas-product-metrics) - Industry patterns

### Industry Research

- [Amplitude: Product North Star Metric](https://amplitude.com/blog/product-north-star-metric) - Framework for metric selection
- [GoPractice: Guide to North Star Metrics](https://gopractice.io/product/the-product-managers-guide-to-north-star-metrics/) - Examples from top companies

### AI Product Patterns

| Company    | Implied North Star             | Why                                        |
| ---------- | ------------------------------ | ------------------------------------------ |
| ChatGPT    | Messages/queries processed     | Volume indicates ongoing value             |
| Perplexity | Searches with source clicks    | Similar to our funnel - query + engagement |
| Intercom   | Customer interactions resolved | Task completion focus                      |

## Appendix: Alternative Metrics Considered

### Messages Sent

- **Pro**: Easy to track, high volume
- **Con**: Doesn't indicate success, could measure frustration

### Daily Active Users

- **Pro**: Standard SaaS metric
- **Con**: Doesn't capture depth of engagement

### Tool Calls

- **Pro**: Measures agent activity
- **Con**: Agent could call tools without providing value

### Time in App

- **Pro**: Engagement proxy
- **Con**: Could indicate confusion, not value

The funnel approach combines the best aspects: user intent (message) + agent action (tool) + user validation (click).

# Product Analytics Best Practices

A style guide for implementing product analytics in our application, based on PostHog documentation and industry best practices from Amplitude, Segment, and Mixpanel.

## Event Naming Conventions

### The Object-Action Framework

Use the **object-action** pattern where the object is the noun (thing being interacted with) and the action is the verb (what happened).

```
Format: category:object_action

Examples:
  chat:message_sent
  search:item_clicked
  agent:tool_called
  checkout:order_completed
```

### Naming Rules

| Rule                       | Good                             | Bad                               |
| -------------------------- | -------------------------------- | --------------------------------- |
| Use snake_case             | `button_clicked`                 | `buttonClicked`, `Button Clicked` |
| Use past tense for actions | `order_completed`                | `complete_order`                  |
| Be specific                | `signup_button_clicked`          | `clicked`                         |
| Include context            | `chat:message_sent`              | `message_sent`                    |
| Consistent verbs           | `clicked`, `viewed`, `submitted` | `click`, `saw`, `sent`            |

### Standard Action Verbs

Stick to a controlled vocabulary:

- `clicked` - User clicked/tapped something
- `viewed` - User saw a page/component
- `submitted` - User submitted a form
- `created` - Something was created
- `updated` - Something was modified
- `deleted` - Something was removed
- `started` - A process began
- `completed` - A process finished
- `failed` - Something went wrong

### Property Naming

| Pattern            | Example                        | Use Case    |
| ------------------ | ------------------------------ | ----------- |
| `object_attribute` | `item_id`, `user_email`        | Identifiers |
| `is_*` / `has_*`   | `is_subscribed`, `has_premium` | Booleans    |
| `*_count`          | `bid_count`, `message_count`   | Counts      |
| `*_at` / `*_date`  | `created_at`, `signup_date`    | Timestamps  |
| `*_ms`             | `latency_ms`, `duration_ms`    | Durations   |

## What to Track

### High-Value Events (Always Track)

1. **Activation events** - First meaningful action
2. **Core feature usage** - The thing your product does
3. **Conversion events** - Signups, purchases, upgrades
4. **Retention signals** - Return visits, repeat actions
5. **Error states** - Failures users experience

### Our Core Events

| Event                      | Why It Matters                 |
| -------------------------- | ------------------------------ |
| `chat:message_sent`        | User engagement, session start |
| `agent:tool_called`        | Agent utility, feature usage   |
| `item:link_clicked`        | Conversion, user found value   |
| `agent:mode_switched`      | Feature discovery              |
| `adapter:search_completed` | Backend performance            |

### What NOT to Track

- Every scroll, hover, or mouse movement
- Redundant events (track once, not twice)
- Events without clear analytical value
- Raw PII (emails, full names, addresses)
- High-cardinality free-text fields

## Server-Side vs Client-Side Tracking

### When to Use Server-Side

- **Critical business events** (purchases, signups)
- **Events requiring accuracy** (no ad-blocker interference)
- **Backend operations** (API calls, jobs)
- **Sensitive data** (payment processing)

### When to Use Client-Side

- **User interactions** (clicks, scrolls, navigation)
- **UI state changes** (modal opens, tab switches)
- **Client-only context** (viewport size, JS errors)
- **Session/page context** (referrer, UTM params)

### Linking Client and Server Events

To analyze full user journeys, link client and server events:

```typescript
// Client: Get session ID
const sessionId = posthog.get_session_id();

// Pass to API
fetch("/api/action", {
  body: JSON.stringify({ sessionId, ...data }),
});

// Server: Include in event
posthog.capture({
  distinctId: userId,
  event: "order_completed",
  properties: {
    $session_id: sessionId, // Links to client session
    order_id: order.id,
  },
});
```

## Data Quality

### Filter Internal Users

Exclude team members from analytics to avoid skewing metrics:

1. **By email domain**: Filter `email contains @yourcompany.com`
2. **By property**: Set `is_employee: true` for team members
3. **By IP**: Exclude office IP ranges
4. **By environment**: Separate dev/staging from production

### Use a Reverse Proxy

Ad blockers block analytics. Set up a reverse proxy on your domain:

```javascript
posthog.init("your-key", {
  api_host: "https://analytics.yourdomain.com", // Your proxy
  ui_host: "https://us.posthog.com",
});
```

This routes requests through your domain, bypassing blocklist entries for known analytics domains.

### Version Your Events

When event definitions change, version them to preserve historical data:

```
v1: signup:form_submitted
v2: signup:form_submitted_v2  (added new properties)
```

Or use a `schema_version` property:

```typescript
posthog.capture("signup:form_submitted", {
  schema_version: 2,
  // ... properties
});
```

## Property Design

### Keep Properties Flat

```typescript
// Good: Flat properties
{
  item_id: '123',
  item_price: 99.99,
  item_category: 'furniture',
  seller_name: 'Acme Auctions'
}

// Bad: Nested objects (harder to query)
{
  item: {
    id: '123',
    price: 99.99,
    category: 'furniture'
  },
  seller: {
    name: 'Acme Auctions'
  }
}
```

### Limit Properties Per Event

- Target 5-10 properties per event
- Include only what's needed for analysis
- Use user/group properties for stable attributes

### Standard Properties to Include

Always include context that enables segmentation:

| Property          | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| `source`          | Where the action originated (user, agent, system) |
| `agent_id`        | Which agent mode was active                       |
| `platform`        | Which data source (for multi-platform)            |
| `session_id`      | Link events in same session                       |
| `conversation_id` | Link events in same conversation                  |

## Privacy and Compliance

### Minimize PII Collection

- Use anonymized IDs, not emails, as primary identifiers
- Mask or hash sensitive fields before sending
- Don't track precise geolocation unless required
- Avoid capturing form field values containing PII

### Consent and Opt-Out

```typescript
// Check consent before initializing
if (userHasConsented()) {
  posthog.init("key", {
    /* config */
  });
} else {
  posthog.init("key", {
    opt_out_capturing_by_default: true,
  });
}

// Allow users to opt out
posthog.opt_out_capturing();
```

### Data Retention

- Configure retention periods appropriate to your use case
- Delete user data on request (GDPR right to erasure)
- Document what you collect and why

## Common Mistakes

### 1. Tracking Everything

More data is not better data. Track events that answer specific questions.

### 2. Inconsistent Naming

`UserSignup`, `user_signup`, `signup`, and `user signed up` are four different events to PostHog. Pick one convention and enforce it.

### 3. No Tracking Plan

Document events before implementing. Include:

- Event name
- When it fires
- Required properties
- Owner (who maintains it)

### 4. Ignoring Data Quality

Test events in development. Verify they fire correctly. Monitor for anomalies in production.

### 5. Not Filtering Internal Traffic

Your team's usage patterns differ from real users. Always filter internal traffic from metrics.

## Implementation Checklist

- [ ] Define naming convention (this doc)
- [ ] Create tracking plan spreadsheet
- [ ] Set up reverse proxy
- [ ] Configure internal user filtering
- [ ] Implement core events
- [ ] Add session/conversation linking
- [ ] Test in development
- [ ] Verify in production
- [ ] Create dashboards for key metrics
- [ ] Set up alerts for anomalies

## References

### PostHog Documentation

- [Best Practices](https://posthog.com/docs/product-analytics/best-practices)
- [Tutorials](https://posthog.com/docs/product-analytics/tutorials)
- [Reverse Proxy Setup](https://posthog.com/docs/advanced/proxy)
- [Filter Internal Users](https://posthog.com/tutorials/filter-internal-users)

### Industry Resources

- [Amplitude: Analytics Tracking Practices](https://amplitude.com/blog/analytics-tracking-practices)
- [Amplitude: Event Taxonomy](https://amplitude.com/blog/event-taxonomy)
- [Segment: Tracking Plan Best Practices](https://segment.com/academy/collecting-data/naming-conventions-for-clean-data/)
- [Nimble: Event Tracking Guidelines](https://nimblehq.co/compass/product/analytics/event-tracking-guidelines/)

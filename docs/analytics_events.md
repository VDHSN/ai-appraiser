# Analytics Events Inventory

Complete event map for the Auction Proxy Agent application.

## User Journey Events (Client-Side)

| Event                   | Trigger                  | Key Properties                         | File                             |
| ----------------------- | ------------------------ | -------------------------------------- | -------------------------------- |
| `auth:sign_in_clicked`  | Sign in button click     | `source`                               | UserMenu.tsx, SignInPrompt.tsx   |
| `auth:sign_up_clicked`  | Sign up button click     | `source`                               | UserMenu.tsx, SignInPrompt.tsx   |
| `auth:prompt_shown`     | Sign-in prompt displayed | `agent_id`                             | SignInPromptWrapper.tsx          |
| `auth:prompt_dismissed` | User dismisses prompt    | `source`                               | SignInPrompt.tsx                 |
| `chat:agent_switched`   | Agent selection changed  | `from_agent`, `to_agent`, `session_id` | HomePage.tsx, NewUIContainer.tsx |
| `chat:link_clicked`     | External item link click | `item_id`, `platform`, `url`           | ItemCard.tsx, ItemDetail.tsx     |
| `agent:tool_called`     | Tool execution completes | `tool_name`, `agent_id`, `session_id`  | ChatMessage.tsx                  |
| `chat:restored`         | Previous session resumed | `chat_title`, `agent_id`, `session_id` | RecentChats.tsx                  |
| `chat:deleted`          | Chat session deleted     | `chat_title`, `agent_id`, `session_id` | RecentChats.tsx                  |

## Server-Side Events

| Event                 | Trigger            | Key Properties                             | File            |
| --------------------- | ------------------ | ------------------------------------------ | --------------- |
| `chat:user_message`   | User sends message | `agent_id`, `message_length`, `session_id` | route.ts (chat) |
| `chat:agent_response` | Agent responds     | `agent_id`, `has_tool_calls`, `tool_count` | route.ts (chat) |
| `adapter:search`      | Search operation   | `platform`, `result_count`, `latency_ms`   | tools/index.ts  |
| `adapter:get_item`    | Item fetch         | `platform`, `item_id`, `latency_ms`        | tools/index.ts  |

## Auth Webhooks (Clerk)

| Event           | Trigger         | Key Properties      | File                    |
| --------------- | --------------- | ------------------- | ----------------------- |
| `auth:sign_up`  | User created    | `user_id`, `method` | webhooks/clerk/route.ts |
| `auth:sign_in`  | Session created | `user_id`           | webhooks/clerk/route.ts |
| `auth:sign_out` | Session ended   | `user_id`           | webhooks/clerk/route.ts |

## Funnels

### 1. Auth Conversion Funnel

Tracks user progression from seeing the auth prompt to completing sign-up.

```
auth:prompt_shown → auth:sign_up_clicked → auth:sign_up
```

### 2. User Engagement Funnel

Tracks user interaction depth within a chat session.

```
chat:user_message → chat:agent_response → agent:tool_called → chat:link_clicked
```

### 3. Platform Usage Funnel

Tracks how users interact with auction platform data.

```
adapter:search → adapter:get_item → chat:link_clicked
```

## Event Property Details

### Common Properties

- `session_id`: Unique identifier for the chat session
- `agent_id`: The AI agent type (`curator` or `appraiser`)
- `source`: Origin of the event (`user`, `agent`, `header`, `agent_prompt`)

### Platform-Specific Properties

- `platform`: Auction platform identifier (e.g., `liveauctioneers`, `invaluable`)
- `item_id`: Unique identifier for an auction item
- `latency_ms`: Operation duration in milliseconds

### Auth Properties

- `user_id`: Clerk user identifier
- `method`: Authentication method used (e.g., `google`, `email`)

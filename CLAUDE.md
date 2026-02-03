## Tools

- _ONLY_ use pnpm. _NEVER_ use npm
- When finished with a coding task, always make a commit using the `/commit` skill

## Coding style

- First architect and design components intentionally before writing any code.
- TDD is critically important. Unit tests should come with every feature.
- Use SOLID, DRY principles.
- Spot good opportunities for design patterns.
- _ALWAYS_ use pure functions.
- When you cannot use pure functions, because you are dealing with stateful systems (libraries, network calls, files)
  - Create an interface to abstract away the stateful component.
  - Pass interfaces, return concrete implementations.

- Pull flow control up, push for loops down
  - If statements, case statements should be used at the highest levels of control flow
  - For loops should be pushed down into the deepest layers of the call stack.
  - This makes high level flow easier to follow for humans

- When you are designing code implementations, always propose your initial solution to me for review, and then use the AskUserQuestion tool to get feedback on any points of ambiguity.

## Logging

- ALL logging MUST use structured logging via `ILogger` interface
- Server: Use `serverLoggerFactory.create()` for request-scoped loggers
- Client: Use `useLogger()` hook from `LoggerProvider`
- NEVER use `console.log/warn/error` - use structured logger methods
- Log at system boundaries: external APIs, adapters, rate limiting, errors
- ALWAYS include `component` field to identify the emitting subsystem:
  - Use `component: "chat"` for chat routes
  - Use `component: "adapter:<name>"` for platform adapters
  - Use `component: "analytics"` for analytics tracking
  - Use `component: "middleware"` for HTTP access logs
  - Use `component: "rate-limiter"` for rate limiting
  - Use `component: "tools"` for tool execution
  - Use `component: "auth"` for authentication/Clerk webhooks

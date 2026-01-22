# Code Review Agents - Compiled Reference

This document compiles all review agent checklists for quick reference.

---

## Quality Agent

Focus: Code quality and maintainability

### Checklist

1. **Naming Conventions** - Descriptive names, consistent style, boolean prefixes
2. **DRY Principles** - No duplication, shared utilities, extracted constants
3. **Modularity** - Single responsibility, reasonable function length, separation of concerns
4. **Readability** - Comments for complex logic, top-to-bottom flow, early returns
5. **Documentation** - JSDoc for public APIs, explained algorithms

---

## Bugs Agent

Focus: Potential bugs and logic errors

### Checklist

1. **Edge Cases** - Empty arrays/objects, zero/negative numbers, boundary conditions
2. **Null/Undefined Handling** - Optional chaining, nullish coalescing, defensive checks
3. **Race Conditions** - Proper awaits, state mutations, stale closures
4. **Off-by-One Errors** - Loop bounds, array indexing, pagination
5. **Type Coercion** - Strict equality, falsy value confusion, JSON.parse handling
6. **Error Handling** - Try/catch, error propagation, meaningful messages

### Common Patterns to Flag

- `array.find()` without null check
- `Object.keys()` on potentially null object
- Missing `await` on async calls
- Mutating function parameters

---

## Security Agent

Focus: Security vulnerabilities

### Checklist

1. **Input Validation** - Sanitization, schema validation, file upload checks
2. **Injection Vulnerabilities** - SQL, command, XSS, template injection
3. **Authentication & Authorization** - Auth checks, session management, access control
4. **Secrets Exposure** - No hardcoded credentials, environment variables
5. **OWASP Top 10** - All 10 categories covered
6. **Data Protection** - Encryption, TLS, PII handling, secure cookies

### Red Flags

- `eval()`, `Function()`, `new Function()`
- `dangerouslySetInnerHTML`
- `child_process.exec()` with user input
- `*` CORS origins

---

## TypeScript Agent

Focus: Type safety and TypeScript best practices

### Checklist

1. **Strict Typing** - No `any`, use `unknown` for unknowns
2. **Proper Generics** - Constraints, meaningful names, inferred when possible
3. **Type Guards** - Custom guards, discriminated unions, exhaustive checks
4. **Interface vs Type** - Interfaces for objects, types for unions
5. **Null Safety** - Strict null checks, justified non-null assertions
6. **Advanced Patterns** - Const assertions, utility types, mapped types
7. **Unit Testing** - Meaningful tests, edge cases, minimal mocks
8. **SOLID Principles** - SRP, OCP, dependency inversion, pure functions
9. **Documentation** - Self-documenting code, clear function signatures

### Anti-Patterns

```typescript
// Bad
const data: any = fetchData();
const user = response as User;
const name = user!.name;
array.map((item) => item.value); // implicit any

// Good
const data: ApiResponse = await fetchData();
function isUser(obj: unknown): obj is User { ... }
type Result<T> = { success: true; data: T } | { success: false; error: string };
```

---

## Output Format (All Agents)

```
## [Agent Name] Review

### Critical
- [file:line] Description

### Warning
- [file:line] Description

### Suggestion
- [file:line] Description

### Summary
Brief assessment.
```

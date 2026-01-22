---
name: review
description: Comprehensive code review using specialized agents. Use when asked to "review code", "check my changes", "review this PR", or "review for bugs/security/quality".
metadata:
  author: adam
  version: "1.0.0"
  argument-hint: <files-or-git-diff>
---

# Code Review Skill

Comprehensive code review using 4 specialized agents running in parallel.

## When to Apply

Use this skill when:

- User asks to "review code" or "review my changes"
- User asks to "check this PR" or "review this PR"
- User wants bug detection, security review, or quality check
- User wants TypeScript best practices review
- Before merging code changes

## How It Works

1. **Get the diff to review**:
   - If user provides files: read those files
   - If user provides nothing: run `git diff --cached` for staged changes
   - If no staged changes: run `git diff` for unstaged changes

2. **Launch 4 review agents in parallel** using Task tool with these subagent types:
   - `compound-engineering:review:pattern-recognition-specialist` → Code quality
   - `compound-engineering:review:security-sentinel` → Security vulnerabilities
   - `compound-engineering:review:typescript-reviewer` → TypeScript best practices
   - `compound-engineering:review:code-simplicity-reviewer` → Bug detection and simplicity

   Each agent receives the diff and its specific review instructions from `agents/` subdirectory.

3. **Compile results** into unified report

## Task Agent Configuration

For each agent, use this Task tool pattern:

```yaml
- description: "Quality review"
  subagent_type: compound-engineering:review:pattern-recognition-specialist
  prompt: |
    Review these changes for code quality:
    <diff>
    [paste diff here]
    </diff>

    Follow the quality review checklist in agents/quality.md

- description: "Security review"
  subagent_type: compound-engineering:review:security-sentinel
  prompt: |
    Review these changes for security:
    <diff>
    [paste diff here]
    </diff>

    Follow the security review checklist in agents/security.md

- description: "TypeScript review"
  subagent_type: compound-engineering:review:typescript-reviewer
  prompt: |
    Review these changes for TypeScript best practices:
    <diff>
    [paste diff here]
    </diff>

    Follow the TypeScript review checklist in agents/typescript.md

- description: "Bug detection review"
  subagent_type: compound-engineering:review:code-simplicity-reviewer
  prompt: |
    Review these changes for potential bugs:
    <diff>
    [paste diff here]
    </diff>

    Follow the bug detection checklist in agents/bugs.md
```

## Output Format

```markdown
# Code Review Summary

## Quality

[findings from quality agent]

## Bugs

[findings from bugs agent]

## Security

[findings from security agent]

## TypeScript

[findings from typescript agent]

---

## Action Items

- [ ] Critical issues requiring immediate attention
- [ ] Warnings to address before merge
- [ ] Suggestions for improvement
```

## Example Usage

```bash
# Review staged changes
/review

# Review specific files
/review src/lib/agent/*.ts

# Review a PR diff
/review $(git diff main...HEAD)
```

## Agent Definitions

See `agents/` subdirectory for detailed review checklists:

- `agents/quality.md` - Code quality and maintainability
- `agents/bugs.md` - Bug detection and edge cases
- `agents/security.md` - Security vulnerabilities
- `agents/typescript.md` - TypeScript best practices

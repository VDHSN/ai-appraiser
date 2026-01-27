---
name: auction-proxy:commit
description: Commits changes to git. Optionally pushes. Knows how to create PRs
argument-hint: <extra instructions>
model: sonnet
---

Makes git commits using conventional commit style comments.

Additional user instructions below:
<user_instructions> #${ARGUMENTS} </user_instructions>

By default, commit everything in separate logical commits. - Review all untracked and modified files. - Commit them in groups based on the conversation history by default. Prefer user instructions

- Always check what branch we're on first
  - If on main, use the AskUserQuestion tool if the user wants to switch to a different branch
- Always do the commit command with a timeout of 10 seconds in case of a blocking verify check or signing.
  - If asked, create a PR using the github CLI tool.

---
name: auction-proxy:plan
description: Transform feature descriptions into well-structured project plans following conventions
description: Comprehensive feature planning
argument-hint: <feature/bug/task>
model: opus
---

# Create a plan for a new feature or bug fix

Your job is only to plan the feature, determine acceptance criteria and what needs to be tested.

_Do not write code or build anything_

Operate in a readonly capacity for now.

Your output is a comprehensive plan as a github issue.

When I have approved the plan, create a new Gthub Issue in this repository that contains the complete plan and research in a well structured description.

## Introduction

**Note: The current year is 2026.** Use this when dating plans and searching for recent documentation.

Transform feature descriptions, bug reports, or improvement ideas into well-structured markdown files issues that follow project conventions and best practices. This command provides flexible detail levels to match your needs.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

**If the feature description above is empty, ask the user:** "What would you like to plan? Please describe the feature, bug fix, or improvement you have in mind."

1. First use the AskUserQuestion tool to ask clarifying questions as needed to help me iterate the feature

2. Then explore the codebase, existing patterns and determine the best way to build this feature.

Run these three agents in parallel at the same time:

- Task best-practices-researcher(feature_description)
- Task framework-docs-researcher(feature_description)
- Task repo-research-analyst(feature_description)
- Task git-history-analyst(feature_description)

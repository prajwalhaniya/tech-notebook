---
sidebar_position: 0
---

# Node.js Best Practices: Overview

A field guide to building Node.js services that survive contact with production — covering structure, errors, style, testing, deployment, security, performance, and containers.

---

## Why This Guide Exists

Most Node.js tutorials show you how to make something work. They rarely show you how to make something that keeps working after the tenth engineer touches it, the traffic spikes 10x, or a dependency ships a vulnerability on a Friday afternoon.

This section distills the collective, battle-tested wisdom of the Node.js community — much of it adapted from the excellent open-source [**nodebestpractices**](https://github.com/goldbergyoni/nodebestpractices) project by Yoni Goldberg and contributors (licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)) — reorganized and rewritten to match the rest of this notebook's style, with additional context and examples.

## How This Section Is Organized

| # | Topic | What You'll Learn |
|---|-------|--------------------|
| 1 | [Project Structure](./project-structure) | Laying out folders, components, and layers so the codebase scales past a handful of files |
| 2 | [Error Handling](./error-handling) | Operational vs. programmer errors, async error handling, centralized handlers, crash recovery |
| 3 | [Code Style](./code-style) | Linting, formatting, and conventions that keep a codebase legible across a team |
| 4 | [Testing & Quality](./testing-and-quality) | Naming, structuring, and isolating tests so they catch bugs instead of hiding them |
| 5 | [Going to Production](./going-to-production) | Statelessness, logging, monitoring, process management, and deployment hygiene |
| 6 | [Security](./security) | The OWASP-aligned checklist for Node.js and Express applications |
| 7 | [Performance](./performance) | Avoiding the event-loop traps that quietly degrade throughput |
| 8 | [Docker for Node.js](./docker) | Building small, fast, secure container images for Node.js workloads |

## How to Use This Guide

Each page is self-contained and follows the same shape:

- A short table of contents
- Practices grouped by theme, each with **why it matters** and **how to do it**
- ✅ **Do** / ❌ **Avoid** code examples where a concrete pattern helps more than prose
- Pointers to tools and libraries that implement the practice for you

None of these are laws — they're defaults. Deviate when you have a specific reason, and document why when you do.

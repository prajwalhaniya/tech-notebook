---
sidebar_position: 8
---

# Docker for Node.js

Building small, secure, cache-friendly, and signal-aware Docker images for Node.js services.

---

## Table of Contents

1. [Building Efficient Images](#building-efficient-images)
2. [A Complete Production Dockerfile](#a-complete-production-dockerfile)
3. [Security](#security)
4. [Runtime Configuration](#runtime-configuration)
5. [Operational Concerns](#operational-concerns)
6. [General Tips](#general-tips)
7. [Further Reading](#further-reading)

---

## Building Efficient Images

### Use Multi-Stage Builds

**Multi-stage build:** a Dockerfile with more than one `FROM` instruction, where each stage can selectively copy artifacts from a previous stage. This separates build-time concerns (compilers, dev dependencies, TypeScript CLI, source maps) from what actually needs to ship at runtime.

Build the app in a fully-featured stage, then copy only the compiled output and production dependencies into a slim final stage. Anything not copied forward — devDependencies, build tools, source files — never reaches the shipped image, shrinking size and attack surface.

```dockerfile
# ---- Build stage ----
FROM node:20 AS build
USER node
WORKDIR /home/node/app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine
USER node
WORKDIR /home/node/app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node --from=build /home/node/app/dist ./dist

CMD ["node", "dist/app.js"]
```

### Prefer Smaller Base Images

Large base images mean more OS packages, more CVEs, and slower pulls at scale. `node:20` (Debian-based, full) is roughly 10x larger than `node:20-alpine`. Alpine images strip out anything not essential to running Node, which shrinks both the size and the number of exploitable binaries.

**Trade-off:** Alpine uses `musl` instead of `glibc`, which occasionally breaks native modules that expect `glibc`. If that happens, `node:20-slim` (Debian-based but minimal) is a solid middle ground — small, `glibc`-compatible, but still far leaner than the full image.

### Leverage the Build Cache

Docker builds a layer per instruction and reuses cached layers across builds when the instruction and its inputs are unchanged. **One invalidated layer invalidates every layer after it** — so ordering matters:

1. Put instructions that rarely change (installing OS packages, `npm ci`) near the top.
2. Put instructions that change on every commit (`COPY . .`, application code) near the bottom.
3. Copy only `package.json` and the lockfile before running install, so dependency installation stays cached even when application code changes:

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
```

✅ **Do** install OS-level build tools (gcc, make, build-base) as an early, rarely-changing layer.
❌ **Avoid** a `LABEL` with a build number or timestamp near the top of the Dockerfile — any layer after it (including your entire dependency install) is invalidated on every single build.

### Use .dockerignore

A `docker build` sends the entire build context to the daemon, and an unqualified `COPY . .` pulls all of it into the image. Without a `.dockerignore`, that context frequently includes `.git`, `node_modules`, test reports, IDE config, and — critically — secrets like `.env`, `.npmrc`, and `.aws`. A `.dockerignore` file is the last safety net that filters these out, and as a side effect improves cache hits by excluding files that change often but have no runtime relevance.

```
# .dockerignore
**/node_modules/
**/.git
**/README.md
**/LICENSE
**/.vscode
**/npm-debug.log
**/coverage
**/.env
**/.editorconfig
**/.aws
**/dist
```

❌ **Avoid** a bare `COPY . .` with no `.dockerignore` in place — it silently ships whatever happens to sit in the build directory, secrets included.

### Clean the Package Manager Cache

npm and Yarn cache downloaded packages locally to speed up future installs. That cache is pure waste inside an image that is built once and never reinstalls — deleting it after install shaves tens of MB off the layer:

```dockerfile
RUN npm ci --omit=dev && npm cache clean --force
```

This step is unnecessary when using a multi-stage build, as long as no new packages are installed in the final stage — the cache never makes it into the shipped layer at all.

---

## A Complete Production Dockerfile

Putting the practices above together — multi-stage build, small base image, cached layer ordering, non-root user, `tini` as PID 1 for correct signal handling, and a `HEALTHCHECK`:

```dockerfile
# syntax=docker/dockerfile:1

# ---- Build stage: compile with full toolchain ----
FROM node:20-alpine AS build
WORKDIR /home/node/app

# Install OS build tools first (rarely changes, stays cached)
RUN apk add --no-cache python3 make g++

USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npm run build

# ---- Runtime stage: minimal, production-only ----
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /home/node/app

# tini forwards signals (SIGTERM) to Node correctly and reaps zombies;
# use `--init` at `docker run` time instead if your runtime supports it.
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node --from=build /home/node/app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Node as the direct entrypoint argument — no shell, no npm wrapper
CMD ["node", "dist/app.js"]
```

Relies on a `.dockerignore` (shown above) to keep `node_modules`, `.git`, `.env`, and other local cruft out of the build context entirely.

---

## Security

### Avoid Build-Time Secrets

Every instruction in a Dockerfile creates a layer, and Docker images are essentially an audit trail of those layers. A common but dangerous pattern is passing a private registry token as a build `ARG` (e.g. `NPM_TOKEN`) — even if the token is deleted within the same `RUN` step, it can still be recovered from the image history, the local Docker daemon's dangling layers, or a pushed registry.

Two safer alternatives:

**BuildKit secret mounts (preferred):** the secret is mounted into the build only for the duration of one `RUN` instruction and never persists in any layer.

```dockerfile
# syntax = docker/dockerfile:1.0-experimental
FROM node:20-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npm,target=/root/.npmrc npm ci
```

**Multi-stage build with args:** the secret still appears in the *build* stage's history, but never in the final shipped image, since only compiled output is copied forward.

```dockerfile
FROM node:20-alpine AS build
ARG NPM_TOKEN
WORKDIR /usr/src/app
COPY . .
RUN echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc && \
    npm ci --omit=dev && rm -f .npmrc

FROM build AS prod
COPY --from=build /usr/src/app /usr/src/app
CMD ["node", "index.js"]
```

❌ **Avoid** passing tokens as plain `ARG`s in a single-stage build and simply deleting the file afterward — deletion in a later layer does not remove it from earlier layers in the image history.

### Remove Development Dependencies

`devDependencies` inflate both image size and attack surface — several notable npm supply-chain compromises (`eslint-scope`, the `event-stream` backdoor) originated in packages that were only ever needed for building or testing, not running, the app. Install with `npm ci --omit=dev` (or `npm ci` followed by `npm prune --production` in a later stage) so only runtime-necessary packages ship:

```dockerfile
FROM node:20-alpine AS build
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node src ./src
RUN npm run build

FROM node:20-alpine
COPY --chown=node:node --from=build package.json package-lock.json ./
COPY --chown=node:node --from=build node_modules ./node_modules
COPY --chown=node:node --from=build dist ./dist
RUN npm prune --production
CMD ["node", "dist/app.js"]
```

`npm ci` is preferable to `npm install` in CI/build contexts: it requires a lockfile, always performs a clean install, and fails fast on any inconsistency between `package.json` and the lockfile.

### Scan the Final Image

Scanning application source code for vulnerable dependencies is necessary but not sufficient — vulnerabilities also live at the OS layer (shell, OpenSSL, tarball utilities), and dependencies can be swapped after the source scan ran (a supply-chain attack). Scan the assembled image itself as a final gate before it reaches production, similar in spirit to running E2E tests after unit tests.

```bash
trivy image my-org/my-node-app:1.4.2
```

Tools worth evaluating: [Trivy](https://github.com/aquasecurity/trivy), [Anchore](https://github.com/anchore/anchore), and [Snyk](https://snyk.io/). These scanners surface findings in nearly every scan, so set a meaningful severity threshold rather than blocking on every low-severity result.

### Lint the Dockerfile

Just as application code is linted, Dockerfiles benefit from static analysis that catches structural mistakes early — copying from a nonexistent stage, pulling `FROM` an untrusted registry, running as root, and similar issues. [Hadolint](https://github.com/hadolint/hadolint) is the standard tool for this and encodes Docker's own [best practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/).

```bash
hadolint production.Dockerfile
hadolint --ignore DL3003 --ignore DL3006 Dockerfile   # exclude specific rules
hadolint --trusted-registry my-company.com:5000 Dockerfile
```

Wire this into CI so a bad Dockerfile fails the build the same way a bad lint on application code would.

---

## Runtime Configuration

### Bootstrap Using Node, Not npm

Starting the container with `CMD ["npm", "start"]` inserts an extra process (npm) between Docker and the actual Node process. npm does not forward OS signals like `SIGTERM` to the child it spawns, which silently breaks [graceful shutdown](#shutdown-gracefully) and leaves orphaned child processes on unexpected termination. It also adds a process for no runtime benefit.

```dockerfile
# ✅ Node runs as PID 1, receives signals directly
CMD ["node", "server.js"]
```

❌ **Avoid:**

```dockerfile
CMD "npm start"
```

❌ **Also avoid** a single quoted command string, which spawns an extra shell process to interpret it:

```dockerfile
CMD "node server.js"   # spawns sh -c "node server.js"
```

The exec-form array (`["node", "server.js"]`) runs Node directly with no intermediate shell or npm process.

### Shutdown Gracefully

Orchestrators like Kubernetes routinely kill and recreate containers — not just on crashes, but for rolling deploys, rescheduling, and scaling events. The mechanism is a `SIGTERM` with a grace period (30 seconds by default) before a hard `SIGKILL`. The application must use that window to stop accepting new work, finish in-flight requests, close connections cleanly, and exit — otherwise requests are dropped mid-flight.

For this to work, Node must actually receive the signal. Running Node as **PID 1** (the container's root process) delivers signals directly:

```dockerfile
FROM node:20-alpine
# ...
CMD ["node", "index.js"]
# Node is PID 1 and receives SIGTERM directly
```

If the app spawns child processes, a minimal init process is safer — PID 1 has special kernel responsibilities (reaping zombies, correctly forwarding signals) that Node itself doesn't handle. Use `tini`:

```dockerfile
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
```

❌ **Avoid** `CMD ["npm", "start"]` here for the same reason as above — it prevents `SIGTERM` from ever reaching the Node process.

A library like [stoppable](https://github.com/hunterloftis/stoppable) helps close keep-alive connections cleanly as part of the shutdown sequence.

### Set Memory Limits — Both Docker and V8

A memory limit caps how much a container may consume before it's OOM-killed, which keeps one noisy process from starving its neighbors and lets the orchestrator schedule containers onto nodes with sufficient headroom. Two limits are needed together, not just one:

- **Docker/Kubernetes limit:** the hard ceiling the orchestrator enforces and schedules around.
- **V8's `--max-old-space-size`:** tells V8's garbage collector where its own heap ceiling is.

Without the V8 flag, the GC doesn't know to work harder as it approaches the container's limit, and the process can crash while using only 50–60% of the *host's* memory. Set V8's limit to roughly 75–100% of the Docker limit.

```yaml
resources:
  requests:
    memory: "400Mi"
  limits:
    memory: "500Mi"
command: ["node", "index.js", "--max-old-space-size=350"]
```

```bash
docker run --memory 512m my-node-app
```

### Let the Orchestrator Restart and Replicate Processes

Tools like the Node `cluster` module or PM2 can restart a crashed process or fork workers for CPU utilization, but they only see the single host — they have no visibility into zone layout, other nodes' capacity, or cluster-wide failure domains. An orchestrator like Kubernetes does: it can spread replicas across zones so a zonal outage doesn't take the whole service down, and it can relocate a failing container to healthier hardware. Restarting locally hides failures from the layer best equipped to react to them.

```dockerfile
# ✅ Let Kubernetes/Docker manage restarts
CMD ["node", "index.js"]
```

❌ **Avoid** wrapping the entrypoint in a local process manager purely for restart/replication duty:

```dockerfile
CMD ["pm2-runtime", "index.js"]
```

(A process manager inside the container is still reasonable for other needs, such as log aggregation — the point is not to rely on it as the sole restart mechanism in an orchestrated environment.)

### Understand Tags vs Digests — Use `:latest` with Caution

`:latest` is Docker's default tag, which makes it easy to push a new build to `latest` by accident (simply omitting `-t` on `docker build` or `docker push` does it):

```bash
docker build -t company/image_name:0.1 .      # :latest unaffected
docker build -t company/image_name .          # :latest updated!
docker build -t company/image_name:latest .   # :latest updated!
```

`:latest` does **not** mean "the most recently pushed image" — it's just a mutable tag like any other. For production, pin explicit, immutable versions (a semver tag, or better, an image digest) so deployments are reproducible and rollbacks are unambiguous.

---

## Operational Concerns

### Avoid Build-Time Secrets in Args, Redux — and General Layer Hygiene

Beyond secrets specifically, treat every `ARG`, `ENV`, and `COPY` as something that becomes part of the permanent image history. Prefer `COPY` over `ADD` (see [General Tips](#general-tips)) and keep build-only tooling confined to a stage that never reaches the runtime image.

### Classify Images Using Labels

Attach metadata — maintainer, build date, git commit, version — via `LABEL` so operators can reason about a running image without cross-referencing a separate system. Place labels that change every build (build number, timestamp) as late as possible in the Dockerfile so they don't defeat the [build cache](#leverage-the-build-cache).

```dockerfile
LABEL org.opencontainers.image.authors="platform-team@example.com" \
      org.opencontainers.image.source="https://github.com/org/repo" \
      org.opencontainers.image.revision="$GIT_SHA"
```

### Inspect and Verify the Final Result

It's easy to overlook a leaked secret or an unnecessary file baked into a layer. Tools like [Dive](https://github.com/wagoodman/dive) let you inspect an image layer-by-layer to confirm the final artifact contains exactly what's expected and nothing more — a useful complement to automated scanning.

### Perform Integrity Checks

Nothing in the standard Docker pull protocol guarantees the image you fetched is the one that was published — network-level attacks can redirect a pull to a malicious image unless content is signed and verified. [Docker Content Trust / Notary](https://docs.docker.com/notary/getting_started/) enables signing and verification of image content for both base and final images.

---

## General Tips

These apply to Docker images generally and aren't Node-specific, but round out a production-ready Node.js image:

**Prefer `COPY` over `ADD`:** `COPY` only copies local files with predictable behavior; `ADD` also auto-extracts archives and fetches remote URLs, which is more capability than most Dockerfiles need and expands the attack surface.

**Avoid updating the base OS at build time:** Running `apt-get update`/`upgrade` during the build produces a different image every time it's run and typically requires elevated privileges. Rely on official base images that are rebuilt and updated upstream instead.

**Use unprivileged containers:** A privileged container has root-equivalent access to the host. Node's official images ship a built-in `node` user for exactly this reason — use `USER node` rather than running as root.

---

## Further Reading

This document adapts and summarizes practices from the [node-best-practices](https://github.com/goldbergyoni/nodebestpractices) open-source guide (CC BY-SA 4.0), specifically its Docker section — see the source repository for additional detail, blog references, and community discussion.

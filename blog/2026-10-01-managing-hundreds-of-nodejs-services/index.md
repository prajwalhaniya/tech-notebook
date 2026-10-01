---
slug: managing-hundreds-of-nodejs-composition-services
title: How to Manage Hundreds of Node.js Composition-Layer Services Across Many Clients
authors: prajwal
tags: [nodejs, architecture, platform-engineering, multi-tenant, enterprise]
---

A product that onboards many enterprise clients eventually hits a fork in the road. Each client needs its own integrations, its own workflow quirks, its own compliance requirements layered on top of the same core product. The easy path is: spin up a new Node.js composition service per client — a BFF that talks to the shared core services and shapes the experience for that one account. It works great for the first ten clients. By client fifty, you don't have an architecture anymore — you have two hundred slightly-different copies of the same code, and nobody can tell you which copies are actually different and why.

This is a fleet-management problem, and it has a concrete answer: one monorepo, one framework, one pipeline, one deployment mechanism — and every client reduced to a config object. Below is the actual repo layout and tool stack that gets you there.

<!-- truncate -->

## Name the actual problem

"Hundreds of services" is not the problem. Plenty of large orgs run thousands of services fine. The problem is specifically: hundreds of services that are *supposed to be nearly identical* (same product, same core integrations, same composition patterns) but drifted into being independently maintained, because each one started life as a copy-pasted scaffold for one client and nobody owns the delta between them.

The symptoms are predictable: a security fix applied to twelve services and forgotten in the other hundred and eighty; a new client onboarding taking three weeks because engineers are hand-building a new service instead of configuring an existing pattern; on-call engineers who've genuinely never seen eighty of these services before and have no idea what's different about the one that just paged.

The fix: stop treating "one client, one bespoke codebase" as the default, and build the fleet so that what makes a client's composition layer unique is *data in one repo*, not *code in two hundred repos*.

## The repo layout

Two hundred independent git repos is the single biggest mistake to avoid — it makes every cross-cutting change (framework upgrade, CI fix, security patch) a two-hundred-PR campaign by construction. Put the framework, every client's config, and the deploy manifests in **one monorepo**, managed with **Nx** (Turborepo is a reasonable alternative; Nx's generators and project graph matter more at this scale):

```
composition-platform/
├── apps/
│   └── composition-service/          # the one deployable app, templated
│       ├── src/
│       │   ├── main.ts               # bootstraps createCompositionService
│       │   └── workflows/            # workflow logic shared across clients
│       └── project.json
├── packages/
│   ├── composition-framework/        # @internal/composition-framework
│   │   ├── src/
│   │   │   ├── create-app.ts
│   │   │   ├── config-schema.ts      # Zod schema every client config must satisfy
│   │   │   ├── telemetry.ts
│   │   │   ├── circuit-breaker.ts
│   │   │   └── tenant-context.ts     # AsyncLocalStorage
│   │   └── project.json
│   └── upstream-clients/             # typed clients for inventory, payments, etc.
├── clients/
│   ├── acme-corp/
│   │   ├── config.ts                 # satisfies ClientConfigSchema
│   │   ├── workflows.ts              # client-specific overrides only
│   │   └── helm-values.yaml
│   ├── globex/
│   │   ├── config.ts
│   │   └── helm-values.yaml
│   └── _template/                    # what `nx g client` scaffolds from
├── deploy/
│   ├── charts/composition-service/   # one Helm chart, parameterized
│   └── argocd/
│       └── applicationset.yaml       # generates one Application per client
├── tools/
│   └── generators/
│       └── client/                   # Nx generator: `nx g client acme-corp`
├── nx.json
├── pnpm-workspace.yaml
└── renovate.json
```

The rule this enforces structurally: **`apps/composition-service` has exactly one copy of the actual application**. `clients/*` holds only data and the rare client-specific workflow override. There is no `apps/acme-corp-service`, `apps/globex-service` — if that pattern starts appearing, the abstraction has leaked and someone reached for a fork instead of a config entry.

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

pnpm workspaces for install speed and strict dependency hoisting (it won't silently let one package depend on another's undeclared transitive dependency, which matters once dozens of client configs depend on the framework package). Nx layers the task graph, caching, and **affected-only** builds on top.

## The shared framework package

Everything common — tracing, health checks, graceful shutdown, structured logging, circuit breakers, auth, the standard error shape — lives in `packages/composition-framework`, written once:

```ts
// packages/composition-framework/src/create-app.ts
import Fastify from 'fastify';
import { ClientConfigSchema, ClientConfig } from './config-schema';
import { registerTelemetry } from './telemetry';
import { registerCircuitBreakers } from './circuit-breaker';
import { tenantContext } from './tenant-context';

export function createCompositionService(rawConfig: unknown) {
  const config: ClientConfig = ClientConfigSchema.parse(rawConfig);
  const app = Fastify({ logger: true });

  registerTelemetry(app, config);
  registerCircuitBreakers(app, config.upstreams);

  app.addHook('onRequest', (req, _res, done) => {
    tenantContext.run({ clientId: config.clientId }, done);
  });

  app.get('/healthz', async () => ({ status: 'ok' }));
  return app;
}
```

```ts
// apps/composition-service/src/main.ts
import { createCompositionService } from '@internal/composition-framework';
import { config } from '@clients/acme-corp/config';

const app = createCompositionService(config);
app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
```

Each client's deployed artifact is the *same* `apps/composition-service` build, pointed at a different config module via a build-time alias or an environment variable resolved at startup. One app, one Dockerfile, N configs.

## Config as a validated contract, not a convention

The single thing standing between "configs" and "two hundred slightly-different apps again" is a schema every client config is forced through:

```ts
// packages/composition-framework/src/config-schema.ts
import { z } from 'zod';

export const ClientConfigSchema = z.object({
  clientId: z.string(),
  upstreams: z.record(z.object({
    url: z.string().url(),
    breaker: z.object({ timeout: z.number().max(5000) }),
  })),
  featureFlags: z.array(z.string()).default([]),
  workflowOverrides: z.array(z.string()).optional(),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;
```

```ts
// clients/acme-corp/config.ts
import { ClientConfig } from '@internal/composition-framework';

export const config: ClientConfig = {
  clientId: 'acme-corp',
  upstreams: {
    inventory: { url: process.env.ACME_INVENTORY_URL!, breaker: { timeout: 800 } },
    payments: { url: process.env.ACME_PAYMENTS_URL!, breaker: { timeout: 1500 } },
  },
  featureFlags: ['early-fraud-check'],
};
```

A new client PR touches exactly `clients/<name>/`. CI validates it against the schema before anything deploys — a malformed config fails the build, not a 3am page.

## Scaffold new clients with an Nx generator, not copy-paste

```bash
nx g @internal/generators:client --name=globex --template=standard-b2b
```

```ts
// tools/generators/client/index.ts
import { Tree, generateFiles, joinPathFragments } from '@nx/devkit';

export default async function clientGenerator(tree: Tree, opts: { name: string; template: string }) {
  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files', opts.template),
    `clients/${opts.name}`,
    { clientId: opts.name },
  );
}
```

This generates `clients/globex/config.ts` from a template, wires the Helm values file, and opens a PR — minutes of generation plus a focused human review of the client-specific 10%, not a from-scratch build an engineer will inevitably diverge from the pattern on.

## CI/CD: affected-only, one pipeline, templated per client

With everything in one Nx monorepo, CI doesn't need to guess what changed — `nx affected` computes it from the project graph:

```yaml
# .github/workflows/ci.yml
jobs:
  affected:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm nx affected -t lint test build --base=origin/main
```

A PR touching only `clients/acme-corp/config.ts` triggers a build scoped to that client. A PR bumping `packages/composition-framework` triggers builds and tests for every client that depends on it — caught in CI, not discovered as two hundred separate production incidents.

Deployment, separately, fans out across the fleet from a single reusable workflow:

```yaml
jobs:
  deploy:
    strategy:
      matrix:
        client: ${{ fromJson(needs.list-clients.outputs.names) }}
    uses: ./.github/workflows/deploy-client.yml
    with:
      client: ${{ matrix.client }}
```

`list-clients` reads the `clients/*` directory (or the service catalog) directly — the source of truth is the repo, not a maintained list that drifts from it.

## Deployment: one Helm chart, ArgoCD ApplicationSet per client

A single parameterized Helm chart in `deploy/charts/composition-service`, with each client contributing only its `values.yaml`:

```yaml
# clients/acme-corp/helm-values.yaml
clientId: acme-corp
image:
  tag: "{{ .GitSha }}"
env:
  ACME_INVENTORY_URL: https://inventory.internal/acme
resources:
  requests: { cpu: 100m, memory: 128Mi }
```

ArgoCD's `ApplicationSet` with a **git generator** watches `clients/*` and materializes one `Application` per directory automatically — adding a client directory *is* onboarding its deployment, no manually-written Application manifest per client:

```yaml
# deploy/argocd/applicationset.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: composition-services
spec:
  generators:
    - git:
        repoURL: https://github.com/org/composition-platform
        directories:
          - path: clients/*
  template:
    metadata:
      name: 'composition-{{path.basename}}'
    spec:
      source:
        repoURL: https://github.com/org/composition-platform
        path: deploy/charts/composition-service
        helm:
          valueFiles: ['{{path}}/helm-values.yaml']
      destination:
        namespace: 'client-{{path.basename}}'
```

Two hundred clients, zero hand-written deployment manifests, one chart to fix when the deployment pattern needs to change.

## Service catalog: Backstage, generated from the repo

Hand-maintained wikis rot. Generate `catalog-info.yaml` per client directly from its config at scaffold time, and let **Backstage** index the repo:

```yaml
# clients/acme-corp/catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: composition-acme-corp
  annotations:
    github.com/project-slug: org/composition-platform
spec:
  type: service
  owner: team-platform
  system: composition-layer
  dependsOn: ['resource:inventory-service', 'resource:payments-service']
```

Backstage auto-discovers every `catalog-info.yaml` in the monorepo. "Which services are still on framework < 4.2" or "who owns the service that just paged" becomes a catalog query, not archaeology — because the catalog entries are generated artifacts of the same repo, not a separately maintained source of truth that falls out of sync.

## Observability: OpenTelemetry → Prometheus/Grafana, one dashboard templated by label

Instrumentation lives in the framework package, so every client's service emits identically-named metrics with `client` as a label — not three hundred separately hand-wired dashboards:

```ts
// packages/composition-framework/src/telemetry.ts
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('composition-service');
export const httpDuration = meter.createHistogram('http_request_duration_ms');
export const upstreamErrors = meter.createCounter('upstream_call_errors_total');
```

```ts
httpDuration.record(durationMs, { client: config.clientId, route, status });
upstreamErrors.add(1, { client: config.clientId, upstream: 'payments' });
```

One Grafana dashboard, variable-templated on `client`, covers all two hundred services. One Prometheus alert rule — p99 latency, error rate — fires per-client via label matching, not two hundred copy-pasted rule files. An OpenTelemetry Collector sidecar or DaemonSet handles export to whichever backend (Grafana Cloud, Datadog, Tempo for traces) without the application code caring.

## Dependency and security upgrades: Renovate, grouped and automated

```json
// renovate.json
{
  "extends": ["config:recommended"],
  "packageRules": [
    {
      "matchPackageNames": ["@internal/composition-framework"],
      "groupName": "composition framework",
      "schedule": ["before 6am on monday"]
    },
    {
      "matchDepTypes": ["dependencies"],
      "matchUpdateTypes": ["patch"],
      "automerge": true
    }
  ]
}
```

Because it's one monorepo, Renovate opens **one PR** that bumps the framework version and runs `nx affected` across every client that depends on it — not two hundred independent PRs across two hundred repos, most of which nobody will review promptly. A CVE fix ships to the whole fleet the same day it's merged.

## Decide deliberately when a client earns a dedicated deployment

Everything above assumes most clients share the deployed `apps/composition-service` artifact with per-client config, which is the right default. Reach for a genuinely separate deployment (still from the same monorepo, same chart) only when there's a real forcing function: a client with materially different scaling needs, a compliance requirement for physical isolation, or workflow logic divergent enough that a shared codepath would need unreadable conditionals. Note this is a *deployment* decision (one Helm release vs. another, one namespace vs. another), not a *codebase* decision — the monorepo, framework, and pipeline stay identical either way. That's what keeps "client fifty needs dedicated infra" from turning back into "client fifty needs a forked codebase."

## What this actually buys you

The concrete stack: **pnpm + Nx** for the monorepo and affected-only builds, a single Fastify-based framework package owning all cross-cutting concerns, **Zod**-validated per-client config as the only thing that varies, an **Nx generator** for onboarding instead of copy-paste, one GitHub Actions workflow matrixed across clients, **Helm + ArgoCD ApplicationSet** turning a new client directory directly into a deployment, **Backstage** generating the service catalog from the same repo instead of a wiki, **OpenTelemetry → Prometheus/Grafana** with client as a metric label instead of per-service dashboards, and **Renovate** doing fleet-wide dependency bumps as one PR instead of two hundred.

The payoff compounds with fleet size. At ten services none of this feels necessary. At two hundred, it's the entire difference between a platform team that ships a security fix fleet-wide before lunch, and one that spends a quarter chasing down which of two hundred repos still has the vulnerability. The scale problem was never really about Node.js — it's whether the fleet was built as one system with two hundred configs, or allowed to become two hundred systems that happen to be written in the same language.

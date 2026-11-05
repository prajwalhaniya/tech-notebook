---
sidebar_position: 8
---

# Design Enterprise Authentication System

A comprehensive high-level design for building a scalable, multi-tenant, enterprise-grade authentication and authorization platform supporting password login, MFA, enterprise SSO federation (SAML2/OIDC), and machine-to-machine access.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Functional Requirements](#functional-requirements)
3. [Non-Functional Requirements](#non-functional-requirements)
4. [Capacity Estimation](#capacity-estimation)
5. [System APIs](#system-apis)
6. [Database Design](#database-design)
7. [High-Level Architecture](#high-level-architecture)
8. [Core Components](#core-components)
9. [Key Flows](#key-flows)
10. [Security & Compliance](#security--compliance)
11. [Scalability & Performance](#scalability--performance)
12. [Trade-offs & Summary](#trade-offs--summary)

---

## Problem Statement

Design an authentication and authorization platform that a SaaS company can put in front of every product surface — web app, mobile app, public API, internal admin tools — and in front of every kind of enterprise customer, without rebuilding the system per customer.

Unlike a single-tenant login system, an enterprise auth platform has to satisfy three audiences at once:

- **End users** who just want to log in with a password, or increasingly, via MFA/passkey.
- **Enterprise buyers** who will not move their workforce identity to a vendor's platform — they expect to federate via their own Okta, Azure AD, Ping, or Google Workspace tenant, enforce their own MFA policy, and deprovision employees centrally when they leave.
- **Machine clients** — internal services and third-party integrations — that need scoped, short-lived credentials instead of a human login flow.

### Key Challenges

- Supporting per-tenant identity federation (SAML2, OIDC) without forking the login flow per customer.
- Keeping token validation fast enough to sit on the hot path of every downstream API call.
- Making token/session revocation actually work ("logout everywhere," breach response) without making every request stateful.
- Meeting compliance obligations (SOC2, GDPR, sometimes HIPAA) with an auditable, tamper-evident trail.
- Rotating signing keys and credentials without breaking in-flight sessions.
- Scaling login traffic that is extremely bursty (Monday-morning logins, bulk SSO sync, incident-driven mass logout).

---

## Functional Requirements

### Core Features

- Email/password registration and login with Argon2id-hashed credentials.
- Multi-factor authentication: TOTP, WebAuthn/FIDO2 (passkeys), SMS as a fallback channel.
- Enterprise SSO via SAML 2.0 and OIDC, configured per tenant.
- Just-in-time (JIT) user provisioning on first SSO login, with attribute mapping (name, email, group → role).
- OAuth2 authorization code flow (user-delegated access) and client credentials flow (service-to-service).
- Short-lived access tokens (JWT) and long-lived, rotating, revocable refresh tokens.
- Session management: list active sessions, revoke a single session, revoke all sessions ("logout everywhere").
- Role-based and attribute-based authorization (RBAC/ABAC) evaluated centrally.
- Account recovery (password reset, backup MFA codes) with rate-limited, auditable flows.
- Tenant and IdP configuration management (admin console for enterprise customers to self-serve SSO setup).

### Optional Features

- Adaptive/step-up authentication (require MFA re-challenge for sensitive actions).
- Device fingerprinting and anomaly-based risk scoring.
- Delegated admin impersonation for support, fully audited.
- Breached-password checking at registration/reset time.
- SCIM-based user provisioning/deprovisioning (in addition to JIT).

---

## Non-Functional Requirements

### Performance

- Token validation: p99 < 20ms (local signature verification, no network hop).
- Login (password + MFA): p99 < 800ms end to end, including downstream IdP round-trip for SSO.
- JWKS key lookup: served from in-memory cache, refreshed on key-id cache miss, not on every request.

### Scalability

- Support 10,000+ enterprise tenants and 50M+ end users.
- Handle login storms (e.g., 10x normal traffic within a 15-minute window) without degrading token validation for already-authenticated traffic.
- Horizontally scale the Auth Service, Token Service, and API Gateway independently of the stateful Session Store.

### Reliability

- 99.99% availability for token issuance and validation — this is a single point of failure for the entire platform if it goes down.
- Graceful degradation: if the Authorization Service is unreachable, fall back to the roles/scopes embedded in the access token rather than failing every request closed.
- No single region/AZ failure should take down authentication platform-wide.

### Security & Compliance

- SOC2 Type II control coverage: access review, audit logging, key management.
- GDPR: right to erasure, data portability, and purpose-limited data retention.
- Signing keys stored in KMS/HSM, never in application config or source control.
- All credentials hashed (Argon2id) or encrypted at rest; nothing sensitive logged in plaintext.

### Data Retention

- Audit logs retained for a minimum of 1 year (longer per customer compliance contract, often 7 years for financial-services tenants).
- Session/refresh token records purged on expiry or explicit revocation.
- User data erasure requests processed within the GDPR-mandated window, cascading across Identity Directory, Audit Log (pseudonymized, not deleted, where legally required), and Session Store.

---

## Capacity Estimation

### Traffic Estimates

**Assumptions:**
- 10,000 enterprise tenants, 50 million total end users.
- Average daily active users: 15 million.
- Average 1.3 logins per active user per day (SSO sessions are long-lived, reducing repeat logins).

**Login Traffic:**
- 15M DAU * 1.3 logins/day = ~19.5M logins/day = ~226 logins/second average (peak: 2,260 rps @ 10x for Monday-morning storms).

**Token Validation Traffic:**
- Every downstream API call validates a token. Assume 50 downstream calls per user session per day.
- 15M DAU * 50 calls = 750M token validations/day = ~8,680 validations/second average (peak: ~26,000 rps @ 3x).
- This is the dominant traffic pattern and the reason token validation must be stateless and locally verifiable.

**Token Refresh Traffic:**
- Access tokens expire every 10 minutes; active sessions refresh roughly every 10 minutes during a workday (~8 active hours).
- 15M DAU * 48 refreshes/day (8 hrs * 6/hr) = 720M refreshes/day = ~8,330 rps average.

**Total Platform Load: ~17,000 rps average, ~45,000 rps peak.**

### Storage Estimates

**Identity Directory:**
- 50M users * 2KB avg (profile + credentials metadata) = 100GB.
- 10,000 tenants * 5KB avg (IdP config, policy) = 50MB.

**Session / Refresh Token Store (Redis):**
- 15M concurrent sessions * 500 bytes (hashed refresh token + metadata) = 7.5GB in-memory, replicated across a Redis cluster.

**Audit Log:**
- 750M token validations/day are sampled/aggregated, not logged individually; but every auth decision (login, MFA challenge, token issuance, revocation, admin action) is logged: ~40M events/day * 1KB = 40GB/day.
- 40GB/day * 365 days * 3 years (hot + warm retention; older moves to cold storage) = ~44TB hot/warm, with cold archive beyond that for compliance-mandated tenants.

**Total Storage: ~50TB actively served, scaling into the hundreds of TB with cold audit archive.**

### Bandwidth

**Ingress:**
- 17,000 rps avg * 2KB avg request = 34MB/s = ~272 Mbps average (peak: ~720 Mbps).

**Egress:**
- Token responses: 17,000 rps * 3KB (JWT + metadata) = 51MB/s = ~408 Mbps average.
- SSO redirects/assertions: comparatively small volume, dominated by the IdP round-trip latency rather than bandwidth.

### Cost Estimates (AWS, order of magnitude)

**Compute:**
- Auth/Token/Authorization services: 40 c6g.2xlarge (ARM, compute-optimized) @ $0.272/hr = $261/day = ~$95K/year.

**Session Store:**
- ElastiCache Redis cluster (multi-AZ, 6 nodes, r6g.xlarge) = ~$9K/month = ~$108K/year.

**Database:**
- RDS PostgreSQL Multi-AZ (Identity Directory) = ~$4K/month = ~$48K/year.

**Audit Pipeline:**
- Kafka (MSK) + S3 cold storage for audit logs at 44TB hot + growing cold archive = ~$6K/month = ~$72K/year.

**KMS/HSM:**
- AWS KMS with CloudHSM for signing key custody (compliance requirement for some enterprise tenants) = ~$1.5K/month = ~$18K/year.

**Total: ~$350K–$400K/year at this scale**, excluding support/SSO-certificate-management overhead, which scales with the number of enterprise tenants rather than user count.

---

## System APIs

### Authentication APIs

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@acme.com",
  "password": "••••••••"
}

Response 200 OK (MFA required):
{
  "status": "mfa_required",
  "mfa_token": "mfa_abc123",
  "methods": ["totp", "webauthn"]
}
```

```http
POST /api/v1/auth/mfa/verify
Content-Type: application/json

{
  "mfa_token": "mfa_abc123",
  "method": "totp",
  "code": "482913"
}

Response 200 OK:
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "rtk_opaque_xyz",
  "expires_in": 600,
  "token_type": "Bearer"
}
```

```http
POST /api/v1/auth/token/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/logout/all
GET  /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/{session_id}
```

### SSO / Federation APIs

```http
GET /api/v1/sso/{tenant_slug}/login
  → 302 redirect to tenant's configured IdP (SAML AuthnRequest or OIDC authorize URL)

POST /api/v1/sso/{tenant_slug}/acs
  → SAML Assertion Consumer Service endpoint (receives and validates SAML Response)

GET /api/v1/sso/{tenant_slug}/callback
  → OIDC callback endpoint (exchanges authorization code for tokens)
```

```http
PUT /api/v1/tenants/{tenant_id}/idp-config
Content-Type: application/json

{
  "protocol": "saml2",
  "idp_metadata_url": "https://acme.okta.com/app/exk.../sso/saml/metadata",
  "attribute_mapping": {
    "email": "email",
    "first_name": "firstName",
    "groups": "memberOf"
  },
  "default_role": "member",
  "mfa_policy": "idp_asserted"
}
```

### OAuth2 / M2M APIs

```http
POST /api/v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=svc_abc&client_secret=•••&scope=orders:read

Response 200 OK:
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "orders:read"
}
```

```http
GET /.well-known/jwks.json
GET /.well-known/openid-configuration
```

### Authorization APIs

```http
POST /api/v1/authz/check
Content-Type: application/json

{
  "subject": "user_123",
  "tenant_id": "tnt_acme",
  "action": "invoice:approve",
  "resource": "invoice:inv_987"
}

Response 200 OK:
{ "allowed": true, "reason": "role:finance_approver" }
```

### Admin / Audit APIs

```http
GET /api/v1/admin/users/{user_id}/audit-trail
GET /api/v1/admin/tenants/{tenant_id}/audit-log?from=2026-09-01&to=2026-10-01
POST /api/v1/admin/users/{user_id}/force-logout
GET /api/v1/admin/users/{user_id}/export   # GDPR data portability
DELETE /api/v1/admin/users/{user_id}       # GDPR right to erasure
```

---

## Database Design

### Schema Design

Core identity and policy data lives in PostgreSQL (strong consistency, relational integrity across tenants/users/roles). Session and revocation state lives in Redis (low-latency, TTL-native). Audit events stream through Kafka into cold storage (append-only, high write volume, rarely updated).

### PostgreSQL Schema

```sql
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    sso_protocol    VARCHAR(20),              -- 'saml2' | 'oidc' | NULL
    idp_metadata_url TEXT,
    idp_cert        TEXT,
    attribute_mapping JSONB,
    mfa_policy      VARCHAR(30) NOT NULL DEFAULT 'required',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           VARCHAR(320) NOT NULL,
    password_hash   TEXT,                     -- NULL for SSO-only users
    external_id     VARCHAR(255),              -- subject claim from IdP
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_external_id ON users(tenant_id, external_id);

CREATE TABLE mfa_credentials (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    method          VARCHAR(20) NOT NULL,      -- 'totp' | 'webauthn' | 'sms'
    secret_encrypted TEXT,
    public_key      TEXT,                      -- for webauthn
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            VARCHAR(100) NOT NULL,
    permissions     JSONB NOT NULL             -- ["invoice:read", "invoice:approve"]
);

CREATE TABLE user_roles (
    user_id         UUID NOT NULL REFERENCES users(id),
    role_id         UUID NOT NULL REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE oauth_clients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id),
    client_id       VARCHAR(100) UNIQUE NOT NULL,
    client_secret_hash TEXT NOT NULL,
    allowed_scopes  JSONB NOT NULL,
    grant_types     JSONB NOT NULL
);
```

### Redis Keys (Session / Token Store)

```
# Refresh token (hashed), 30-day TTL
refresh:{token_hash} -> { user_id, tenant_id, device_fp, issued_at }

# Active session index, for "list my sessions" / "logout everywhere"
sessions:{user_id} -> SET of session_ids

# Revocation list, keyed by JWT id (jti), TTL = remaining access-token lifetime
revoked:{jti} -> 1

# Rate limiting (login attempts, MFA attempts)
ratelimit:login:{email} -> counter, 15-min TTL
ratelimit:mfa:{user_id} -> counter, 5-min TTL

# JWKS cache (mirrors KMS-issued keys, refreshed on rotation)
jwks:current -> JSON
```

---

## High-Level Architecture

```
                          ┌─────────────────────┐
                          │   API Gateway / BFF   │
                          │ (token verification,  │
                          │  rate limiting)        │
                          └──────────┬────────────┘
                                     │
                     ┌───────────────┼────────────────┐
                     │               │                │
            ┌────────▼───────┐ ┌─────▼──────┐  ┌──────▼───────┐
            │  Auth Service    │ │ Token      │  │ Authorization │
            │  (login, MFA,    │ │ Service    │  │ Service       │
            │   SSO broker)    │ │ (issue/    │  │ (RBAC/ABAC,   │
            │                  │ │  rotate/   │  │  policy eval) │
            │                  │ │  revoke)   │  │               │
            └────────┬────────┘ └─────┬──────┘  └──────┬────────┘
                     │                │                │
      ┌──────────────┼──────┬─────────┼────────┬───────┘
      │               │      │         │         │
 ┌────▼─────┐  ┌──────▼───┐ ┌▼────────▼──┐ ┌────▼─────┐
 │ Identity  │  │ MFA      │ │ Session /   │ │ Audit &   │
 │ Directory │  │ Service  │ │ Token Store │ │ Compliance│
 │ (users,   │  │ (TOTP,   │ │ (Redis)     │ │ Log       │
 │ tenants)  │  │ WebAuthn)│ │             │ │ (Kafka →  │
 └───────────┘  └──────────┘ └─────────────┘ │  S3 cold) │
                                               └───────────┘
                     │
           ┌─────────▼──────────┐
           │ SSO Federation Hub  │
           │ (SAML2 / OIDC bridge│
           │  per-tenant IdP     │
           │  config: Okta, Azure│
           │  AD, Google Workspace)│
           └─────────────────────┘

           Signing keys live in KMS/HSM — never in app config.
```

### Service Communication

- **Edge → Auth/Token/Authorization services:** synchronous HTTPS (REST/gRPC), behind the API Gateway.
- **Token Service → KMS:** signing operations only at key-rotation time; day-to-day verification uses the cached public key from JWKS, not a live KMS call.
- **Auth Service → Audit Log:** asynchronous, via Kafka, so a slow audit pipeline never blocks a login response.
- **Downstream services → Authorization Service:** synchronous for coarse, infrequent checks; most requests instead read roles/scopes directly from the verified JWT claims to avoid a network hop per request.

---

## Core Components

### 1. Auth Service

**Responsibilities:**
- Password login, registration, password reset.
- MFA challenge orchestration (TOTP/WebAuthn/SMS).
- SSO brokering: redirect to tenant IdP, validate SAML assertion/OIDC id_token, map claims to internal identity.
- JIT user provisioning on first SSO login.

**Key Operations:**
```
login(email, password) → mfa_challenge | tokens
verifyMfa(mfa_token, method, code) → tokens
initiateSso(tenant_slug) → redirect_url
handleSsoCallback(tenant_slug, assertion) → tokens
resetPassword(email) → reset_email_sent
```

**Technologies:**
- Language: Node.js / TypeScript
- Framework: Fastify / NestJS
- SAML: `node-saml` / `samlify`; OIDC: `openid-client`
- Password hashing: Argon2id via `argon2` (run in a worker thread pool, not the main event loop)

### 2. Token Service

**Responsibilities:**
- Issue signed JWT access tokens and opaque refresh tokens.
- Rotate refresh tokens on every use (rotation-on-use detects token theft: a reused, already-rotated refresh token triggers full session revocation).
- Publish public keys via `/.well-known/jwks.json`.
- Handle signing-key rotation against KMS without invalidating in-flight tokens.

**Key Operations:**
```
issueTokens(user, claims) → { access_token, refresh_token }
refreshTokens(refresh_token) → { access_token, refresh_token }
revokeToken(jti | refresh_token) → revoked
rotateSigningKey() → new_kid_published
```

**Algorithm (Refresh Token Rotation with Theft Detection):**
```python
def refresh_tokens(refresh_token):
    record = redis.get(f"refresh:{hash(refresh_token)}")

    if record is None:
        raise InvalidTokenError()

    if record.rotated:
        # This refresh token was already used once before — reuse means
        # the token was stolen and the attacker and legitimate user are racing.
        revoke_all_sessions(record.user_id)
        audit_log.record("refresh_token_reuse_detected", user_id=record.user_id)
        raise SecurityError("session revoked")

    # Mark old token as rotated (grace window, not immediate delete,
    # to tolerate a client retry on a flaky network)
    redis.set(f"refresh:{hash(refresh_token)}", {**record, "rotated": True}, ex=30)

    new_refresh = generate_opaque_token()
    redis.set(f"refresh:{hash(new_refresh)}", {
        "user_id": record.user_id,
        "tenant_id": record.tenant_id,
        "device_fp": record.device_fp,
        "rotated": False,
    }, ex=THIRTY_DAYS)

    access_token = sign_jwt(record.user_id, record.tenant_id, ttl=600)
    return access_token, new_refresh
```

### 3. Authorization Service

**Responsibilities:**
- Central RBAC/ABAC policy evaluation.
- Role/permission management per tenant.
- Policy-as-code evaluation (OPA/Cedar-style) for fine-grained, auditable decisions.

**Key Operations:**
```
check(subject, action, resource, tenant_id) → allowed: bool
getRolesForUser(user_id) → roles[]
assignRole(user_id, role_id) → assigned
```

**Technologies:**
- Policy engine: Open Policy Agent (OPA) or AWS Cedar
- Policies versioned and deployed independently of application code, so a permission change doesn't require a service redeploy

### 4. MFA Service

**Responsibilities:**
- TOTP secret generation and verification (RFC 6238).
- WebAuthn/FIDO2 credential registration and assertion (passkeys).
- SMS fallback delivery via Twilio/SNS, rate-limited aggressively (SMS is the weakest MFA factor and the most abused).

**Key Operations:**
```
enrollTotp(user_id) → { secret, qr_code_url }
verifyTotp(user_id, code) → valid: bool
registerWebauthnCredential(user_id, attestation) → credential_id
verifyWebauthnAssertion(user_id, assertion) → valid: bool
```

### 5. SSO Federation Hub

**Responsibilities:**
- Terminate SAML2/OIDC protocol complexity per tenant so the rest of the platform only ever sees a normalized internal token.
- Validate assertion signatures against the tenant's registered IdP certificate.
- Map IdP attributes/claims to internal user fields and roles (e.g., `memberOf: Finance-Admins` → role `finance_approver`).

**Key Operations:**
```
validateSamlAssertion(assertion, idp_cert) → claims
validateOidcIdToken(id_token, idp_jwks) → claims
mapAttributesToUser(claims, attribute_mapping) → normalized_identity
```

### 6. Audit & Compliance Service

**Responsibilities:**
- Append-only recording of every authentication/authorization decision.
- Serve audit-trail queries for admins and compliance auditors.
- Support GDPR export/erasure workflows without breaking referential integrity of the audit trail (pseudonymize rather than delete audit records tied to an erased user, where retention law requires it).

**Key Operations:**
```
record(event_type, user_id, tenant_id, metadata) → logged
queryTrail(tenant_id, filters) → events[]
exportUserData(user_id) → export_bundle
pseudonymizeUser(user_id) → done
```

---

## Key Flows

### Enterprise SSO Login Flow

```ts
// Auth Service — SSO callback handler
async function handleSsoCallback(tenantSlug: string, assertion: SamlAssertion) {
  const tenant = await identityDirectory.getTenantBySlug(tenantSlug);
  const claims = await ssoFederationHub.validateAssertion(assertion, tenant.idpCert);

  let user = await identityDirectory.findUserByExternalId(tenant.id, claims.subject);
  if (!user) {
    user = await identityDirectory.provisionJit(tenant.id, claims); // JIT provisioning
  }

  const mfaRequired = mfaService.isRequiredFor(user, tenant.mfaPolicy, claims.mfaAsserted);
  if (mfaRequired) {
    return authService.challengeMfa(user);
  }

  const tokens = await tokenService.issue(user, { tenantId: tenant.id, roles: user.roles });
  await auditLog.record('sso_login_success', { userId: user.id, tenantId: tenant.id });
  return tokens;
}
```

MFA enforcement reads from `tenant.mfaPolicy`, not a global constant — enterprise customers negotiate their own security posture (e.g., "trust the IdP's own MFA assertion" vs. "always challenge again") into contracts, so this has to be tenant-configurable from day one.

### Token Validation on the Hot Path

```ts
// API Gateway middleware — no network call to Auth Service
async function verifyAccessToken(req: Request) {
  const token = extractBearerToken(req);
  const { kid } = decodeHeader(token);
  const publicKey = await jwksCache.getKey(kid); // cached, refreshed only on 'kid' miss
  const claims = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

  if (await revocationList.isRevoked(claims.jti)) {
    throw new UnauthorizedError('token revoked');
  }
  return claims;
}
```

Signature verification happens locally against a cached public key, which is what keeps validation latency low under the ~26,000 rps peak estimated above. The revocation check is the one cheap Redis lookup kept on the hot path, because "logout everywhere" and breach response have to actually work — a purely stateless design can't support them.

### Logout Everywhere Flow

1. User (or admin, during incident response) calls `POST /api/v1/auth/logout/all`.
2. Auth Service fetches all active session IDs for the user from `sessions:{user_id}`.
3. For each session, the associated refresh token is deleted from the Session Store and the current access token's `jti` is added to the revocation list with a TTL equal to its remaining lifetime.
4. An audit event (`forced_logout_all`) is recorded with the actor (self or admin) and reason.
5. Already-issued access tokens stop working within one revocation-check cycle; refresh attempts fail immediately since the refresh token record is gone.

### Key Rotation Flow

1. A new signing keypair is generated in KMS/HSM; it is never exported in plaintext.
2. The new public key is published to the JWKS endpoint alongside the still-valid previous key (`kid`-keyed).
3. The Token Service begins signing new tokens with the new key immediately.
4. Tokens signed with the previous key continue to validate successfully until they naturally expire (bounded by the short access-token TTL).
5. After the previous key's last possible token has expired, it is removed from the JWKS endpoint.

---

## Security & Compliance

### Authentication & Authorization Hardening

- Argon2id for password hashing, tuned to ~250ms per hash on reference hardware, run off the main event loop.
- Rate limiting on login and MFA attempts, keyed by account and by IP, with exponential backoff.
- Refresh token rotation with reuse detection (see Token Service algorithm above) to catch token theft.
- Device fingerprinting attached to refresh tokens so a session hijack from a new device/location can be flagged or forced to re-authenticate.

### Data Encryption

```python
# MFA secrets and other sensitive fields are encrypted at rest with a
# per-tenant data encryption key (DEK), itself wrapped by a KMS-held key.
def encrypt_mfa_secret(tenant_id, plaintext_secret):
    dek = kms.get_data_key(tenant_id)
    return aes_gcm_encrypt(plaintext_secret, dek)
```

### Audit Logging

```
Example audit events:
- login_success / login_failure
- mfa_challenge_sent / mfa_verified / mfa_failed
- sso_login_success / sso_assertion_invalid
- token_issued / token_refreshed / refresh_token_reuse_detected
- forced_logout_all (actor: self | admin, reason)
- role_assigned / role_revoked
- tenant_idp_config_changed
```

Every event captures actor, subject, tenant, IP, user agent, and timestamp, and is written to an append-only Kafka topic before being acknowledged — the login/token-issuance response does not wait on the audit write completing, but the write is guaranteed, not best-effort.

### GDPR Compliance

- **Right to erasure:** user's identifying fields are removed from `users`; associated audit records are pseudonymized (subject replaced with a stable, non-reversible token) rather than deleted outright where retention law requires keeping the compliance trail.
- **Data portability:** `exportUserData` produces a structured bundle of the user's own profile, roles, and session history.
- **Purpose limitation:** MFA secrets and session metadata are retained only as long as needed for their stated purpose and are not reused for analytics.

### PCI/HIPAA-Adjacent Note

This system is not a payment processor or a clinical data store — but enterprise tenants in regulated industries frequently require their IdP's MFA assertion to satisfy their own PCI/HIPAA-adjacent access-control requirements. The `mfa_policy: idp_asserted` tenant setting exists specifically to let the auth platform defer to — rather than duplicate — a tenant's existing compliance posture.

---

## Scalability & Performance

### Horizontal Scaling

- Auth Service, Token Service, Authorization Service, and SSO Federation Hub are all stateless and scale horizontally behind the API Gateway/load balancer.
- The only stateful component is the Session/Token Store (Redis), which scales via clustering (sharded by user/tenant) and multi-AZ replication.
- PostgreSQL (Identity Directory) scales reads via replicas; writes are infrequent relative to login/validation traffic (user creation, role changes, tenant config), so a single-writer model with read replicas is sufficient well past the estimated 50M-user scale.

### Caching Strategy

- JWKS public keys cached in-process in every service that validates tokens, invalidated only on a `kid` cache miss (i.e., when a token references a key the cache hasn't seen yet).
- Tenant IdP configuration cached at the edge of the SSO Federation Hub with a short TTL, since SSO config changes are rare and not latency-sensitive to propagate within seconds.
- Role/permission lookups for the common case are avoided entirely by embedding roles/scopes as JWT claims; the Authorization Service is called only for less-common, resource-specific checks.

### Failure Isolation

- If the Authorization Service is degraded, downstream services fall back to the claims already embedded in the verified access token rather than failing requests closed — the tradeoff is up to one token-lifetime (minutes) of staleness on fine-grained permission changes during an incident, which is preferable to a platform-wide outage.
- If the SSO Federation Hub or a specific tenant's upstream IdP is unreachable, only that tenant's SSO logins are affected; password-based login and already-issued sessions for other tenants are unaffected.
- Multi-region active-active deployment for the Token Service, with signing keys replicated via KMS multi-region keys, so a regional outage doesn't halt token issuance platform-wide.

---

## Trade-offs & Summary

| Decision | Alternative Considered | Why This Choice |
|---|---|---|
| JWT access token + opaque refresh token | JWT for both | Access tokens stay stateless for speed; refresh tokens must be revocable, which a bare JWT can't support without a lookup anyway |
| Claims embedded in JWT + central authz for edge cases | Pure centralized authorization | Avoids a network call on every request; accepts up-to-one-token-lifetime staleness on permission changes |
| Per-tenant SSO federation | Force all users onto one login system | Enterprise buyers won't migrate workforce identity to a vendor platform; federation is a sales requirement, not a nice-to-have |
| JWKS-based key rotation | Static long-lived signing key | Enables rotation without invalidating in-flight tokens, and limits blast radius of a key compromise |
| Refresh token rotation with reuse detection | Static refresh tokens | Turns token theft from undetectable into an actively alarmed event |
| Audit log as its own async pipeline | Logging as a side effect of app logs | Makes compliance audits and breach investigations tractable; decouples audit durability from request latency |

The design holds together on one underlying principle: **authentication has to be fast and stateless on the common path (token validation), and the complexity — SSO federation, MFA policy, revocation, audit — is pushed into components that sit off that path.** Every tenant-specific or compliance-driven requirement (custom IdP, custom MFA policy, long retention) is handled as configuration on top of this architecture, not as a fork of it.

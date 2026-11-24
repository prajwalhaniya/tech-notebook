---
sidebar_position: 10
---

# Design Google Docs (Real-Time Collaborative Document Editor)

Google Docs is a web-based word processor where multiple people edit the same document at the same time and see each other's changes within a few hundred milliseconds. Its hardest problem isn't storing documents or rendering rich text — plenty of systems do both. It's reconciling concurrent, out-of-order edits from many collaborators — some of whom were offline when they made them — into one document every collaborator's screen eventually agrees on, without ever losing a keystroke or asking a user to resolve a merge conflict by hand. This design is built around solving exactly that.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Requirements](#requirements)
3. [Capacity Estimation](#capacity-estimation)
4. [System APIs](#system-apis)
5. [Database Design](#database-design)
6. [High-Level Design](#high-level-design)
7. [Component Design](#component-design)
8. [Resolving Concurrent Edits: How Conflicts Are Actually Handled](#resolving-concurrent-edits-how-conflicts-are-actually-handled)
9. [Data Partitioning](#data-partitioning)
10. [Caching Strategy](#caching-strategy)
11. [Consistency Model](#consistency-model)
12. [Offline Editing & Version History](#offline-editing--version-history)
13. [Security](#security)
14. [Monitoring & Analytics](#monitoring--analytics)
15. [Trade-offs](#trade-offs)
16. [Additional Considerations](#additional-considerations)
17. [Summary](#summary)

---

## Problem Statement

Design a collaborative rich-text document editor similar to Google Docs where:

- Users create, rename, duplicate, and delete rich-text documents: headings, bold/italic/underline, bullet and numbered lists, tables, and inline images.
- Multiple users open and edit the **same document at the same time**, and each sees the others' edits and live cursor positions within a few hundred milliseconds.
- A user can keep editing while **offline**; edits made with no connection merge back in automatically the moment the client reconnects — no manual conflict resolution.
- Every document retains a full **edit history**: any prior revision can be previewed and restored, and a user can explicitly name a revision so it's never pruned.
- Users leave **comments** anchored to a specific range of text, reply to them, and resolve them; the anchor must keep pointing at the right text as the document around it keeps changing.
- Document owners control **sharing**: per-person or per-link roles (viewer / commenter / editor), including link-sharing modes restricted to specific people, anyone with the link, or a specific company domain.
- The constraint that makes this system distinct from a generic CRUD app: at no point may two collaborators' concurrent edits silently overwrite or corrupt each other's text. Every client must converge on the exact same final document, byte for byte, no matter what order its operations happened to arrive in or how long a collaborator was disconnected.

---

## Requirements

### Functional Requirements

1. **Document management** — create, rename, duplicate, trash/restore documents; organize into folders.
2. **Rich text editing** — headings, bold/italic/underline/strikethrough, lists, tables, inline images, basic page layout.
3. **Real-time collaboration** — concurrent multi-user editing with sub-second propagation; live cursor position and text selection per active collaborator; a presence indicator showing who's currently viewing or editing.
4. **Offline editing** — continue editing with no network connection; local changes queue and reconcile automatically on reconnect.
5. **Version history** — browse, preview, and restore any prior revision; explicitly name a revision so it's kept forever regardless of age.
6. **Commenting & suggesting** — anchor a comment to a text range; reply to and resolve threads; a "suggesting" mode where edits are proposed, not applied, until an editor accepts them.
7. **Sharing & permissions** — per-user and per-link roles (viewer / commenter / editor); transfer of ownership.
8. **Export** — download as PDF, DOCX, or plain text.

Out of scope for this design: real-time voice/video calls, a third-party add-on marketplace, OCR/handwriting import, and spreadsheet or slide-deck document types (each is its own system built on similar collaboration primitives).

### Non-Functional Requirements

1. **Scale**: 100M DAU, ~1 billion documents stored, peak ~2 million documents open concurrently, of which ~300,000 have 2 or more simultaneous active collaborators.
2. **Latency**: a keystroke renders on the typing user's own screen with effectively zero delay (applied optimistically before any round trip); a remote collaborator sees that same edit within **p99 < 500 ms**; a cold document open renders in **< 1 s**.
3. **Consistency**: strong, deterministic convergence — every collaborator's copy of the document must become byte-for-byte identical once all in-flight operations are applied, regardless of the order they arrived in. A user must never be shown a "merge conflict" to resolve by hand.
4. **Availability**: 99.9% for the edit path. If the server process handling a document's live session fails, a new one must take over within seconds without losing any already-acknowledged edit.
5. **Durability**: once the server acknowledges an edit, it is never lost — not to a crash, a flaky network, or a conflicting concurrent edit.
6. **Offline tolerance**: a client disconnected for minutes to days must still merge back in automatically once it reconnects.
7. **Other**: enterprise data residency (store an organization's documents in a chosen region), audit logs of who viewed/edited/exported a document, and GDPR-style deletion.

---

## Capacity Estimation

### Traffic & Concurrency Estimates

- **DAU**: 100 million. **Documents stored**: ~1 billion.
- **Peak concurrently open documents**: ~2 million, of which **~300,000 are actively co-edited** (2+ simultaneous collaborators) and the rest are opened solo.
- **Average collaborators per co-edited document at peak**: 3 → ~900,000 people are, at any given peak moment, part of a live multi-user editing session.
- Of those 900,000, assume only ~10% are mid-keystroke at any single instant (the rest are reading, thinking, or idle-cursored) → **~90,000 concurrently active typists**, system-wide, at peak.
- Clients batch rapid keystrokes into one network operation roughly every 300 ms (a standard real-world optimization, not one operation per keypress) → **~90,000 edit operations/sec system-wide at peak**.

**So what:** 90,000 tiny writes/sec is a number a single machine could sink into an append-only log without strain — this is not a raw-throughput problem. It's a **latency and ordering** problem: each of those 90,000 operations has to be reconciled against whatever else just happened on its *specific* document and fanned out to that document's handful of collaborators in well under 500 ms. That rules out routing every operation through a stateless app server and a shared relational database round trip — it has to be handled by logic running in-memory, co-located with that one document's live state.

### Storage Estimates

- **Average current content size per document**: ~40 KB.
- **Raw per-keystroke operation history, kept forever, per document**: realistically ~10x the final content size once you count every insert, delete, undo and redraft over a document's life (~400 KB/doc). Across 1 billion documents, that's **~400 PB** just for uncompacted edit history.
- With **periodic compaction** (folding the operation log into a snapshot every so often, discarding unnamed revisions past a retention window, keeping only explicitly named versions in full — detailed under [Offline Editing & Version History](#offline-editing--version-history)): hot storage drops to roughly 40 KB (current snapshot) + 20 KB (recent uncompacted tail) ≈ **60 KB/doc**, or **~60 PB** total, **~180 PB with 3x replication**.

**So what:** keeping every keystroke forever, uncompacted, would mean ~400 PB and a document that takes longer to open the older and more-edited it gets, since opening it means replaying its full history. Compaction isn't an optimization to add later — it's load-bearing for both the storage bill and the "open a document in under a second" latency requirement.

### Bandwidth Estimates

- Each of the 90,000 peak operations/sec fans out to the other collaborators on its document — average 2 recipients (3 collaborators minus the author) → **~180,000 message deliveries/sec**.
- Average operation payload (position, content, author, revision metadata): ~150 bytes → 180,000 × 150 B ≈ 27 MB/s ≈ **~216 Mbps** of fan-out traffic at peak, globally.

**So what:** 216 Mbps is trivial in raw bytes — a single edge location could carry it. The actual constraint is that every one of those 180,000 messages has to land on an **already-open, stateful connection** within a few hundred milliseconds, which makes this a connection-routing and fan-out problem, not a bandwidth problem.

### Connection Estimates

- 2 million peak concurrently open documents, averaging somewhat more than 1 participant each once solo and multi-user sessions are combined → **roughly 3 million concurrent long-lived connections** (WebSocket or equivalent) held open system-wide at peak.

**So what:** 3 million simultaneous stateful connections need to be sharded across many gateway and collaboration-server instances with sticky, per-document routing — the same class of problem as presence/connection management in a large chat system, layered directly on top of the edit-ordering problem above.

---

## System APIs

Document metadata, sharing, comments, and version history are plain request/response REST calls. Live editing is not — it rides a persistent, bidirectional connection, because a round trip per keystroke would blow the latency budget.

```http
# Document & metadata (REST)
POST   /v1/documents                              → 201 { docId }
GET    /v1/documents/{docId}
PATCH  /v1/documents/{docId}                       → rename, trash/restore
GET    /v1/documents?ownedBy=me&sort=updatedAt      → cursor-paginated list

# Sharing & permissions
POST   /v1/documents/{docId}/permissions           → { principal, role }
GET    /v1/documents/{docId}/permissions

# Comments
POST   /v1/documents/{docId}/comments              → { anchorStart, anchorEnd, body }
POST   /v1/comments/{commentId}/resolve

# Version history
GET    /v1/documents/{docId}/revisions
POST   /v1/documents/{docId}/revisions/{revision}/name   → { name }
POST   /v1/documents/{docId}/revisions/{revision}/restore

# Export
GET    /v1/documents/{docId}/export?format=pdf

# Live editing (persistent connection, one per open document per client)
WS     /v1/documents/{docId}/edit
```

### Example: The Live Editing Channel

```json
// Client → server, sent as soon as the client has a document open
{
  "type": "join",
  "docId": "doc_789",
  "baseRevision": 41812,
  "clientId": "client_abc"
}

// Client → server, one per batched edit (every ~300ms of active typing)
{
  "type": "op",
  "clientOpId": "op_55f3",       // idempotency key — survives a retried send
  "baseRevision": 41812,          // the last revision this client has seen
  "ops": [{ "op": "insert", "pos": 118, "content": "Beautiful " }]
}

// Server → the authoring client: acknowledges and assigns the real revision
{
  "type": "ack",
  "clientOpId": "op_55f3",
  "revision": 41813
}

// Server → every other connected collaborator on this document
{
  "type": "op",
  "revision": 41813,
  "authorId": "user_42",
  "ops": [{ "op": "insert", "pos": 118, "content": "Beautiful " }]
}

// Server → all clients: live cursor/selection, not part of the op log
{
  "type": "presence",
  "userId": "user_42",
  "selection": { "start": 128, "end": 128 }
}
```

The `clientOpId` is an idempotency key the same way an `Idempotency-Key` header is for a REST write — a dropped `ack` and a client retry must never apply the same insert twice. `baseRevision` is what makes conflict resolution possible at all: it tells the server exactly which version of the document this operation was written against, so the server knows precisely what (if anything) to transform it against before applying it — the mechanism covered in detail below.

---

## Database Design

### Core Tables

```sql
CREATE TABLE documents (
    doc_id BIGINT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled document',
    current_revision BIGINT NOT NULL DEFAULT 0,   -- latest revision folded into content
    is_trashed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_owner (owner_id, updated_at DESC)
);

CREATE TABLE permissions (
    doc_id BIGINT NOT NULL,
    principal_type ENUM('USER', 'LINK_ANYONE', 'LINK_DOMAIN') NOT NULL,
    principal_id BIGINT,            -- user_id when principal_type = USER, else NULL
    role ENUM('OWNER', 'EDITOR', 'COMMENTER', 'VIEWER') NOT NULL,
    granted_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (doc_id, principal_type, principal_id),
    INDEX idx_user_docs (principal_id, doc_id)   -- "documents I can access"
);

-- The single most important table in the system: one row per committed
-- edit, append-only, strictly ordered per doc_id. Every other hard
-- problem here — conflict resolution, undo, offline replay, version
-- history, comment anchoring — is built on top of this log's ordering.
CREATE TABLE document_operations (
    doc_id BIGINT NOT NULL,
    revision BIGINT NOT NULL,           -- monotonic per doc_id, assigned by the owning Collab Server
    author_id BIGINT NOT NULL,
    client_op_id VARCHAR(64) NOT NULL,  -- idempotency key from the authoring client
    op_payload JSON NOT NULL,           -- the transformed op actually applied: [{op, pos, content|len, attrs}]
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (doc_id, revision),
    UNIQUE KEY idx_client_op (doc_id, client_op_id)   -- de-dupes a retried send
);

-- Periodic folded state, so opening a document never replays its full history.
CREATE TABLE document_snapshots (
    doc_id BIGINT NOT NULL,
    revision BIGINT NOT NULL,            -- document_operations.revision this snapshot already includes
    content_blob_ref VARCHAR(255) NOT NULL,  -- pointer into object storage
    size_bytes INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (doc_id, revision)
);

CREATE TABLE named_versions (
    doc_id BIGINT NOT NULL,
    revision BIGINT NOT NULL,
    name VARCHAR(100),
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (doc_id, revision)
);

CREATE TABLE comments (
    comment_id BIGINT PRIMARY KEY,
    doc_id BIGINT NOT NULL,
    anchor_revision BIGINT NOT NULL,     -- revision the anchor position was computed against
    anchor_start INT NOT NULL,
    anchor_end INT NOT NULL,
    author_id BIGINT NOT NULL,
    body TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_doc (doc_id, resolved)
);

CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100)
);
```

`document_operations` is deliberately not a normal relational table with secondary indexes — its access pattern is extremely high-volume sequential appends keyed by `doc_id`, with reads limited to "give me everything since revision N for this one document." That's the exact shape an **LSM-tree** storage engine (a wide-column store like Bigtable/Cassandra, or a partitioned log) is built for, not a B-tree engine tuned for point lookups and ad-hoc queries — see [Storage engines, in more depth](./Fundamentals/00_HLD%20Blueprint.md#6-database-selection) for why that distinction matters at this write volume.

---

## High-Level Design

```
 Web / Mobile Editor (client)
   - holds a local operation buffer (for offline edits + instant local echo)
          │
          ▼
   ┌─────────────┐
   │ CDN / Edge  │  ← editor JS bundle, read-only snapshot blobs for cold opens
   └──────┬──────┘
          │
   ┌──────▼────────────┐        ┌────────────────────────┐
   │ API Gateway (REST) │  ───▶  │ Metadata & Permissions  │
   │ stateless           │        │ DB (sharing, listing,   │
   └────────────────────┘        │ comments, exports)       │
          ▲                      └────────────────────────┘
          │ (same client, second connection)
   ┌──────▼────────────────┐
   │ Collaboration Gateway  │   ← stateless; terminates WebSockets,
   │ (stateless)            │     routes each doc_id to its one owner
   └──────┬─────────────────┘
          │ consistent hashing on doc_id
   ┌──────▼──────┐   ┌─────────────┐   ┌─────────────┐
   │ Collab      │   │ Collab      │   │ Collab      │   ← each instance owns a shard of
   │ Server #1   │...│ Server #2   │...│ Server #N   │     documents' live, in-memory OT state
   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
          │                 │                 │  every accepted op, written synchronously
          └─────────────────┼─────────────────┘
                             ▼
                  ┌─────────────────────┐
                  │ Document Operation   │  ← durable, append-only, partitioned by doc_id
                  │ Log                  │
                  └──────────┬──────────┘
                             │ async, periodic compaction
                  ┌──────────▼──────────┐
                  │ Snapshot / Blob      │
                  │ Store (object store) │
                  └─────────────────────┘
```

### Key Components

| Component | Role | Why it's separate |
| --- | --- | --- |
| **CDN / Edge** | Serves the editor's JS bundle and read-only snapshot blobs | Cold-open traffic is cacheable and read-only; folding it into the live-edit path would make every "open a doc" compete with real-time traffic for the same capacity |
| **API Gateway (REST)** | Document metadata, sharing, comments, export, version-history browsing | These are request/response and cache-friendly; the live-edit path is a stateful, long-lived stream — mixing them would force a stateless tier to also manage sticky connections |
| **Collaboration Gateway** | Stateless WebSocket front door; looks up which Collab Server owns a given `doc_id` and proxies the connection there | Kept stateless *specifically* so it can scale, restart, or roll out a new version independently of the stateful ownership logic underneath it |
| **Collab Server** | Stateful; holds the live, in-memory edit state for every document it owns and is the single ordering authority for that document's operations | This is the component the entire design is organized around — see [Component Design](#component-design) and the [deep dive below](#resolving-concurrent-edits-how-conflicts-are-actually-handled) |
| **Document Operation Log** | Durable, append-only, partitioned by `doc_id` | Its write pattern — tiny, extremely frequent, strictly per-document sequential — would thrash a relational table that also needs secondary indexes for sharing and search; keeping it apart means an edit surge on one document never contends with a permissions check on another |
| **Snapshot / Blob Store** | Periodic compacted document state | Written asynchronously, off the hot op-ingestion path, so compaction work never adds latency to a keystroke |
| **Metadata & Permissions DB** | Owns sharing, ACLs, comments, and document listing | A normal indexed relational table handles these read/write patterns well — nothing here benefits from the operation log's append-only shape |

---

## Component Design

### 1. Collaboration Gateway

Terminates every client's WebSocket connection and answers exactly one question per connection: which Collab Server currently owns this `doc_id`? It looks that up (or triggers assignment of a new owner if none exists yet) via a lightweight ownership registry, then proxies the connection through. It holds no document state itself, which is what lets it scale and deploy independently of the stateful tier it routes to.

### 2. Collab Server

The service the whole design revolves around. Each instance owns a shard of documents (assigned via consistent hashing on `doc_id`) and, for every document it owns, holds the authoritative in-memory state and is the single point that assigns the next `revision` number. Every incoming operation is transformed against anything that happened since the operation's stated `baseRevision` (detailed in the next section), applied in memory, synchronously appended to the durable [Document Operation Log](#database-design), and only then acknowledged and broadcast. "Durable write before ack" is what makes a crash survivable: nothing is ever acknowledged that a replacement owner couldn't reconstruct from the log.

### 3. Document Operation Log & Snapshot Service

The append-only log is the system's actual source of truth — not the "current" row in `documents`, which is just a cached pointer to the latest snapshot. A background process periodically folds the log since the last snapshot into a new compacted snapshot (see [Offline Editing & Version History](#offline-editing--version-history) for the retention policy), so opening a document means loading its latest snapshot plus replaying only the handful of operations since it, never the full history back to creation.

### 4. Comment Service

A comment's anchor (`anchor_revision`, `anchor_start`, `anchor_end`) has to keep tracking the right text as the document keeps changing after the comment is created — if someone inserts 20 characters before the commented range, the anchor must shift right by 20, not silently drift onto the wrong words. Rather than inventing a second position-tracking algorithm, the Collab Server re-expresses a comment's anchor by running it through the **same transform function** used for concurrent operations: every edit applied since `anchor_revision` is treated as one more operation to transform the anchor against, exactly like transforming another collaborator's concurrent edit. If the commented text is deleted outright, the anchor collapses to a zero-width point at the deletion site and the client marks the comment "orphaned" against its originally quoted text, rather than deleting the thread — a comment's history should survive the text it was about being edited away.

---

## Resolving Concurrent Edits: How Conflicts Are Actually Handled

This is the section that matters most for this design specifically — the problem isn't "apply N edits," it's "apply edits from different collaborators who each composed their operation against a version of the document that's already gone stale by the time it arrives."

**The mechanism is Operational Transformation (OT), with the owning Collab Server as the single ordering authority.** Walk a concrete example:

1. Users A and B both have the document open at revision 5, whose content is `"Hello world"`.
2. **A** inserts `"Beautiful "` before `"world"` → sends `{op: insert, pos: 6, content: "Beautiful ", baseRevision: 5}`.
3. Concurrently, **B** replaces `"world"` with `"there"` → sends `{op: delete, pos: 6, len: 5}` then `{op: insert, pos: 6, content: "there"}`, both also against `baseRevision: 5`. B has not seen A's edit — it hadn't happened yet when B started typing.
4. A's operation reaches the Collab Server first. Since nothing has changed since revision 5, it applies directly: content becomes `"Hello Beautiful world"`, revision advances to 6, and the op broadcasts to B (and everyone else).
5. B's operations arrive next, still stamped `baseRevision: 5` — but the document is now at revision 6. The server can't apply them as-is; it **transforms** them against A's already-applied insert before applying. A inserted 10 characters at position 6, so B's delete/insert pair — which also targeted position 6 — must shift to position 16 to still land on the word `"world"` instead of the middle of `"Beautiful "`. The transformed operations become `delete pos:16 len:5` and `insert pos:16 content:"there"`.
6. The server applies the transformed operations (revision 6 → 7) and broadcasts them. The final content on **every** client is `"Hello Beautiful there"` — identical, even though A and B each composed their edit without ever seeing the other's.
7. B's own client performs the mirror-image transform locally the moment it receives A's broadcast (if it arrives before B's own ack), so B's local cursor doesn't visually jump to the wrong spot either.

**Why this needs a single ordering authority.** Step 5 only has one unambiguous answer because the Collab Server has a strict, agreed-upon order of "what happened first" — A's op, *then* B's. Two independent servers transforming the same pair of operations in a different order, with no shared sequencer, is exactly how OT implementations historically produced divergent documents; it's why each document's live editing is pinned to exactly one owning process (see [Document Ownership, Sharding & Failover](#document-ownership-sharding--failover)) rather than load-balanced across many.

**Why this is the hard part of OT, not an implementation detail.** The transform step above is for one insert against one delete. A real editor needs a correct transform function for **every pair** of operation types — insert-insert, insert-delete, delete-delete, and format-against-insert/delete (what happens to a bold range when three characters are inserted in the middle of it?) — and each one has to be proven to converge the same way regardless of transform order. Getting one pair subtly wrong doesn't crash the system; it silently produces two collaborators' screens disagreeing, which is far worse and far harder to detect than a crash.

---

## Data Partitioning

### Document Ownership, Sharding & Failover

- **Shard key: `doc_id`.** Consistent hashing over `doc_id` assigns each document to exactly one Collab Server at a time, recorded in a lightweight ownership registry (e.g., backed by a coordination service like etcd or ZooKeeper) as `doc_id → owning server + fencing token`.
- **Failover**: if an owning Collab Server dies, the registry detects the lost heartbeat and assigns a new owner. Because every accepted operation was durably appended to the [Document Operation Log](#database-design) *before* being acknowledged, the new owner reconstructs exact in-memory state by loading the latest snapshot and replaying only the log entries since it — nothing acknowledged to a client is ever lost in the handoff.
- **Fencing token**: the registry issues a monotonically increasing token with each ownership assignment, and the operation log rejects any append carrying a stale token. This stops a "zombie" old owner — one that hasn't yet noticed it lost ownership, say after a long garbage-collection pause — from still accepting writes after a new owner has taken over, the classic split-brain scenario.
- **Hot documents**: a handful of documents (an all-hands notes doc, a widely shared public template) can draw thousands of simultaneous *viewers*. Read-only viewers don't need a dedicated connection all the way to the single owning sequencer the way an editor does — they're served through a fan-out tree or read replicas of the latest broadcast state, so one popular document's viewership can't exhaust the capacity its owning Collab Server needs for actually ordering edits.

---

## Caching Strategy

| Data | Store | Invalidation |
| --- | --- | --- |
| Live document state (current content + pending ops) | In-memory on the owning Collab Server | This *is* the authoritative copy while the doc is open — there's no separate cache to invalidate |
| Latest snapshot (for cold opens) | CDN / edge + object store | Replaced on every compaction cycle |
| Document listing, metadata, permissions | App-level cache in front of the Metadata DB | Invalidated on write (rename, share change) |
| Comment threads | App-level cache, keyed by `doc_id` | Invalidated on new comment / resolve |

The unusual thing here, compared to a typical read-heavy system: the "cache" for the hottest, most latency-sensitive data (a document's live content) isn't a separate layer like Redis — it's the Collab Server's own in-memory state, because that process is already the single place in the system that's guaranteed to be up to date for that document.

---

## Consistency Model

- **A single document's content**: strong, deterministic convergence via the owning Collab Server's strict operation ordering and transform step — detailed in [Resolving Concurrent Edits](#resolving-concurrent-edits-how-conflicts-are-actually-handled). There is a brief window, on the order of one round trip, where two collaborators' screens can show a different *transient* ordering of very recent concurrent edits before the next broadcast lands — never a different final document, just a few hundred milliseconds of staleness while convergence catches up.
- **Comments and presence**: eventual — a cursor position arriving a beat late, or a comment taking a moment to appear for a third collaborator, costs nothing structurally important.
- **Metadata (title, sharing, trash state)**: standard relational consistency in the Metadata DB; not on the hot edit path, so there's no reason to weaken it for latency.

---

## Offline Editing & Version History

**Offline editing** reuses the same transform mechanism as concurrent online editing, deliberately — it isn't a special case. A client holds a local, persisted queue of not-yet-acknowledged operations plus the last `revision` it saw from the server. While offline, typing applies to the local buffer immediately, so the user's own screen is never blocked by connectivity. On reconnect, the client sends its buffered operations stamped with that stale `baseRevision`; the Collab Server transforms them forward against everything that happened on the document in the meantime — exactly the step used for two collaborators editing at the same instant, just with a longer gap between `baseRevision` and the current revision. If the gap is so long that the relevant log segment has already been folded into a later snapshot and discarded, the server falls back to a structural three-way merge against the snapshot; in the rare case that can't be resolved automatically (the same text was rewritten beyond recognition on both sides), the client creates a conflict copy rather than silently discarding either side's work.

**Version history and compaction** are the other side of the same log. The raw per-keystroke log is what makes undo and revision browsing possible, but replaying it from document creation would make an old, heavily edited document slower to open every year. A background process periodically folds the log since the last snapshot into a new `document_snapshots` row; unnamed revisions older than a retention window (e.g. 30 days) are discarded once a snapshot already includes them, while anything in `named_versions` — a user explicitly choosing "name this version" — is kept in full indefinitely, regardless of age. This is exactly the compaction behavior the [storage estimate](#capacity-estimation) above assumed: it's what keeps 1 billion documents' history at ~180 PB instead of ~400 PB, and what keeps "open this document" bounded by its snapshot size, not its entire edit history.

---

## Security

- **Authorization enforced server-side on every operation** — the Collab Server and API Gateway check the caller's role (viewer/commenter/editor) on every single request, including every WebSocket operation, never trusting a client-side UI restriction alone.
- **Link sharing** tokens are unguessable and scoped to exactly the role they were created with (view/comment/edit); domain-restricted links additionally check the authenticated user's verified email domain.
- **Encryption** in transit (TLS) and at rest, with per-organization keys in a KMS for enterprise customers who require it.
- **Audit logs** record who viewed, edited, shared, or exported a document — required for enterprise compliance and for investigating a reported leak.
- **Suggesting mode** is enforced the same way as edit permission: a "commenter" or "suggesting editor" role can only ever submit operations tagged as proposed, which the Collab Server stores but doesn't fold into the canonical content until an editor accepts them.

---

## Monitoring & Analytics

**Key metrics, especially around the live edit path:**
- Keystroke-to-ack latency and keystroke-to-remote-collaborator latency (the two numbers the p99 < 500 ms requirement is actually about)
- Transform rate and transform error rate (operations that had to be reconciled against concurrent edits, and any that failed to converge — the latter should be effectively zero)
- Collab Server failover frequency and handoff duration (time from "owner lost" to "new owner serving")
- Snapshot compaction lag (how far behind the log a document's latest snapshot is)
- Offline-reconciliation conflict-copy rate (a proxy for how often automatic merging isn't enough)
- Per-shard load, to catch one "hot" document (a company-wide doc with thousands of viewers) before it degrades its own collaborators' latency

**Tooling**: Prometheus/Grafana for real-time dashboards on the edit path, with distributed tracing (a `docId` + `revision` as the correlation key) to follow one operation from client send through transform, log append, and broadcast.

---

## Trade-offs

| Decision | Alternative | Why | What we give up |
| --- | --- | --- | --- |
| Operational Transformation with one owning Collab Server per document | CRDT (e.g. a sequence CRDT like RGA/Yjs) with no central sequencer | Smaller per-operation payload matters directly — the capacity estimate already showed fan-out messages at ~150 bytes each driving real bandwidth and latency; OT keeps that payload to just position + content | True peer-to-peer and trivial offline-first merging without ever reconnecting to a server; CRDTs get that for free, OT's offline story instead reuses the transform-on-reconnect path (still correct, just requires the server round trip to resolve) |
| Exactly one Collab Server owns a document's live state at a time | Load-balance a document's operations across multiple stateless servers | A single agreed-upon order of "what happened first" is what makes the OT transform step in [Resolving Concurrent Edits](#resolving-concurrent-edits-how-conflicts-are-actually-handled) unambiguous | Document availability is tied to that one process's health during the handoff window on failure — mitigated with durable-write-before-ack and fencing tokens, but not eliminated |
| Compact the operation log into snapshots, discard unnamed revisions past a retention window | Keep every keystroke forever | Cuts long-term storage from ~400 PB to ~180 PB and keeps document-open latency bounded by snapshot size, not total history | Can't browse arbitrary unnamed intermediate states from years ago — only explicitly named versions are guaranteed to survive long-term |
| Strong, deterministic convergence for final content; eventual for presence/cursors | Linearizable consistency for every keystroke across all replicas (e.g. route every operation through a consensus protocol) | A consensus round trip on every character would make typing feel laggy, violating the sub-500ms propagation target | A brief window (roughly one round trip) where two collaborators' screens can show a different transient ordering of the very latest concurrent edits before converging — never a different final document |

---

## Additional Considerations

### Scalability Challenges Recap

1. **High-frequency, tiny, ordered writes per document** → in-memory OT on a single owning Collab Server per document, durable log appended before ack.
2. **Fan-out to many open connections** → stateless Collaboration Gateway sharding connections, consistent hashing to route each document to its one owner.
3. **Unbounded edit history** → periodic snapshot compaction with a bounded retention window for unnamed revisions, named versions kept forever.
4. **A failed owning server losing in-flight edits** → durable-write-before-ack plus fencing tokens, so a new owner can resume exactly where the old one left off.

### Future Enhancements

1. Richer CRDT-backed sub-documents (e.g. a live-shared comment draft) where true offline-first matters more than payload size, while the main body stays OT-based.
2. Smarter idle-collaborator detection to downgrade presence/cursor update frequency and cut fan-out volume further on very large documents.
3. Predictive pre-fetching of a document's snapshot ahead of a scheduled meeting where it's likely to be opened.
4. Field-level redaction/retention policies for regulated industries, applied at compaction time rather than per-read.

---

## Summary

The hard part of designing Google Docs isn't rich text rendering, document storage, or sharing — those are solved problems. It's that many people can edit the same small piece of text at the same instant, some of them after being offline, and every one of their screens has to converge on the exact same result without ever asking a human to resolve a conflict. The design handles this by giving each document a single ordering authority (the owning Collab Server), transforming every incoming operation against whatever already happened since the client last saw the document — the same mechanism whether the conflict is two people typing at once or one person reconnecting after a day offline — appending every accepted operation durably before acknowledging it, and periodically compacting that log into snapshots so history stays affordable and documents stay fast to open. Everything else in this design — sharing, comments, export, search — sits around that one mechanism rather than competing with it for the same latency budget.

---
sidebar_position: 1
---

# Distributed Systems: Q&A

Eighteen questions that come up constantly once a system has more than one node — why nodes need to agree on anything at all, what actually happens the instant one of them dies or stops talking to the others, and how real systems (Raft, Dynamo, Spanner, Kafka) answer each one. See also the [HLD Blueprint's distributed systems section](../HLD/Fundamentals/00_HLD%20Blueprint.md#10-distributed-systems-concepts) for the condensed interview-round version of several of these.

---

## Why does a distributed system need consensus?

Consensus is how multiple independent nodes agree on a single value or decision despite node failures and network delays, when no single node can be trusted to always be reachable or always be right. Without it, two nodes can each believe a different thing is true — which node is the leader, what the next entry in a log is, whether a transaction committed — and act on that belief independently.

Concretely: a database cluster needs its nodes to agree on exactly one leader, or two leaders can each accept conflicting writes at the same time. A replicated log (etcd, Kafka's KRaft controller) needs every replica to agree on the exact order of entries, or replicas diverge and "the same log" stops meaning the same thing on different nodes. Consensus algorithms like **Raft** and **Paxos** exist specifically to make that agreement possible even when some nodes crash or messages are delayed — as long as a majority of nodes are up and can talk to each other.

## What is the CAP theorem? What does it actually tell us?

During a **network partition** (some nodes can't reach others), a system has to choose between:

- **Consistency** — every read reflects the latest write, even if that means refusing to answer some requests.
- **Availability** — every request gets a response, even if it might be stale.

You cannot have both *during* a partition. **Partition tolerance isn't really the third option you get to skip** — on any real network, partitions happen, so the honest reading of CAP is "when a partition occurs, pick C or A," not "pick two of three as a general design philosophy."

- **CP systems**: Spanner, etcd, ZooKeeper, a single-leader SQL database. A minority partition stops accepting writes rather than risk disagreement.
- **AP systems**: Cassandra and DynamoDB (default settings), Dynamo-style stores, CDNs. Every partition keeps serving, possibly with stale data, reconciled later.

**What CAP doesn't tell you**: it says nothing about the common case where there's no partition at all — that's where **PACELC** picks up (*Else*, the trade-off is latency vs. consistency, which is the trade-off most systems actually make on a normal day). CAP also doesn't mean "always eventually consistent" or "always strongly consistent" — real systems pick per operation (a bank balance read might demand strong consistency while a "likes" count on the same platform doesn't).

## What is the difference between strong consistency and eventual consistency?

**Strong consistency** (linearizability) means every read reflects the most recent committed write, as if there were only one copy of the data, globally ordered in real time. A bank balance read right after a transfer must show the new balance — there's no window where it could show the old one.

**Eventual consistency** means replicas are allowed to lag behind the latest write for a while, but will converge to the same value once writes stop arriving. A DNS record update, or a "likes" count on a social post, can take seconds to show up everywhere without breaking anything — nobody is harmed by a few seconds of staleness there.

The trade-off is direct: strong consistency needs coordination (a quorum round trip, or routing every read through one leader), which costs latency and can cost availability during a partition. Eventual consistency avoids that coordination, so it's cheaper and more available, at the cost of a staleness window. Most real systems don't pick one model globally — they pick **per feature**: strong for payments and inventory, eventual for feeds and counters. Session-level middle grounds exist too: **read-your-writes** (a user always sees their own write immediately, even if other users don't yet) and **monotonic reads** (you never see data go backward in time, even if it's stale).

## What happens when a database leader crashes?

1. **Followers stop receiving heartbeats** from the leader and, after missing enough of them (an election timeout), suspect it's dead.
2. **In-flight writes are affected differently depending on how they were replicated.** A write that had already been acknowledged by a majority of replicas (committed) is safe — by the quorum/consensus guarantee, any newly elected leader must already have that entry, because it needed votes from a majority, and that majority overlaps with the group that had the committed write. A write the old leader had accepted from a client but hadn't yet replicated to a majority is **lost** — the client typically sees a timeout or an error rather than a silent loss, which is why client retries need to be idempotent.
3. **A new leader is elected** among the surviving replicas (see the next question) — in Raft, specifically one whose log is at least as up to date as a majority of the cluster, so it can't be missing anything already committed.
4. **Clients reconnect** to the new leader, usually via a service discovery mechanism or a redirect from whichever node they first contact, and resume sending writes.

The actual guarantee a well-designed system gives you is narrower than "no data is ever lost" — it's "nothing **acknowledged** to the client is ever lost." Anything still in flight when the leader died was never promised in the first place.

## How does leader election work?

**Raft's approach**, the clearest to reason about: every node is a follower, candidate, or leader, and time is divided into **terms** (monotonically increasing numbers). A follower that hasn't heard a heartbeat from the leader within a randomized election timeout becomes a **candidate**: it increments the term, votes for itself, and requests votes from every other node. A candidate that receives votes from a **majority** of the cluster becomes the new leader for that term and starts sending heartbeats.

Concretely, in a 5-node cluster, a candidate needs 3 votes (including its own) to win — any majority, not all 5, which is exactly what lets the cluster keep functioning with up to 2 nodes down. The **randomized timeout** is what keeps two nodes from both becoming candidates at the same instant and splitting the vote repeatedly — whichever one's timer fires first usually gets its votes in before the other even starts.

Other systems use the same majority-vote idea with different names: **ZooKeeper** uses the Zab protocol, **Kafka**'s controller election now runs on its own Raft-based (KRaft) quorum, and **Redis Sentinel** has sentinels vote on which replica to promote. The common thread across all of them is: no leader is valid unless a majority of the group agreed on it.

## What is split-brain, and how do you prevent it?

**Split-brain** is when a network partition leaves two nodes each believing *it* is the leader/primary at the same time — both start accepting writes independently, and the data diverges in a way that's genuinely hard to merge back together afterward.

It typically happens like this: node A (the leader) and node B (a follower) lose contact with each other. B, unable to reach A, assumes A is dead and gets elected as the new leader. But A is actually still running fine — it just can't reach B — so A keeps believing it's still the leader too. Now both accept writes.

**Prevention:**
- **Majority quorum for leadership.** A node can only become (or remain) leader by getting votes from a majority of the cluster. In a partition, at most one side can have a majority, so the minority side simply can't elect a leader — it degrades to read-only or stops serving, rather than electing a second one.
- **Fencing tokens** (see below). Even if an old leader doesn't realize it's been deposed, the shared resource it writes to rejects anything carrying a stale token.
- **Leases with short TTLs.** A leader's authority expires automatically unless renewed, so a partitioned-away leader naturally stops being "the leader" within a bounded time, instead of indefinitely believing otherwise.
- **STONITH** ("shoot the other node in the head") in some HA clusters — a blunt but effective approach where the surviving side forcibly powers off or isolates the side it believes is unreachable, removing any chance of it coming back and writing.

## What is quorum-based replication?

With **N** total replicas, a quorum scheme requires a write to be acknowledged by **W** of them, and a read to query **R** of them. The key guarantee: if **R + W > N**, every read is guaranteed to overlap with at least one replica that has the most recent acknowledged write, because there's no way to pick W nodes for the write and R nodes for the read, out of N total, with zero nodes in common.

Example: N=3, W=2, R=2. A write succeeds once 2 of the 3 replicas confirm it. A read queries 2 replicas — and since any 2-out-of-3 plus another 2-out-of-3 must share at least one node (2+2=4 > 3), the read is guaranteed to see at least one copy of the latest write.

This is the mechanism behind Dynamo-style databases (Cassandra, Riak, DynamoDB): it gives you tunable consistency without needing *all* N replicas online for every operation. Lowering W or R trades consistency guarantees for lower latency and higher availability — W=1 means a write succeeds the instant any single replica has it (fast, but a dead replica right after can mean that write is only on one copy), while W=N means every replica must be up for any write to succeed at all.

## What is the difference between synchronous and asynchronous replication?

**Synchronous replication**: the leader waits for one or more followers to acknowledge a write before confirming it to the client. No committed write is ever lost on failover, because a replica is guaranteed to already have it — but write latency now includes the round trip to whichever follower you're waiting on, and if that follower is slow or down, writes can stall entirely.

**Asynchronous replication**: the leader acknowledges the client immediately and replicates to followers in the background. Writes are fast and don't stall if a follower lags — but if the leader crashes before a write reaches any follower, that write is gone, and a promoted follower won't have it. The gap between what the leader has and what a follower has caught up to is **replication lag**, and it's also what breaks read-your-writes if a client's next read lands on a lagging replica.

**Semi-synchronous replication** (used by MySQL, for example) is the common middle ground: the leader waits for acknowledgment from just one replica (not all of them) before confirming the write, bounding the worst-case data loss to "whatever wasn't on that one replica yet" without paying the full latency cost of waiting on every follower.

## How does the Raft consensus algorithm work?

Raft splits the problem into two mostly-independent pieces: **leader election** (covered above) and **log replication**.

**Log replication, step by step:**
1. A client sends a command to the leader.
2. The leader appends it to its own local log as a new entry.
3. The leader sends `AppendEntries` RPCs to every follower in parallel, each carrying the new entry.
4. Once a **majority** of nodes (leader included) have persisted the entry, the leader considers it **committed** — it applies the entry to its own state machine and returns success to the client.
5. On the next heartbeat, the leader tells followers the new commit index, so they apply the entry to their own state machines too.

Concretely, in a 5-node cluster, the leader needs acknowledgment from 2 followers (3 total including itself) before a write is committed — the other 2 can be slow or temporarily unreachable without blocking progress.

**The safety property that makes leader changes safe**: a candidate can only win an election if its log is at least as up to date as a majority of the cluster's (compared by the term and index of its last log entry). Since any committed entry was, by definition, already on a majority of nodes, a new leader — needing votes from a majority too — is mathematically guaranteed to already have every previously committed entry. A leadership change can therefore never silently lose committed data; this single invariant is why Raft is reasoned about as "understandable" compared to the original Paxos formulation, which achieves the same safety without as direct a mechanism for it.

## What happens when two nodes cannot communicate with each other?

From the perspective of just those two nodes, this **is** a network partition — but what the wider system does about it depends entirely on how many other nodes exist and what consistency model governs them.

- **Inside a larger quorum-based cluster** (say, 5 nodes, and only 2 of them lose contact with each other but can both still reach the rest): the cluster as a whole keeps making progress as long as a majority can still communicate. The isolated pair doesn't get to independently decide anything on its own.
- **A single replicated pair, with no third node**: this is the hard case. Neither node can tell the difference between "my peer crashed" and "I just can't reach my peer" — and a 2-node group has no way to form a majority (since 1-out-of-2 isn't a majority of a healthy pair, either side claiming leadership is equally arbitrary). This is exactly why quorum-based systems are built around an **odd number of nodes, N ≥ 3** (or an explicit third arbiter/witness node) — it guarantees a majority can always be uniquely determined on at most one side of any split.
- **In an AP-style system**: both sides might keep operating independently, accepting writes that later have to be reconciled — see the [recovery question](#how-do-you-recover-a-distributed-system-after-a-network-partition) below for how that reconciliation actually happens.

## How do you detect node failure in a distributed system?

**Heartbeating**: each node periodically pings its peers (or a central monitor); missing N consecutive heartbeats within a timeout marks it dead. Simple, but the timeout is a blunt binary choice — too short, and a node under heavy GC pause or a slow network blip gets falsely marked dead (flapping); too long, and real failures take a long time to notice.

**Phi Accrual failure detection** (used by Cassandra and Akka) replaces the fixed timeout with a continuously computed **suspicion level**, based on the historical distribution of heartbeat intervals from that specific node. A node with naturally jittery 200-400ms heartbeats doesn't get flagged for a 500ms gap the same way a node with a rock-steady 50ms heartbeat history would — the detector adapts per node instead of using one global threshold for the whole cluster.

**Gossip-based detection** (the SWIM protocol, used by Consul and Serf): instead of every node heartbeating every other node (which doesn't scale), nodes periodically probe a few random peers and gossip suspicion ("I think node X is down") through the cluster, so detection work and bandwidth stay roughly constant as the cluster grows, rather than growing with the square of the node count.

Across all of these, there's a real trade-off between **detection speed and false-positive rate** — which is why most systems require multiple consecutive failed checks (not just one) before declaring a node dead, trading a few seconds of detection latency for far fewer false alarms.

## Why are distributed locks difficult to implement correctly?

A lock inside one process is just mutual exclusion in memory, enforced by the same CPU and the same scheduler, with no gap between "I checked I hold the lock" and "I act on it." A distributed lock has none of those guarantees, and that gap is where the real problems live:

- **The lock holder can crash while holding it**, so a distributed lock needs a TTL/lease rather than holding it forever — but then you need to pick a TTL, and any fixed TTL is a guess.
- **A slow client isn't distinguishable from a dead one.** A process that pauses for a long garbage collection cycle, or hits a slow network blip, can have its lease **expire while it's still running** — it resumes believing it still holds the lock, right as another client has legitimately acquired it after the expiry. Both now believe they hold the same lock.
- **Clock drift** undermines anything TTL-based, since "has this lease expired" is a question about wall-clock time, and different machines' clocks aren't perfectly synchronized (see the clock-sync question below).
- Redis's own **Redlock** algorithm, a popular distributed-lock recipe, was publicly critiqued by Martin Kleppmann for exactly this class of problem — it doesn't fully close the gap between "I believe I hold the lock" and "the resource I'm protecting can prove I still do."

The practical fix isn't a cleverer lock — it's **not trusting the lock alone to protect the resource**, which is exactly what fencing tokens are for.

## What is a fencing token, and why is it useful?

A fencing token is a **monotonically increasing number**, handed out every time a lock or lease is granted — for example, ZooKeeper's `zxid`, or a simple incrementing counter maintained by whatever grants the lease. The token itself isn't what provides safety — **the resource being protected has to check it**: every write must carry its holder's fencing token, and the resource rejects any write whose token is lower than the highest one it has already seen.

This closes the exact gap the previous question described: say client A acquires the lock with token 33, then pauses for a long GC cycle. Its lease expires, and client B acquires the lock next, with token 34, and starts writing. When A finally wakes up and sends its write, still carrying token 33, the storage backend sees that token 34 was already used and **rejects A's write outright** — not because A behaved correctly or incorrectly, but because the resource itself enforces ordering, instead of trusting whichever client believes it holds the lock. The lock was never really the safety mechanism; the token check at the point of actual use is.

## How do you handle clock synchronization across distributed nodes?

Wall clocks on different machines are never perfectly in sync. **NTP** typically keeps them within tens of milliseconds of each other over the public internet, but clocks can still drift, jump (a VM pausing and resuming, a leap-second adjustment), or simply disagree by more than that under a bad network path. The practical rule: **never use timestamps from two different machines to decide "which write happened last"** without understanding exactly how much uncertainty you're accepting.

Alternatives, depending on what you actually need:
- **Lamport clocks**: a simple logical counter that captures *happens-before* ordering (if event A could have caused event B, A's counter is smaller) without claiming anything about real elapsed time.
- **Vector clocks**: one counter per node, letting you detect not just ordering but **concurrency** — whether two writes are causally related at all, or happened independently and need reconciling (used by Dynamo-style stores like Riak).
- **Hybrid Logical Clocks (HLC)**: combine a physical timestamp with a logical counter, giving you something that behaves like a wall clock for humans but still preserves causal ordering exactly — used by CockroachDB and MongoDB.
- **Google Spanner's TrueTime**: GPS and atomic clocks bound clock uncertainty to a known, tiny window (single-digit milliseconds), and Spanner's "commit wait" deliberately delays a transaction's visible commit by that uncertainty window so that real-time ordering across the whole globally distributed system is actually externally consistent — an unusually expensive, hardware-backed solution most systems don't need.

## What is the difference between at-most-once, at-least-once and exactly-once delivery?

- **At-most-once**: a message is sent once, with no retry — it can be silently lost on any transient failure. Acceptable for low-stakes data like sampled metrics, where losing an occasional point costs nothing.
- **At-least-once**: the sender retries until it gets an acknowledgment, which means a message can be **delivered more than once** if the ack itself gets lost even though the message was actually processed. This is the default almost everywhere — SQS, and Kafka's standard consumer behavior, both work this way.
- **Exactly-once**: strictly, this is unachievable as a pure delivery guarantee over an unreliable network — you can't know, from the sender's side, whether a lost ack means "never arrived" or "arrived, but the ack didn't." What "exactly-once" means **in practice** is **at-least-once delivery plus idempotent processing**: every message carries a unique ID, and the receiver deduplicates on that ID (or uses an idempotent upsert) so that processing the same message twice has the same effect as processing it once. Kafka's own "exactly-once semantics" is explicitly scoped to Kafka-to-Kafka pipelines (via transactions), not an unconditional guarantee across arbitrary external systems.

## How would you design a distributed cache?

- **Partitioning**: shard keys across nodes with **consistent hashing** plus virtual nodes, so adding or removing one node only reshuffles roughly 1/N of the keys instead of nearly all of them — critical for a cache, since a full reshuffle on every scaling event would mean a cluster-wide cache stampede.
- **Replication**: replicate each key to a small number of nodes (2-3) so a single node failing doesn't wipe out that data from the cache entirely — for a cache this is purely an availability/hit-rate optimization, not a durability requirement, since the source of truth lives in the database behind it.
- **Eviction**: LRU as the sane default, LFU where popularity is genuinely stable over time, and a TTL as a safety net regardless of which eviction policy you pick, so stale data heals on its own even if nothing explicitly invalidates it.
- **Read/write pattern**: cache-aside is the default — the application reads the cache, falls back to the database on a miss and populates the cache, and on a write, updates the database then **deletes** (not updates) the cache key, which avoids two concurrent writers racing to leave a stale value behind.
- **Hot keys**: one extremely popular key (a trending item, a celebrity profile) can overload the single shard it hashes to, independent of total cluster load — mitigated with a small in-process cache layer in front of the distributed cache, or by replicating that one key across multiple shards (`key#0..N`) and merging reads.

See [Caching Strategies](../HLD/Fundamentals/08_Caching%20Strategies.md) for the full breakdown of invalidation races, stampede protection, and failure modes (penetration, avalanche) that apply directly here.

## How do you maintain ordering of events across multiple partitions?

**You generally don't — and the right move is realizing you usually don't need to.** A single global order across every partition requires either one sequencer (a single point of serialization and failure) or running consensus on every event (too slow at any real scale), so most systems deliberately give up on it.

What you keep instead is **per-key ordering**: Kafka routes every event for the same key to the same partition (via `hash(key) mod partitionCount`), guaranteeing all events about *that one entity* — one order, one user's session, one account — are delivered in the exact order they were produced. Events about two different keys, on two different partitions, have **no defined relative order**, and that's fine, because almost nothing in practice actually needs "did order #4821 or user #99's login happen first" answered.

If a feature genuinely needs cross-partition ordering, the options get progressively more expensive: **Lamport or vector clocks** to reconstruct a partial causal order after the fact (cheap, but only partial — concurrent events across partitions still have no defined order); or a **single ordered log for just the events that need it**, accepting that log as a bottleneck for that specific slice of traffic rather than the whole system. The practical skill here is scoping the ordering requirement down to "this one entity's events," not reaching for global ordering by default.

## How do you recover a distributed system after a network partition?

What recovery looks like depends entirely on which side of CAP the system chose while the partition was happening:

**For a CP system** (the minority side refused writes during the split): recovery is simple. The minority side has no new writes of its own — it just needs to catch up by replaying the log entries it missed from the majority side. There's nothing to reconcile, because nothing conflicting was ever created.

**For an AP system** (both sides kept accepting writes independently): recovery means **resolving real conflicts**, because both sides now have writes the other doesn't know about. Options, in increasing order of sophistication:
- **Last-write-wins**, by timestamp — simple, but can silently and permanently discard a legitimate concurrent write.
- **Version vectors**, to detect that two writes were genuinely concurrent (neither caused the other) rather than assuming one simply came later, and surface that to the application to merge.
- **CRDTs** (conflict-free replicated data types) — data structures specifically designed so that merging two divergent copies is mathematically guaranteed to converge to the same result, with no central decision needed at all.
- **Surfacing the conflict to a human**, the way Dropbox or Google Docs creates a "conflicted copy" file rather than guessing which version the user actually wanted.

In every case, recovery also includes **anti-entropy / read-repair** — background processes that compare replicas and push the newer data to the stale ones — and **re-establishing clean leadership and quorum membership**, rather than assuming whichever node was leader before the partition still is: if fencing tokens were in play, that old leader's authority may have already been invalidated, and it needs to rejoin as a follower, not resume as if nothing happened.

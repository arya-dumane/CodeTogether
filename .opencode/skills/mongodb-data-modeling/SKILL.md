---
name: mongodb-data-modeling
description: MongoDB and Mongoose data modeling - schema design, embedding versus referencing, indexes (ESR), query efficiency, validation, durability, and persistence of collaborative documents. Load when designing MongoDB schemas or reviewing MongoDB/Mongoose usage.
---

# MongoDB modeling & operations

Distilled from *MongoDB: The Definitive Guide* (Chodorow) and current MongoDB practice. The prime directive: **data that is accessed together is stored together** — model around query patterns, not around normalized entities.

## Embedding vs referencing

Embed when:
- The child is accessed with the parent in the same operations (order + its lines).
- The child has no meaning outside the parent.
- The set is **bounded and small** (tens, not thousands).
- You need atomic updates of parent+children (single-document updates are atomic).

Reference when:
- The set is unbounded or grows monotonically (events, comments, logs).
- The child is queried independently or shared by many parents.
- The parent is hot and the child churns (separating cuts write amplification).

Hybrid (extended reference): embed the few fields you always need with the reference (`{userId, userName}`), accept the update-fanout when the copied field changes — copy only slow-changing fields.

## Antipatterns

- **Unbounded arrays** — an array that grows forever (all events on a device doc): documents crawl toward the 16MB cap, every append rewrites more, indexes on the array bloat. Fix: one document per item, or the **bucket pattern** (one doc per device per hour/day with a capped array).
- **Treating MongoDB as relational** — normalizing everything into id-only docs and "joining" with `$lookup` per request. `$lookup` is for occasional analytics, not the hot path; if every read needs three lookups, the model is wrong (or the workload is relational — use Postgres).
- **Hot single document** — a global counter/config doc every request writes: document-level concurrency serializes on it. Shard the counter (N docs summed on read) or move it out.
- **Massive negation queries** — `$ne`/`$nin`/`$not` can't use indexes selectively.
- **Schemaless as no-schema** — "flexible schema" means the *application* owns the schema. Enforce it: schema validation (`$jsonSchema`) on collections, versioned migration strategy (schema-version field + lazy migration), typed structs in code.

## Indexing

- **ESR rule** for compound indexes: **E**quality fields first, then **S**ort fields, then **R**ange fields. `find({status: "A", ts: {$gt: x}}).sort({created: -1})` wants `{status: 1, created: -1, ts: 1}`.
- The prefix rule applies as in B-trees: `{a: 1, b: 1}` serves queries on `a`, not on `b` alone.
- Covered queries: all projected fields in the index → no document fetch.
- Every index costs writes and RAM (indexes must fit in working set). Review with `$indexStats`, drop unused.
- `explain("executionStats")`: `totalDocsExamined` should be close to `nReturned`; a big ratio means a scan or a bad index. `COLLSCAN` on a large collection in the hot path is a finding.
- Multikey (array) indexes: one entry per element — an index on a 1000-element array field writes 1000 entries per document.

## Durability & consistency

- Write concern is a per-operation choice: `w: "majority"` for anything you can't lose; `w: 1` accepts rollback on failover. Read concern/preference likewise: secondary reads are **stale reads** — use only where staleness is explicitly fine.
- Multi-document transactions exist but cost dearly; needing them everywhere is the "workload is relational" smell. Prefer models where the invariant lives inside one document (see embedding).
- Idempotent writes (upserts with deterministic `_id`) survive retries; `retryWrites=true` covers single ops, not read-modify-write races — use `findOneAndUpdate` with operators (`$inc`, `$push`) instead of read-then-set.

## Aggregation discipline

- `$match` and `$project` as early as possible (use indexes, shrink the stream); `$lookup`/`$unwind` late and rarely.
- Pipelines that reshape entire collections on the hot path are ETL in disguise — precompute (materialized view pattern: incremental `$merge`) instead.
- `allowDiskUse` is a confession that the pipeline outgrew RAM — fine for batch, a bug in request paths.

## Mongoose schema design

- Define an explicit Mongoose schema for every collection; avoid `strict: false` on documents that accept user input.
- Model required fields, enums, string length limits, numeric ranges, and defaults in the schema so invalid data fails at the application boundary.
- Use subdocuments for bounded, parent-owned data; use `ref` plus `populate` only when the child is queried or shared independently.
- Store timestamps with `timestamps: true` and use them for ordering and pagination instead of ad-hoc date fields.
- Add a schema-version field for documents whose shape will evolve, and migrate lazily or in batches.
- Keep virtuals and transforms out of persistence logic; serialize deliberately at the API boundary so internal fields are not leaked.

## Query efficiency

- Select only the fields a response needs (`select`, projection) and use `.lean()` for read-only queries that do not need Mongoose documents.
- Paginate with a bounded `limit` and a cursor or indexed sort; never return an unbounded collection.
- Avoid `populate` in hot paths when an embedded summary or a batched lookup is cheaper.
- Verify new query shapes with `explain("executionStats")`; `totalDocsExamined` should stay close to `nReturned`.
- Index the fields used by filters, sorts, and unique constraints; remove indexes that no query uses.
- Use `findOneAndUpdate` with update operators for atomic changes instead of read-modify-write.

## Collaborative document persistence

- Store the canonical collaborative state (for example an encoded Yjs snapshot) in one document per project document, alongside metadata such as owner, members, language, and updated time.
- Persist debounced snapshots and flush on last-client-disconnect or shutdown; do not write on every keystroke or awareness event.
- Keep incremental updates bounded and compact them into a snapshot periodically so the document does not grow without limit.
- Add a version or revision field and use conditional updates to detect conflicting writers.
- Keep ephemeral presence, cursors, and typing state out of MongoDB, or store them with a short TTL if persistence is required.
- Validate that the writer is authorized for the project before saving, and load the persisted snapshot before accepting new edits.
- Use `w: "majority"` for saves that must survive failover, and test recovery from a process restart.

## Checklist

- [ ] Every collection's design justified by its top queries (written down), not by entity purity.
- [ ] No unbounded arrays; growth paths named for every embedded set.
- [ ] Compound indexes follow ESR; `explain` ratios checked on new hot queries.
- [ ] Write/read concerns explicit per operation class; stale-read tolerance documented.
- [ ] Schema validation active; schema version field present from day one.
- [ ] Mongoose schemas enforce required fields, types, enums, and bounds; `strict` is not disabled for user input.
- [ ] Collaborative snapshots are debounced and compacted; no per-keystroke or awareness writes.
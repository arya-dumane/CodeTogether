# CodeTogether

CodeTogether is a collaborative coding and learning platform. **Phase 4B** adds live room presence
over Socket.IO on top of the Phase 4A private coding rooms, Phase 3 learning paths, and Phase 2A/2B
authentication and project foundations.

Live shared editing, cursors, room chat, challenges, AI features, and code execution are **not
implemented** and remain labelled as placeholders in the interface.

## What works

- Account registration, login, logout, and current-user lookup
- Passwords hashed with bcrypt (cost factor 12); plaintext passwords are never stored
- Server-managed sessions persisted in MongoDB with HTTP-only cookies and a 7-day rolling expiry
- Session ID rotation on registration/login and server-side invalidation on logout
- Session-bound CSRF tokens for all state-changing requests
- Generic credential errors and dummy hash checks for unknown accounts
- Credentialed CORS restricted to an explicit origin allowlist
- Auth-specific rate limiting plus a general API rate limit
- React login/register pages with validation, loading, error, and success feedback
- Shared authentication state with protected dashboard routes and login redirects
- Logout with immediate redirect and server-side session destruction
- Project CRUD (`list`, `create`, `read`, `update`, `delete`) scoped to the authenticated owner
- Project validation on both client and server, with strict rejection of unknown/protected fields
- Projects dashboard with loading, empty, error, and success states
- Project detail view with inline editing and delete confirmation
- Published learning path catalog with search, difficulty, and category filters
- Learning path detail view with ordered modules, expandable lessons, and lesson content
- One-click enrollment with idempotent, per-user lesson completion and live progress percentages
- Dashboard learning-progress card with resume links and aggregate completion stats
- Private coding rooms with generated invite codes, owner/member roles, and join/leave flows
- Room management for owners: edit, rotate the invite code, archive/reactivate, and delete
- Member-scoped room lists and details; invite codes and member names are never exposed in list summaries
- Optional room links to an owner's project and to published learning paths
- Idempotent, duplicate-safe room joins with rate limiting on failed invite-code attempts
- Real-time room presence over Socket.IO using the existing server-side session cookie
- Live online indicators in the room members panel, with one presence entry per user across multiple tabs
- Presence snapshots after reconnect and deterministic joined/left events on online-state transitions
- Immediate presence revocation on leave, archive, delete, and logout; periodic session revalidation
- Socket handshake origin checks, membership revalidation, payload limits, and per-socket action limits
- Idempotent, deterministic seed data for four curated paths (safe to re-run without losing progress)
- Health check, security headers, structured validation, and centralized error handling

## Project structure

```
codetogether/
├── client/                       # React + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/             # RequireAuth / GuestOnly route guards
│   │   │   ├── dashboard/        # API health and learning-progress cards
│   │   │   ├── learning-paths/   # Path cards, badges, and progress bar
│   │   │   ├── marketing/        # Landing-page illustration
│   │   │   ├── projects/         # Project card and create/edit form
│   │   │   ├── rooms/            # Room card and create/edit form
│   │   │   └── ui/               # Shared form, notice, button, and layout components
│   │   ├── hooks/                # Auth, health, project, path, room, and presence hooks
│   │   ├── layouts/              # Public, auth, and dashboard layouts
│   │   ├── lib/api/              # Typed API client, auth, project, path, room, health calls
│   │   ├── lib/realtime/         # Socket.IO client and typed presence event contracts
│   │   ├── pages/                # Landing, auth, overview, projects, paths, rooms, placeholders
│   │   └── main.tsx
│   └── .env.example
├── server/                       # Express + TypeScript + Mongoose
│   ├── src/
│   │   ├── config/               # Environment and session configuration
│   │   ├── controllers/          # Auth, health, project, learning-path, and room handlers
│   │   ├── db/                   # MongoDB lifecycle and duplicate-key helper
│   │   ├── errors/               # Typed application errors
│   │   ├── lib/                  # Password hashing helpers
│   │   ├── middleware/           # Auth, CSRF, validation, rate limits, errors
│   │   ├── models/               # User, Project, LearningPath, LearningProgress, and Room models
│   │   ├── realtime/             # Socket.IO server, presence registry, and typed event contracts
│   │   ├── routes/               # Health, auth, project, learning-path, and room routers
│   │   ├── schemas/              # Zod request schemas
│   │   ├── seed/                 # Deterministic learning-path seed script
│   │   ├── services/             # Auth, session, project, path, room, and health logic
│   │   └── types/                # Express session type augmentation
│   ├── tests/                    # Health, CORS, validation, auth, project, path, room, and realtime tests
│   └── .env.example
└── package.json                  # npm workspaces and root scripts
```

## Prerequisites

- Node.js 20 or newer (Node 22+ recommended)
- npm 10 or newer
- MongoDB 7 or newer, running before starting the API or the test suite

Verified locally with Node.js `26.3.1`, npm `11.16.0`, and MongoDB `8.2.6`.

## Setup

From the repository root:

```powershell
npm install
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

For development, update `SESSION_SECRET` in `server/.env` and leave the remaining defaults in
place. `client/.env` can stay empty so Vite proxies `/api` to the server. `.env` files are ignored by
Git; only `.env.example` files are committed.

Seed the curated learning paths after MongoDB is running:

```powershell
npm run seed
```

Seeding upserts by `slug`, uses deterministic module and lesson ObjectIds, and does not delete learner
progress. Run `npm run seed:reset` to delete all learning paths and progress first; the reset path
refuses to run when `NODE_ENV=production`.

## Running

Use two terminals from the repository root:

```bash
npm run dev:server
npm run dev:client
```

- Frontend: http://localhost:5173
- API: http://localhost:4000
- Health: http://localhost:4000/api/v1/health

The client API base defaults to the Vite proxy, which also proxies `/socket.io` with WebSocket
upgrades. In production, set `VITE_API_URL` at build time if the client and API are on different
origins; the Socket.IO client uses that URL's origin. The reverse proxy must forward `/socket.io`
WebSocket upgrades and the `ct.sid` cookie. Build and start a production-style server with:

```bash
npm run build
npm run start --workspace server
npm run preview --workspace client
```

## Verification

```bash
npm run typecheck
npm run build
npm test
npm audit --audit-level=high
```

`npm test` uses an isolated MongoDB database named `codetogether_test`. The suite refuses to run if
the configured database name does not end in `_test`; each suite clears the collections it uses
(users, projects, learning paths, progress, rooms, and sessions) between tests, and the test database
is dropped afterward. MongoDB must be running locally, or `MONGODB_URI` must point at a dedicated test
server.

The current suite covers health, 404s, CORS, malformed JSON, validation middleware, registration,
duplicate accounts, password hashing, invalid input, successful and failed login, current-user
session behavior, forged cookies, logout/session replay, cookie flags, session and CSRF rotation,
CSRF rejection, authentication rate limiting, safe error responses, project creation and validation,
owner-scoped listing, project read/update/delete, invalid project IDs, unauthenticated project
requests, CSRF enforcement on project mutations, unknown/protected project fields (including owner
reassignment), cross-account isolation, learning-path listing and ordering, unpublished access,
enrollment idempotency, completion percentages, duplicate completion deduplication, invalid lesson
and path IDs, CSRF enforcement on path mutations, empty paths, cross-account progress isolation, room
creation and validation, membership invariants, member-scoped listing and detail access, owner-only
updates and deletion, invite-code joins and rotation, duplicate and archived-room join behavior,
owner-leave rejection, linked project/path ownership rules, room CSRF and authentication enforcement,
failed-join rate limiting, Socket.IO session and origin rejection, presence snapshots, multiple tabs,
reconnect snapshots, malformed and unsupported socket events, live-action rate limiting, leave and
room-archive/delete revocation, logout and session-expiry disconnects, and two-room isolation.

Latest verification run (Node `26.3.1`, npm `11.16.0`, MongoDB `8.2.6`, local test database):

| Command | Result |
|---|---|
| `npm run typecheck` | Passed (server and client) |
| `npm run build` | Passed (server compile and Vite production build) |
| `npm test` | Passed: 7 files, 79 tests |
| `npm audit --audit-level=high` | Passed: 0 vulnerabilities |

These commands were executed against a running local MongoDB. Realtime behavior is covered by
integration tests using real `socket.io-client` connections and session cookies. Browser-based manual
checks were not automated in this phase; the frontend is verified by typecheck and production build.

## Environment variables

### Server (`server/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Runtime mode; `production` enables Secure cookies |
| `PORT` | `4000` | API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/codetogether` | MongoDB connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated exact trusted origins for HTTP and Socket.IO |
| `SESSION_SECRET` | development-only value | Session signing secret; minimum 32 characters |
| `COOKIE_SAME_SITE` | `lax` | `lax`, `strict`, or `none`; `none` requires production/Secure |
| `TRUST_PROXY` | `false` | Set `true` behind a trusted TLS-terminating reverse proxy |

In production the API refuses to start with either the development default or the example
placeholder session secret. Generate a unique, random secret per environment (for example 64 hex
characters) and store it in the deployment secret manager. Never reuse development secrets in
production.

Both `.env` files are git-ignored. Only `VITE_*` values are exposed to the browser, so never place
server secrets in a `VITE_*` variable.

### Client (`client/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | empty | Public API base URL; empty uses the Vite proxy for `/api/v1` and `/socket.io` |

## Authentication behavior

- **Password storage:** bcrypt with cost factor 12. Registration requires 12-128 characters.
  Password hashes use `select: false`, are removed by serializers, and never appear in responses.
- **Email normalization:** emails are trimmed and lowercased before validation and storage, with a
  unique index preventing duplicate accounts.
- **Session cookie:** `ct.sid`, `HttpOnly`, `Path=/`, `SameSite=Lax` by default, `Secure` when
  `NODE_ENV=production`, and a 7-day rolling expiry.
- **Session storage:** `connect-mongo` writes sessions to the `sessions` collection with a native
  MongoDB TTL index. Session IDs are never stored in localStorage, sessionStorage, or client-readable
  cookies.
- **Rotation:** registration and login regenerate the session ID before storing the user ID, which
  prevents session fixation. The CSRF token is also rotated.
- **Current user:** `GET /api/v1/auth/me` requires a valid server session and returns the public
  user record.
- **Logout:** destroys the server-side session, clears the cookie, and makes a replayed session
  cookie invalid.
- **CSRF:** `GET /api/v1/auth/csrf` creates a session-bound token. Every `POST`, `PUT`, `PATCH`,
  and `DELETE` must send it in `X-CSRF-Token`; tokens from another session are rejected. The browser client keeps
  the token in memory and refreshes it automatically once on a CSRF failure.
- **Generic failures:** login always returns `Invalid email or password`, whether the account does
  not exist or the password is wrong. Unknown accounts still perform a dummy bcrypt comparison to
  reduce timing differences.
- **Rate limiting:** registration/login allow 20 failed attempts per 15 minutes per IP. Successful
  requests are not counted. The general API limit is 300 requests per 15 minutes.

## API

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Service, uptime, and MongoDB connection status |

### Authentication

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/auth/csrf` | Create/return the session-bound CSRF token |
| `POST` | `/api/v1/auth/register` | Create an account and start a session |
| `POST` | `/api/v1/auth/login` | Authenticate and start a session |
| `GET` | `/api/v1/auth/me` | Return the current authenticated user (protected) |
| `POST` | `/api/v1/auth/logout` | Destroy the session and clear the cookie |

Registration body: `{ "email", "password", "displayName" }`. Login body:
`{ "email", "password" }`. Successful registration/login responses include the public user and a
new `csrfToken`.

Example registration flow:

```text
GET  /api/v1/auth/csrf         -> { data: { csrfToken } } and a ct.sid cookie
POST /api/v1/auth/register     -> 201 { data: { user, csrfToken } }; new ct.sid cookie
GET  /api/v1/auth/me           -> 200 { data: { user } }
POST /api/v1/auth/logout       -> 204; server session destroyed and cookie cleared
```

Errors use a consistent envelope: `{ "error": { "code", "message", "details"? } }`.

### Projects

Every project endpoint requires an authenticated session. `POST`, `PATCH`, and `DELETE` also require
the session-bound `X-CSRF-Token` header. Projects are always scoped to the authenticated owner; the
client never supplies or changes an owner ID.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/projects` | List the authenticated user's projects |
| `POST` | `/api/v1/projects` | Create a project owned by the authenticated user |
| `GET` | `/api/v1/projects/:projectId` | Return an owned project |
| `PATCH` | `/api/v1/projects/:projectId` | Update an owned project's name and/or description |
| `DELETE` | `/api/v1/projects/:projectId` | Delete an owned project |

Create body: `{ "name": "My project", "description": "Optional text" }`. Update body accepts
`name` and/or `description`; at least one field is required. Responses:

```text
GET    /api/v1/projects             -> 200 { data: { projects: [...] } }
POST   /api/v1/projects             -> 201 { data: { project } }
GET    /api/v1/projects/:projectId  -> 200 { data: { project } }
PATCH  /api/v1/projects/:projectId  -> 200 { data: { project } }
DELETE /api/v1/projects/:projectId  -> 204
```

A project response contains `id`, `ownerId`, `name`, `description`, `createdAt`, and `updatedAt`.
Project responses are sent with `Cache-Control: no-store` to avoid caching private data.

#### Project validation and ownership

- `name` is required, trimmed, and limited to 120 characters.
- `description` is optional, trimmed, and limited to 2,000 characters; a missing description is
  stored as an empty string.
- Request bodies are strict Zod objects. Unknown fields, `owner`, `ownerId`, `_id`, timestamps, and
  other protected fields are rejected with `400 VALIDATION_ERROR`.
- `projectId` must be a 24-character hexadecimal ObjectId; malformed IDs return
  `400 VALIDATION_ERROR`.
- Reads and mutations use `{ _id, owner }` filters. A project owned by another user is treated as
  non-existent: `404 NOT_FOUND` with `Project not found`, never `403`, so existence is not disclosed.
- Creating a project with a client-supplied owner is rejected; ownership always comes from the
  session. Update operations build an explicit `$set` from validated fields, preventing mass
  assignment.
- Projects are indexed by `{ owner: 1, updatedAt: -1 }` to support owner-scoped listing sorted by
  recent updates.
- Project lists and details are limited to the current user; no pagination is implemented yet. The
  application-level rate limit (300 requests per 15 minutes) applies to project routes as well.

### Learning paths

Catalog reads are public; enrollment and progress endpoints require an authenticated session.
`POST`, `PUT`, and `DELETE` also require the session-bound `X-CSRF-Token` header.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/learning-paths` | List published path summaries ordered by title |
| `GET` | `/api/v1/learning-paths/:pathId` | Return a published path with ordered modules and lessons |
| `GET` | `/api/v1/learning-paths/progress` | List the current user's enrollments with progress (protected) |
| `POST` | `/api/v1/learning-paths/:pathId/enroll` | Enroll the current user (idempotent; protected) |
| `GET` | `/api/v1/learning-paths/:pathId/progress` | Return the current user's progress for one path (protected) |
| `PUT` | `/api/v1/learning-paths/:pathId/lessons/:lessonId/complete` | Mark a lesson complete (protected) |
| `DELETE` | `/api/v1/learning-paths/:pathId/lessons/:lessonId/complete` | Mark a lesson incomplete (protected) |

Responses:

```text
GET    /api/v1/learning-paths                          -> 200 { data: { paths } }
GET    /api/v1/learning-paths/:pathId                   -> 200 { data: { path } }
GET    /api/v1/learning-paths/progress                  -> 200 { data: { enrollments } }
POST   /api/v1/learning-paths/:pathId/enroll            -> 201 first enrol / 200 repeat { data: { progress } }
GET    /api/v1/learning-paths/:pathId/progress          -> 200 { data: { progress } }
PUT    /api/v1/learning-paths/:pathId/lessons/:id/complete   -> 200 { data: { progress } }
DELETE /api/v1/learning-paths/:pathId/lessons/:id/complete   -> 200 { data: { progress } }
```

A path summary contains `id`, `slug`, `title`, `shortDescription`, `difficulty`, `category`,
`estimatedDurationMinutes`, `moduleCount`, and `lessonCount`. Path detail adds
`detailedDescription` and ordered `modules` with lesson content. A progress object contains
`pathId`, `enrolled`, `completedLessons`, `completedCount`, `totalLessons`, `percentage`,
`enrolledAt`, `lastActivityAt`, and `completedAt`.

#### Learning path behavior

- Only `published` paths are visible. Unknown, malformed, or unpublished IDs return
  `404 NOT_FOUND`.
- Progress is unique per `{ user, learningPath }`; the owner always comes from the session, never the
  request body or query.
- Enrolling twice returns the existing progress instead of creating a duplicate. Concurrent enrollment
  races are handled by the unique index.
- `GET .../progress` returns `200` with `enrolled: false` for a path the user has not enrolled in.
  Marking a lesson complete or incomplete without enrollment returns `409 NOT_ENROLLED`.
- Completion and uncompletion are idempotent (`$addToSet` / `$pull`) and only accept lesson IDs that
  belong to the requested path. Foreign lesson IDs return `404`.
- Percentages are computed on the server from the number of valid completed lessons, rounded, and
  capped at 100. Empty paths report `0%`.
- `completedAt` is set when every lesson is complete and cleared when a lesson is marked incomplete.
- Progress responses use `Cache-Control: no-store`. The dashboard progress list is sorted by most
  recent activity.
- Seeded content uses deterministic module and lesson ObjectIds, so re-running `npm run seed` updates
  path content in place without breaking learner progress.

### Rooms

Every room endpoint requires an authenticated session. Reading or changing a specific room requires
membership in that room. `POST`, `PATCH`, and `DELETE` also require the session-bound `X-CSRF-Token`
header. Rooms owned by another user, rooms the user has not joined, unknown room IDs, and malformed
IDs follow the same non-disclosing pattern:
`404 NOT_FOUND` for inaccessible or missing rooms, `400 VALIDATION_ERROR` for malformed IDs.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/rooms` | List rooms the current user belongs to |
| `POST` | `/api/v1/rooms` | Create a room with the current user as owner |
| `POST` | `/api/v1/rooms/join` | Join a room with an invite code |
| `GET` | `/api/v1/rooms/:roomId` | Return room details to a member |
| `PATCH` | `/api/v1/rooms/:roomId` | Update an owned room (owner only) |
| `DELETE` | `/api/v1/rooms/:roomId` | Delete an owned room (owner only) |
| `POST` | `/api/v1/rooms/:roomId/leave` | Leave a room (members only) |
| `POST` | `/api/v1/rooms/:roomId/invite-code/rotate` | Replace the invite code (owner only) |

Create body: `{ "name", "description?", "projectId?", "learningPathId?" }`. Update body accepts any
of `name`, `description`, `status` (`active` or `archived`), `projectId`, and `learningPathId`; at
least one field is required. Sending `null` for `projectId` or `learningPathId` clears that link.
Join body: `{ "inviteCode" }`. Responses:

```text
GET    /api/v1/rooms                              -> 200 { data: { rooms } }
POST   /api/v1/rooms                              -> 201 { data: { room } }
POST   /api/v1/rooms/join                         -> 200 { data: { room, alreadyMember } }
GET    /api/v1/rooms/:roomId                      -> 200 { data: { room } }
PATCH  /api/v1/rooms/:roomId                      -> 200 { data: { room } }
DELETE /api/v1/rooms/:roomId                      -> 204
POST   /api/v1/rooms/:roomId/leave                -> 204
POST   /api/v1/rooms/:roomId/invite-code/rotate   -> 200 { data: { room } }
```

A room summary contains `id`, `name`, `description`, `status`, `ownerId`, `memberCount`,
`viewerRole`, `hasLinkedProject`, `hasLinkedLearningPath`, `createdAt`, and `updatedAt`. List
summaries deliberately omit the invite code and member list. Room detail adds `inviteCode`, `members`
(`userId`, `displayName`, `role`, `joinedAt`), and `linkedProject` / `linkedLearningPath` summaries.
Member names and the invite code are only returned to members. A linked project summary is only
returned to the room owner who owns that project; members see `hasLinkedProject: true` without the
project name. Published linked learning paths are visible to every member.

#### Room behavior

- Room creation generates a 32-character hexadecimal invite code with a database unique index and
  retries on collision. The owner is always inserted as the single `owner`-role member.
- The model rejects rooms with a missing owner member, duplicate member user IDs, or more than one
  owner-role member. Client-supplied `owner`, `members`, roles, invite codes, timestamps, and unknown
  fields are rejected by strict Zod schemas.
- Project links must reference a project owned by the room creator/owner. Learning-path links must
  reference a published path. Invalid links return specific `400` validation errors without exposing
  other users' data.
- Joining is idempotent. A repeat join returns `200` with `alreadyMember: true`; concurrent joins use
  an atomic `members.user: { $ne: userId }` filter with `$push`, so the unique-member invariant holds
  under races.
- Archived rooms reject new joins with `409 ROOM_ARCHIVED`; existing members keep access. Owners can
  reactivate the room from the detail view.
- Owners cannot leave their own room; the API returns `409 OWNER_CANNOT_LEAVE`. Members can leave,
  after which the room is no longer readable or listed for them.
- Rotating the invite code invalidates the previous code immediately; existing members remain in the
  room. Rotation, status changes, updates, and deletion are owner-only.
- Room deletion hard-deletes room metadata and membership. Linked projects and learning paths are
  independent resources and are never deleted with the room.
- Failed invite-code joins are rate limited to 20 attempts per 15 minutes per IP; successful joins
  are not counted. Rate-limited requests return `429 ROOM_JOIN_RATE_LIMITED`.
- Room responses use `Cache-Control: no-store` and are scoped to the current session user. The
  application-level API limit (300 requests per 15 minutes) still applies.

### Real-time room presence

Presence uses Socket.IO on the same HTTP server at `/socket.io`. The socket handshake authenticates
only with the existing `ct.sid` session cookie; client-supplied user IDs, roles, or room memberships
are never accepted. Handshakes without a valid server session fail with an `UNAUTHENTICATED` error.
The `CORS_ORIGINS` allowlist is enforced for Socket.IO handshakes, including WebSocket upgrades.

Client-to-server events:

| Event | Payload | Description |
|---|---|---|
| `room:join` | `{ "roomId": "<24-char ObjectId>" }` | Join a room's presence channel |
| `room:leave` | `{ "roomId": "<24-char ObjectId>" }` | Leave a room's presence channel |

Server-to-client events:

| Event | Payload | Description |
|---|---|---|
| `presence:snapshot` | `{ roomId, onlineMembers }` | Current online members, sent to the joining socket |
| `presence:member_joined` | `{ roomId, member }` | A user became online in the room |
| `presence:member_left` | `{ roomId, member }` | A user's last connection left the room |
| `room:access_revoked` | `{ roomId, reason }` | Presence access ended; reason is `MEMBERSHIP_REVOKED`, `ROOM_ARCHIVED`, `ROOM_DELETED`, or `SESSION_ENDED` |
| `presence:error` | `{ code, message }` | Safe real-time error when no acknowledgement is available |

`room:join` and `room:leave` accept an optional acknowledgement callback. Results use
`{ ok: true }` or `{ ok: false, error: { code, message } }`. A successful join emits a snapshot
before the acknowledgement. Member payloads contain only `userId` and `displayName`; room roles,
invite codes, and linked work remain REST-only.

Presence behavior:

- Each join revalidates the session and reloads room membership and status from MongoDB. Non-members,
  unknown rooms, and malformed IDs receive the same safe `NOT_FOUND`/`INVALID_PAYLOAD` errors used by
  the REST API, without disclosing room existence.
- Archived rooms reject presence joins with `ROOM_ARCHIVED`, even for existing members. Existing
  presence is closed when an owner archives the room, and reactivation allows members to rejoin.
- Multiple connections from the same user are tracked per socket. One online entry is shown per user,
  `presence:member_joined` is emitted only on the first connection, and `presence:member_left` only
  after the last connection closes.
- Disconnects remove only that socket's participation. Socket.IO's built-in heartbeat detects dead
  connections; the client automatically reconnects and requests a fresh snapshot after reconnecting.
- Leaving a room, archiving or deleting it, and logging out revoke affected presence immediately.
  Active sessions are also revalidated against the session store every 30 seconds so expired sessions
  are disconnected even without an explicit logout.
- Socket payloads are limited to 16 KB. Each socket may perform at most 20 room join/leave actions per
  10 seconds; excess actions receive `RATE_LIMITED`. Unsupported events are rejected with
  `UNSUPPORTED_EVENT`.
- Presence is ephemeral and held in process memory. MongoDB remains the source of truth for room
  membership and room status. No presence records are persisted.
- The room detail members panel shows an online count, per-member online indicators, and a paused
  presence state for archived rooms. No chat, cursors, shared editing, or document synchronization is
  included in this phase.

## MongoDB setup and behavior

Start MongoDB before using authentication or the test suite. The default connection string targets
`mongodb://127.0.0.1:27017/codetogether`; MongoDB creates the database on first write.

- **Connected:** health returns `status: "ok"` and `database.status: "connected"`.
- **Unavailable in development:** the API still listens and health reports `degraded`; auth requests
  fail safely because users and sessions require persistence.
- **Unavailable in production:** the process exits after the initial connection failure.
- No in-memory database fallback is used.

Use a least-privilege database user scoped to the application database in deployed environments.

## Production and cookie requirements

- Serve the app over HTTPS. In production the session cookie is marked `Secure`.
- Set `SESSION_SECRET` to a unique secret of at least 32 characters.
- Set `TRUST_PROXY=true` when TLS terminates at a trusted reverse proxy so Express recognizes the
  request as secure.
- Keep `CORS_ORIGINS` to exact HTTPS origins. Credentials cannot be combined with wildcard origins.
- If the frontend and API are on different **sites** (not merely subdomains), set
  `COOKIE_SAME_SITE=none`; this is only accepted in production because Secure cookies are required.
  Same-site subdomain deployments can keep `lax`.
- Set `VITE_API_URL` to the public API base URL at build time when it is not proxied on the same
  origin.
- Deploy the server behind rate limiting at the edge as well as the built-in application limits.

## Security decisions

- Passwords are hashed with bcrypt and excluded from queries and responses by default.
- Sessions are server-side, HTTP-only, rotated on authentication, and destroyed on logout.
- CSRF tokens are random, session-bound, compared in constant time, and required on unsafe methods.
- Login responses are generic and include a dummy password check to reduce account enumeration.
- All auth request bodies, parameters, and queries are validated with strict Zod schemas.
- Unknown errors return a generic message without stack traces or database details.
- Passwords, hashes, session IDs, and environment values are not logged or returned.
- Health responses never expose the database URI or other environment values.
- CORS uses an explicit allowlist with credentials; unknown origins receive HTTP 403.
- No localStorage, sessionStorage, or client-readable auth tokens are used.
- Project queries always include the session-derived owner ID; ownership never comes from the client.
- Other users' projects return `404` rather than `403` to avoid disclosing that they exist.
- Project updates whitelist fields explicitly, preventing mass assignment and owner reassignment.
- Learning-path enrollment and progress are bound to the session user; progress records are unique per
  user and path, and clients cannot supply a user ID.
- Only published learning paths and lessons from the requested path are exposed; lesson IDs are
  validated against that path before progress changes.
- Room reads and mutations are scoped by session-derived membership; non-members and inaccessible
  rooms receive `404` without leaking room existence.
- Invite codes are cryptographically random, unique at the database level, visible only in member
  detail responses, and rotatable by the owner. Failed joins are rate limited.
- Room ownership comes only from the server session. Clients cannot assign owners, members, roles,
  invite codes, or other protected fields. Linked projects must be owned by the room owner.
- Owner membership cannot be removed through the leave endpoint, and room deletion is owner-only.
- Socket handshakes reuse the server-side session cookie and reject unauthenticated connections;
  socket events contain no client-supplied identity.
- Every presence join rechecks MongoDB membership and room status, and the trusted origin allowlist is
  applied to Socket.IO handshakes as well as HTTP requests.
- Presence payloads use strict room-ID validation, a 16 KB frame limit, per-socket action limits,
  and safe error codes. Presence is never used for authorization; REST and the database remain
  authoritative.
- Presence access is revoked on leave, archive, delete, logout, and session expiry to prevent stale
  real-time membership.

## Known limitations

- No email verification, password reset, OAuth, multi-factor authentication, or account deletion.
- No project collaborators or sharing; every project is private to its owner.
- Project, learning-path, and room listings have no pagination or sorting controls.
- Learning paths are read-only seeded content: there is no authoring/admin UI, cohort scheduling,
  deadlines, certificates, or per-lesson submissions.
- Rooms provide membership, invite codes, roles, linked-work context, and online presence only. There
  is no shared editor, cursors, voice, room chat, or owner-initiated member removal.
- Presence is per server process and held in memory. Horizontal scaling requires a shared Socket.IO
  adapter (for example Redis) plus sticky sessions; that deployment work is not implemented.
- Presence shows online/offline room membership only; idle, away, typing, and cursor states are not
  implemented.
- No challenges, AI features, live collaborative editing, or code execution.
- Sessions use a single collection and there is no per-device session management UI.
- Registration conflict status can reveal that an email is in use; the message itself is generic.
- Frontend verification is typecheck and production build only; there is no automated browser E2E
  suite yet, and no browser-based manual check is claimed in this phase.
- API and realtime integration tests require a running MongoDB instance.

## Recommended next milestone

Phase 4C: shared room editing. Room membership, roles, linked-work context, and live presence are now
in place; layer shared document persistence (Monaco + Yjs), collaborative text synchronization,
cursors/selections, reconnect and conflict handling, and room chat on top of the stable session,
authorization, validation, and realtime foundation. Do not add a second authentication system.

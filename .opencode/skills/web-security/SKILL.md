---
name: web-security
description: Secure full-stack web application development for React, Express, MongoDB, and Socket.IO. Use when implementing or reviewing authentication, sessions, authorization, input validation, CORS, rate limiting, database security, WebSocket permissions, secrets management, or sandboxed code execution.
---

# Web Application Security

## Scope
Secure the CodeTogether React, Express, MongoDB, and Socket.IO application. Apply these rules on the server; client-side checks are usability aids, never the security boundary.

## Authentication and sessions
- Hash passwords with a modern password hashing algorithm (bcrypt, scrypt, or Argon2) using a per-user salt and a cost factor appropriate for production hardware.
- Never store or log plaintext passwords, password hashes, session tokens, or password-reset tokens.
- Use server-side sessions or signed tokens with a documented lifetime. Rotate the session identifier after login and privilege changes to prevent session fixation.
- Store session cookies with `HttpOnly`, `Secure` in production, `SameSite=Lax` or `Strict`, and an explicit `Path`.
- Validate credentials with a uniform error response and constant-time comparison where applicable; avoid revealing whether an account exists.
- Implement logout that invalidates server-side session state, not just the cookie.
- Protect state-changing requests from CSRF (SameSite cookies plus a CSRF token where the flow requires it).

## Authorization
- Enforce authorization on the server for every private project, document, and room.
- Derive the acting user from the authenticated session; never trust a user ID supplied in the request body or query string.
- Check ownership or explicit membership before returning, updating, or deleting a project or document.
- Centralize access checks in middleware or service helpers so every route uses the same rule.
- Return `403` for authenticated-but-forbidden and `404` where revealing existence itself is sensitive.

## Input validation
- Validate every request body, query parameter, route parameter, and WebSocket payload against an explicit schema before use.
- Reject unknown fields and enforce type, length, format, and range constraints.
- Treat all user content (code, filenames, chat messages, display names) as untrusted; escape or sanitize it at the appropriate output boundary.
- Use parameterized MongoDB queries and reject objects containing keys such as `$where`, `$gt`, or `__proto__` where an operator is not expected.
- Validate identifiers (ObjectId format, room IDs) before querying or joining.

## CORS
- Configure CORS with an explicit allowlist of trusted origins. Do not combine wildcard origins with credentials.
- Restrict allowed methods and headers to what the application actually uses.
- Treat `Origin` as untrusted input; compare against configured values, not prefix or substring matches.

## Rate limiting and abuse prevention
- Apply rate limits to authentication, registration, password reset, room creation, chat, and code execution.
- Key limits by a combination of IP and authenticated user where possible.
- Return `429` with a retry hint and log repeated failures without logging credentials.
- Add request size limits and timeouts to prevent resource exhaustion.

## MongoDB security
- Connect with a least-privilege database user scoped to the application database.
- Keep credentials in environment variables or a secrets manager, never in source control.
- Use schema validation and Mongoose schema constraints so malformed data cannot be persisted.
- Avoid exposing raw database errors or stack traces; map them to safe client responses.
- Constrain query result sizes and pagination to prevent unbounded reads.

## Socket.IO authorization
- Authenticate the Socket.IO connection during the handshake using the session or token; reject unauthenticated sockets.
- Authorize room membership server-side on `join`, and re-check authorization for every room-scoped event.
- Validate and schema-check all event payloads; ignore unknown events.
- Do not broadcast private documents, chat, or presence to sockets that have not been authorized for that room.
- Clean up room membership, presence, and listeners on disconnect.
- Rate-limit socket events that can be triggered frequently.

## Secrets management
- Keep API keys, database URIs, session secrets, and signing keys outside source control.
- Load secrets from environment variables or a secrets manager and validate required values at startup.
- Use different secrets per environment; never reuse production secrets in development.
- Do not include secrets in client bundles, error messages, logs, or repository history.

## Sandboxed code execution
- Never execute arbitrary user code directly inside the application server process.
- Run untrusted code in an isolated worker or container with CPU, memory, wall-clock, output-size, file-system, and network restrictions.
- Drop privileges, use a read-only filesystem, and give each execution a fresh environment.
- Enforce a hard timeout and kill orphaned processes.
- Stream and cap output; do not return unbounded stdout or stderr.
- Require authentication and authorization before executing code in a room, and rate-limit executions per user.

## Review checklist
- [ ] Can an unauthenticated user access protected resources?
- [ ] Can one user read or edit another user's private project?
- [ ] Can an unauthorized user join a private coding room or subscribe to its events?
- [ ] Are passwords hashed and sessions rotated and invalidated correctly?
- [ ] Is every request and socket payload validated against a schema?
- [ ] Are CORS origins, methods, and headers explicit and minimal?
- [ ] Are authentication, room creation, chat, and execution rate-limited?
- [ ] Are secrets absent from source control, logs, responses, and client bundles?
- [ ] Is user code executed only in an isolated environment with resource limits?
- [ ] Do errors avoid leaking stack traces, secrets, or internal details?

## Workflow
1. Inspect the existing implementation.
2. Identify risks and their severity.
3. Propose minimal, targeted fixes.
4. Add or update tests for negative and unauthorized cases.
5. Verify changes and report remaining risks.

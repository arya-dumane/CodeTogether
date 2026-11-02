---
name: realtime-collaboration
description: Build real-time collaborative web applications with React, Monaco Editor, Yjs, and Socket.IO. Use when implementing shared code editing, concurrent document synchronization, live cursors, presence, chat, reconnect handling, conflict resolution, or collaborative document persistence in a Node.js and MongoDB stack.
---

# Real-Time Collaboration

## Technology
- React and TypeScript
- Monaco Editor
- Yjs for concurrent document editing
- Socket.IO for room events, chat, and application presence
- Node.js and Express
- MongoDB for project metadata and persistent application data

## Requirements
- Use Yjs for collaborative document synchronization.
- Integrate Monaco Editor with an appropriate Yjs binding (for example `y-monaco`).
- Authenticate connections and authorize room membership server-side.
- Separate document synchronization from chat and room management.
- Support multiple users editing simultaneously.
- Handle disconnections, reconnections, and stale presence.
- Persist document state using a deliberate snapshot or update strategy.
- Avoid storing each keystroke as an independent MongoDB document.
- Validate room IDs and incoming events.
- Prevent unauthorized access to private documents.

## Architecture
- Keep three concerns distinct: document state (Yjs), ephemeral room events (cursors, presence, chat), and persisted project metadata (MongoDB).
- Use one Yjs document per editable file or project document, identified by a stable room/document ID.
- Share the Yjs document through a Socket.IO transport or a Yjs websocket provider; do not invent a second conflict-resolution scheme for editor content.
- Send ephemeral events (cursor position, selection, typing, presence) without writing them to durable storage.
- Keep the server authoritative for room membership and permissions; the client only requests to join.

## Monaco Editor integration
- Bind Monaco to the Yjs text type with a binding such as `y-monaco`; never mirror editor text through React state on every keystroke.
- Create the editor once per mounted file and dispose the binding and model on unmount.
- Ignore remote updates when rendering to avoid feedback loops.
- Apply language, theme, and read-only settings from project state, not from untrusted client messages.
- Debounce non-document effects (autosave indicators, dirty state) rather than the collaborative text updates.

## Yjs document synchronization
- Treat the Yjs document as the source of truth for editor content.
- Apply updates as binary Yjs updates, not as whole-document replacements.
- On first load, initialize the client from persisted state, then apply incoming updates.
- Allow the Yjs update format and awareness protocol to handle conflict resolution; do not add custom last-write-wins logic on top.
- Cap document size and reject malformed or oversized updates.

## Socket.IO rooms and events
- Authenticate the Socket.IO handshake before allowing any room operations.
- Authorize `join` and every room-scoped event against the authenticated user's membership.
- Use per-room channels; never broadcast private document updates to all connected clients.
- Validate event names and payload schemas; ignore unknown events.
- Namespace or prefix events by concern, for example `doc:update`, `awareness:update`, `chat:message`, and `presence:update`.
- Rate-limit high-frequency events such as cursor and awareness updates.
- Remove the socket from rooms and clear presence on disconnect.

## Presence and live cursors
- Derive identity from the authenticated session, not from client-supplied names or colors.
- Use Yjs awareness for cursor, selection, and active-user metadata where possible.
- Expire presence entries with a heartbeat or timeout so crashed clients do not remain "online".
- Render remote cursors and selections without writing them into the document.
- Distinguish "connected", "idle", and "disconnected" states in the UI.

## Reconnect handling
- On reconnect, re-authenticate and re-authorize room membership before resuming.
- Request the missing state via the Yjs sync protocol instead of assuming the local copy is current.
- Re-send local awareness state after reconnecting.
- Surface connection status in the UI and disable editing only when required.
- Avoid duplicate event handlers or duplicate provider connections after repeated reconnects.
- Use exponential backoff for reconnect attempts and stop after a bounded number of failures.

## Persistence
- Store project metadata (owner, members, title, language, timestamps) in MongoDB.
- Persist the Yjs document as a compact snapshot (encoded Yjs state) and, if needed, append incremental updates; compact updates periodically.
- Never store one document per keystroke or per awareness message.
- Persist on a debounced interval and on last-client-disconnect, and flush before shutdown.
- Version or timestamp snapshots so a corrupt write can be detected.
- Load the persisted snapshot before accepting new edits for a room.

## Chat
- Persist chat messages only if the product requires history; otherwise treat them as ephemeral room events.
- Authorize chat against room membership and validate message length and content type.
- Rate-limit chat and do not render untrusted message content as HTML.

## Verification
- Open the same room in two browser sessions and verify both users see each other's edits.
- Type in the same region from both sessions and confirm Yjs converges without lost characters.
- Simulate a temporary disconnect in one session, edit in the other, reconnect, and confirm both converge.
- Refresh a session and confirm it reloads the persisted document.
- Restart the server and confirm saved content survives.
- Attempt to join a private room as a non-member and confirm the server rejects both the socket join and document updates.
- Open the room in a third session and confirm presence and cursors appear and disappear correctly.

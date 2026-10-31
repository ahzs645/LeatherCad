# Community discussion board

The Cloud & Community dialog includes a discussion board backed by the configured Convex deployment and the existing OIDC token transport. Public visitors can read published topics and replies. Signed-in members can save private topic drafts, publish topics, reply, like content, and edit or remove their own contributions.

## Integration

- `convex/communityBoardSchema.ts` exports `communityBoardTables`, spread into the main schema.
- `convex/communityBoard.ts` implements validated public reads and authenticated mutations through the existing `ownerQuery` / `ownerMutation` wrappers.
- `src/features/editor/localdb/community-board-client.ts` adapts the existing transport; every list call returns one page of at most 20 rows.
- `CommunityBoardPanel` uses the current cloud session, resets private UI state when the identity changes, and mounts inside the configured Cloud & Community dialog. The optional injected client is for component testing, not a simulated product backend.

The board uses a stable public author ID and a member alias. It does not display an authentication email or token subject. Ownership always comes from the verified backend identity; the client never supplies an owner or author field.

## Behavior and authorization

- Published topics are indexed and paginated by recent activity. Private drafts are indexed by the verified owner and never appear in public lists.
- Reading replies checks the parent topic's visibility. Making a topic private or removing it also hides its replies from other members and public visitors. Reactions on hidden topics or their replies are rejected.
- Likes are transactional and idempotent per identity and target. Repeated or concurrent requests to like the same item do not inflate counts.
- Topic and reply content has a revision number. Editing and removing require the revision the editor loaded, so a stale tab cannot overwrite or remove a newer revision. Likes and reply counters do not advance the content revision.
- Removing a reply clears its text and updates the visible reply count once. Removing a topic clears its text and hides the reply tree. Bounded tombstones and reaction metadata remain; this is content moderation, not a full historical-data erasure API.
- Titles and bodies are bounded on the server. The UI renders plain text with React escaping; there is no HTML or Markdown execution.

## Verification

```sh
node node_modules/vitest/vitest.mjs run \
  src/features/editor/localdb/community-board.test.ts \
  src/features/editor/components/CommunityBoardPanel.test.tsx
node node_modules/typescript/bin/tsc --noEmit -p convex/tsconfig.json
```

The tests exercise the actual Convex functions and client against an in-process Convex test runtime, covering anonymous writes, cross-user ownership, private drafts, parent visibility, pagination, duplicate likes, stable public identity, content limits, stale edits/removals and literal text rendering. A component test also verifies that a delayed private response cannot populate another member's session.

No live deployment or external community writes were performed. Hosting/auth configuration follows `docs/CLOUD_COMMUNITY.md`. This board does not yet include attachments, administrator moderation, notifications, search, or automatic live refresh; readers can explicitly refresh or request the next page. New board labels use the shared translation hook with English fallback.

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

No live deployment or external community writes were performed. Hosting/auth configuration follows `docs/CLOUD_COMMUNITY.md`. The board now includes public title search, report buttons, server-authorized moderator review/audit, in-app reply notifications and optional 30-second refresh while the reader is not composing or editing. Topics and replies now support up to six PNG/JPEG/WebP/GIF attachments (8 MiB each / 24 MiB total), including private drafts. Uploads show browser transfer progress and preserve failed file selections for retry; saving waits until failures are retried or removed. SVG/PDF board attachments, external/email notifications and live collaboration remain outside this interface. New board labels use the shared translation hook with English fallback.

## Operation and moderation

`COMMUNITY_MODERATORS` is a server-only JSON allowlist of verified token identifiers; clients cannot assign roles. Signed-in members can report available public topics, replies and patterns. Open reports deduplicate per reporter/target. Moderator decisions check the current content/visibility revisions and require an audit reason. Hiding a topic hides its reply tree; hiding a pattern blocks republishing that pattern ID. Reporters' account identifiers and moderator identifiers are omitted from UI responses.

A reply creates a private notification for the topic owner when posted by somebody else. Only its owner can read or mark it; the title is resolved under current topic visibility. The newest 1,000 notifications are retained. There is no outgoing email.

The optional refresh pauses during composition, edits, removals, pending operations and hidden tabs. It refreshes the visible first page rather than merging documents or providing simultaneous editing. Application write limits, moderation setup and current operational limits are documented in [the deployment runbook](CLOUD_DEPLOYMENT_RUNBOOK.md).

## Image attachments and quota

Image bytes use the same authenticated, bounded Convex HTTP upload and account asset quota as drawings. The server verifies ownership and ready storage before attaching an image; another member cannot attach a foreign asset ID. A private topic's images are readable only by their asset owner. Public topic and reply images can be resolved by visitors only while the current parent topic is public and the current contribution still references that image. Removing/replacing attachments releases their board references; linked drawing/publication references continue to protect the underlying file.

Discussion content and retained removal tombstones also count toward the account's aggregate content allowance. Topic/reply text edits and image references are saved with the captured content revision. Upload completion from a closed composer or an earlier account cannot append to a later composer; unused uploads are collected after 24 hours. Issued storage URLs remain bearer capabilities, as explained in the deployment runbook.

# Local draft recovery and sign-in navigation

Periodic autosave is optional and disabled by default. When enabled, LeatherCad saves the current drawing every 60 seconds, on document hiding, and synchronously to localStorage during page exit. A saved status follows an acknowledged write to localStorage or IndexedDB. If neither store accepts a write, an alert offers a download of the current drawing. A failed final localStorage write requests the browser's unload warning; browser restrictions can suppress that warning.

On startup, saving and the startup demo pause while existing drafts are checked. A prior automatic draft offers **Recover**, **Download saved draft**, **Download current drawing**, and **Discard stored drafts**. Recover validates the project and preserves shape IDs and its named local-project association. Malformed draft bytes remain downloadable. Discard removes both browser-store copies and legacy snapshots; failures remain visible. These are the latest draft slots, not a version-history service.

A failed or timed-out database check is distinct from finding no draft. The editor remains usable, while automatic saving and sign-in stay paused to protect unread data; **Check stored drafts again** retries without replacing current work. If a local copy is available but another store could not be checked, recovery requires an explicit choice because the inaccessible store might contain newer edits.

The sign-in action independently saves the newest document and local-project ID before allowing a provider to navigate, even when periodic autosave is disabled. Built-in OIDC repeats this check after SDK initialization, immediately before redirect. Storage failure prevents redirect. No tokens are added to drawing snapshots.

After return or reload, the latest sign-in draft restores automatically, regardless of callback success or provider cancellation. A regular durable recovery copy is written before the one-use sign-in marker is consumed. An explicitly opened project, or a drawing changed while recovery was loading, takes precedence: the draft is offered for manual recovery instead of replacing current work.

Drafts stay in the current browser origin and may be visible to other people using that browser profile. Downloaded JSON is the portable per-project backup. Whole-library backup and cloud revision history are separate workflows. Disabling periodic autosave does not disable the explicit pre-sign-in protection.

Validation includes storage acknowledgments/failures, damaged and legacy drafts, newest-store selection, short-session exit, explicit/late project opening, provider cancellation/reload, named-project restoration and real Chromium reload/download/recover/discard flows. Live identity-provider configuration remains a separate deployment check.

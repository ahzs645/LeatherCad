# Editor Module Boundaries

This directory is the target ownership map for editor features. New behavior should land in a module first, then be wired by the screen controller.

Modules own their controller, view-model, command, and type files. Shared geometry/data primitives stay in `cad`, `ops`, `state`, or `view-models` until they have a clearer module owner.

Boundary rules enforced by `scripts/check-file-size.mjs`:

- `modules/canvas` may depend on editor CAD types, ops, hooks, and state-level primitives, but not UI components or workbench internals.
- `modules/topbar` should expose command/section models and topbar-specific command builders; it should not mutate document state directly.
- Sibling modules should communicate through exported module APIs, not by importing each other's implementation files.

The migration order is intentionally behavior-preserving: extract view models, extract command registries, add checks, then clean up naming and folder layout.

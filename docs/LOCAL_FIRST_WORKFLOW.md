# Local-first LeatherCad

The current plan uses no Convex deployment. The CAD editor, local library, draft recovery, import/export, printing, 3D preview and manufacturing work without a cloud account or backend.

## Save and share work

- Save the complete drawing as **JSON**, including supported project/manufacturing state and embedded fonts. Other interchange formats show their relevant loss warnings.
- Use the local project library for drawings in this browser/profile. Autosave and recovery acknowledge successful storage; storage failures remain visible.
- Use **File tools → Local library backup** to download the saved library and allowlisted preferences. Save the open drawing first, then retain a backup outside the browser.
- Move or share files directly. Reopen a JSON drawing on another device, or restore a library backup through the reviewed merge/replace workflow.
- Use the print calibration sheets and STL fit gauge for later [physical/device acceptance](PHYSICAL_DEVICE_ACCEPTANCE.md).

Browser storage is tied to the profile and site origin. Clearing it, switching origins or losing the device can remove local copies. Downloaded backups provide a separate copy. Opening the app or an uncached tool still needs access to the app server.

## Hosted features

Hosted sync, accounts, galleries and discussions are deferred. The current installation leaves cloud configuration empty and reports cloud sharing as unavailable; the local editor continues working. No cloud credentials or OIDC registration are needed for the local workflow.

The repository retains the inactive optional Convex implementation and its maintainer guides. Those guides describe that implementation, rather than a required next setup step or a selected replacement backend. Any future hosted sharing service needs a separate backend decision.

Current priorities are physical printer/device acceptance, specialist localization, persistent constraint UI integration and the documented interchange limits. See [the current backlog](NEXT_PARITY_PRIORITIES.md).

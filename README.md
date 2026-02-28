# Move Tab To Window (Firefox extension)

**NOTE: All code is written by codex.**

Adds a tab context-menu entry, **Move tab to…**, with a submenu listing all other open windows.

Each target window is labeled as:

- `<tab count> tabs — <active tab title>`

When clicked, the extension moves:

- the right-clicked tab, or
- all highlighted tabs in that window (multi-select), when the right-clicked tab is part of the selection.

## Install temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select this folder's `manifest.json`.

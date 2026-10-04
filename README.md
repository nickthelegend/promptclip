# PromptClip

A background desktop prompt picker. Press `⌘/Ctrl + Shift + Space`, select a prompt, and it is copied to the clipboard. PromptClip stays in the menu bar/system tray after its picker is closed.

Opening the app shows the picker and focuses search. The shortcut toggles it, and Escape hides it. At login it starts quietly in the background; opening it again brings the existing picker forward.

## Run locally

```bash
npm install
npm start
```

On first launch PromptClip loads the bundled prompt library. Import Apple Notes from the picker menu on macOS. Notes are read locally through macOS; nothing is uploaded by the app.

## Manage prompts

- Your five most recently copied prompts stay at the top, with timestamps and persistent ordering across restarts.
- Stable card colors make frequently used prompts easier to recognize at a glance.
- Right-click a prompt to edit or delete it.
- Right-click empty space to add a prompt or import Apple Notes.
- Use the menu bar/system tray icon to open or quit the app.

## Builds

`npm run dist` builds for the current host. The GitHub Actions workflow produces macOS, Windows, and Linux artifacts on every version tag or manual dispatch. macOS release artifacts are unsigned unless signing credentials are configured as repository secrets.

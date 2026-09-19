# PromptClip

A background desktop prompt picker. Press `⌘/Ctrl + Shift + Space`, select a prompt, and it is copied to the clipboard. PromptClip stays in the menu bar/system tray after its picker is closed.

## Run locally

```bash
npm install
npm start
```

On first launch PromptClip imports your Apple Notes into its local prompt library on macOS. You can repeat that from the picker menu. Notes are read locally through macOS; nothing is uploaded by the app.

## Manage prompts

- Right-click a prompt to edit or delete it.
- Right-click empty space to add a prompt or import Apple Notes.
- Use the menu bar/system tray icon to open or quit the app.

## Builds

`npm run dist` builds for the current host. The GitHub Actions workflow produces macOS, Windows, and Linux artifacts on every version tag or manual dispatch. macOS release artifacts are unsigned unless signing credentials are configured as repository secrets.

# Solid Spoon

A real-time dashboard app that already runs as a web application and can now be wrapped in a desktop shell for Windows.

## Desktop / Windows app

### Run locally in development

```bash
npm install
npm run dev:electron
```

This starts the existing server and opens the app in an Electron window.

### Build the Windows desktop app

```bash
npm install
npm run electron:build:nsis
```

A Windows installer will be created in the `release/` folder.

### Direct desktop startup

```bash
npm install
npm run electron:start
```

This builds the app bundle and launches the desktop shell.

## Existing app

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:5000
```

## Notes

- The desktop wrapper uses the existing Node + Express server already present in the repository.
- No code signing is configured, so this is intended for local / sideload use on Windows.
- Auto-update and signing are left as placeholders because you specified you do not have code signing.

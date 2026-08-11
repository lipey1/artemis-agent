# Building installers

From the Artemis agent desktop app directory (Node.js >= 22):

```bash
npm run build
npx electron-builder --linux AppImage deb
npx electron-builder --win portable nsis
npx electron-builder --mac zip
```

Publish artifacts via GitHub Releases (files often exceed git size limits).

Current public packages live at:

https://github.com/lipey1/artemis-desktop/releases/latest

After building or branding an engine tree, retarget update checks:

```bash
python3 scripts/retarget-updates.py /path/to/artemis-agent
```

Mobile companion:

https://github.com/lipey1/artemis-mobile

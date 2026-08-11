# Building installers

From the Hermes Agent desktop app directory (Node >= 22):

```bash
npm run build
npx electron-builder --linux AppImage deb
npx electron-builder --win nsis
npx electron-builder --mac zip
```

Publish artifacts via GitHub Releases (files often exceed git size limits).

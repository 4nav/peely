# Peel

Chrome side-panel extension that turns loose tabs into saved, switchable workspaces (backed by tab groups).

- Scan loose tabs, review the suggested workspaces, apply the ones you like
- Switch workspaces; inactive ones are parked in a hidden window
- Snapshots (autosave + before destructive actions) with restore

## Dev

```
npm install
npm run build   # outputs dist/
npm run lint
```

Load `dist/` via `chrome://extensions` → Developer mode → Load unpacked.

# Snap-a-Mistake mobile app

The Expo app captures or selects a handwritten-math photo, preserves its local scan history, and presents first-break feedback from the API. It uses Expo Router, strict TypeScript, device-local SQLite, and app-owned photo files.

## Start it

From the repository root, install npm workspaces once:

```bash
npm install
```

Use a deterministic mock server for UI work:

```bash
MOCK=error npm run mock -w server
cd app && EXPO_PUBLIC_API_URL=http://<MAC-LAN-IP>:3000 npx expo start --go
```

Use `http://localhost:3000` only for an iOS simulator. A physical phone must use the Mac’s LAN IP and be on the same network. Available mock modes are `correct`, `error`, `suspect`, `unreadable`, `not-math`, `timeout`, `server-error`, `correction`, and `alternate-follow-up`.

For a live model, create `server/.env` from `server/.env.example`, set `OPENAI_API_KEY`, start `npm run dev -w server`, and use the same Expo command. The live path sends the chosen photo to the configured AI service; mock responses are canned and must not be represented as live results.

## Local data

The app copies approved photos into its own document storage. SQLite keeps the scan, all diagnosis revisions, linked follow-up state, and session recovery state on the device until the student deletes that scan or clears all history. The backend is stateless and does not retain app history or photos.

## Checks

```bash
npm test -w app
npm run typecheck -w app
npm run lint -w app
```

`expo lint` uses the SDK 57-compatible `eslint` and `eslint-config-expo` flat configuration in `eslint.config.js`. The small file-scoped exceptions cover React Native ref forwarding and Reanimated shared-value worklets; other Expo rules stay enabled.

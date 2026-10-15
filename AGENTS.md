# Repository Guidelines

## Project Structure & Module Organization

This repository is an Angular 22 application. Application code and routes live in `src/app/`; `src/main.ts` bootstraps the app, and `src/styles.scss` holds global styles. Put static files in `public/`, which Angular copies into the build. Keep unit tests beside the code they cover as `*.spec.ts`.

## Angular Development Instructions

Follow [ANGULAR_INSTRUCTIONS.md](ANGULAR_INSTRUCTIONS.md) for Angular architecture, component, template, state, and accessibility guidance.

## Build, Test, and Development Commands

- `npm ci` installs the exact dependencies in `package-lock.json`.
- `npm start` runs the development server at `http://localhost:4200/`.
- `npm run build` produces a production build in `dist/`.
- `npm run watch` rebuilds continuously with development settings.
- `npm test -- --watch=false` runs the Vitest suite once; use `npm test` while developing.

Run commands from the repository root. Keep `package-lock.json` in commits when dependencies change.

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, two spaces, final newline, and single quotes in TypeScript. `.prettierrc` sets a 100-character line width and Angular HTML formatting; run `npx prettier --check .` before submitting and `npx prettier --write <files>` for files you edited. Name files by feature in kebab case, for example `market-dashboard.ts`, with adjacent `market-dashboard.spec.ts` and `market-dashboard.scss`.

## Testing Guidelines

Vitest is configured through Angular CLI. Add focused tests for new behavior, especially metric formulas, settings validation, run resets, pause/resume, stale worker messages, and Wasm batch invariants. Use fixed seeds or mocked timers; tests should not wait for real intervals. No coverage threshold is configured. Run the full test suite and production build before opening a pull request.

## Commits & Pull Requests

The existing history uses short imperative subjects (`Initial commit`, `Initialize Angular application`); continue that style and keep each commit focused. Pull requests should describe the change, list verification commands, link a relevant issue when one exists, and include screenshots for visible UI changes. Never commit `.env`, `node_modules/`, or `dist/`.

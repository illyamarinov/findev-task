# Market Simulator

An Angular 22 dashboard for simulated market trades. It shows the latest traded price, bid–ask spread, cumulative trading volume, cumulative volume-weighted average price (VWAP), and order-book imbalance for each instrument. The Settings page controls the number of instruments, updates per batch, and batch interval.

- [Live demo](https://illyamarinov.github.io/findev-task/)
- [Source repository](https://github.com/illyamarinov/findev-task)

## Requirements

- Node.js 24.15 or newer in the Node.js 24 line
- npm 11 (the project was developed with npm 11.19.0)
- A browser with Web Workers and WebAssembly enabled

## Run locally

```bash
npm ci
npm start
```

Open `http://localhost:4200/`. The `prestart` script compiles the AssemblyScript generator to `public/market-producer.wasm` before Angular starts. That generated file is ignored by Git.

## Verify and build

```bash
npm run test:wasm
npm test -- --watch=false
npm run lint
npx prettier --check .
npm run build
```

`test:wasm` runs tests against the compiled WebAssembly module. The Angular test suite uses Vitest and mocked workers and timers. `npm run build` also compiles Wasm and type-checks the worker; its production output is `dist/findev-task/browser/`.

## Architecture

- `assembly/` contains the stateful AssemblyScript generator. It produces packed market updates using integer cents and keeps price state separately for each instrument.
- `src/worker/` loads Wasm in a Web Worker, processes every generated update, and sends throttled metric snapshots to the UI.
- `src/app/market/` contains the market model, pure cumulative metric calculations, settings validation, and the single app-wide producer service. Applying settings replaces the worker and rejects messages from older runs.
- `src/app/pages/` contains the Dashboard and Settings pages. The Settings form keeps edits local until Apply. Pause and Resume keep the current totals and generator state.

The dashboard does not keep the complete trade history. It accumulates volume and VWAP from every trade in the worker, while the interface receives snapshots at most every 100 ms. Prices are rounded only for display.

## Deployment

Every push to `main` runs the checks and a production build in GitHub Actions, then deploys the build output to GitHub Pages. The deployed build uses `/findev-task/` as its base path. The workflow also copies the application shell to `settings/index.html`, so a direct visit or reload of `/findev-task/settings/` works on static hosting. Add an entry file for any new top-level route. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** for the repository.

# FindevTask

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.3.

## Architecture

- `src/app/` contains the application shell, routes, and bootstrap configuration.
- `src/app/pages/` contains smart Dashboard and Settings pages and their local UI components.
- `src/app/market/` contains market models, metrics, settings validation, and the app-wide producer service.
- `src/app/shared/ui/` contains reusable navigation and card components; `shared/utils/` contains reusable helpers.
- `src/worker/` contains the Worker entry point, runtime, and message contract. It uses `src/app/market/` without importing Angular.
- `assembly/` contains the AssemblyScript market update generator compiled to WebAssembly.

TypeScript imports use the `@app/*`, `@pages/*`, `@market/*`, `@shared/*`, and `@worker/*` aliases defined in `tsconfig.json`.

Pages coordinate `MarketProducer`; UI components receive state through inputs and send user actions through outputs. The Settings form owns its unsaved draft and validation.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Linting

Run ESLint for Angular TypeScript files and templates:

```bash
npm run lint
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

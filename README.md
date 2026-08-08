# GlassStudio

GlassStudio is an AI-first design-to-deliver workspace prototype built from the product, architecture, and UI documents in `docs/`. The current React MVP focuses on the first usable loop: start from a template, edit layers on a desktop canvas, autosave a local draft, and export HTML, PNG, or a ZIP resource package.

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Branch delivery

`dev` is the working integration branch. The workflow in `.github/workflows/ci.yml` runs the quality gate on pull requests to `main` and on every push to `dev`. After the `dev` quality gate passes, GitHub Actions creates or finds a `dev` -> `main` pull request and squash-merges it automatically. The repository must allow the workflow `GITHUB_TOKEN` to write contents and pull requests in Settings -> Actions -> General.

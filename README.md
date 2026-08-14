# AI Learning Tree

A dark tech-tree learning map with three tracks - Data Analyst, DevOps, and System Design: hop-depth columns, prerequisite paths that light up, learner-owned per-track progress, and a copy-to-Copilot tutor prompt per concept.

Live: https://engineerball.github.io/data-analyst-tree-app/

## How progress works

- Progress is stored per track in your browser (localStorage). Nothing leaves your machine.
- "Share progress" copies a link whose fragment encodes the active track's done-set.
- Progress and share links from the original data-analyst-only version keep working.
- Opening a shared link shows a read-only view. Your own progress is untouched unless you explicitly import.

## Development

```
npm install
npm run dev       # dev server
npm test          # vitest
npm run build     # type-check + production build
npm run preview   # serve the production build
```

Deployed to GitHub Pages by `.github/workflows/deploy.yml` on push to main.

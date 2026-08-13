# Data Analysis Concept Tree

A learning map for data-analysis concepts with prerequisite paths, learner-owned progress, and a copy-to-LLM tutor prompt per concept.

Live: https://engineerball.github.io/data-analyst-tree-app/

## How progress works

- Progress is stored in your browser (localStorage). Nothing leaves your machine.
- "Share progress" copies a link whose fragment encodes your done-set.
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

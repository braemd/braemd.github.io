# braemd.github.io

Source of the personal website of Dominic Bräm, built with [Quarto](https://quarto.org).

## Structure

| Path | Content |
|------|---------|
| `_quarto.yml` | Site configuration: navbar, tutorial sidebar, theme, SEO metadata |
| `index.qmd` | Home page |
| `research.qmd`, `publications.qmd`, `software.qmd`, `teaching.qmd`, `talks.qmd`, `cv.qmd` | Main pages |
| `data/*.yml` | **Content to edit**: publications, talks, teaching, media coverage, CV entries |
| `R/site.R` | Renders the YAML files as HTML (used by the pages above) |
| `tutorials/` | pmxNODE and optiDoseR tutorials (data files and references live next to the pages) |
| `assets/` | Theme (`light.scss`, `dark.scss`, `custom.scss`), images, redacted CV PDF |
| `_drafts/` | Work in progress, not rendered (Research page draft, CV source) |
| `docs/` | Previous R Markdown build that is currently live; remove it once the GitHub Action deploys the site |
| `.github/workflows/publish.yml` | Builds and deploys the site on every push to `main` |

## Adding a publication, talk, or workshop

Add an entry to the matching file in `data/` and run `quarto render`. Pages built from
`data/` are never frozen, so they always reflect the YAML files.

The published CV must not contain contact details. Redact a new CV before replacing
`assets/files/CV_Dominic_Braem.pdf`; the unredacted original is git-ignored.

## Working on the site

```bash
quarto preview   # live preview at http://localhost:4200
quarto render    # full build into _site/
```

Pages with R code are only re-executed when their source changes (`freeze: auto`).
Results are stored in `_freeze/`, which must be committed so the site can be built
without re-running the analyses.

The two nlmixr2 tutorials show code without running it (`eval: false`), because they
need nlmixr2, optiDoseR, and a fitted model that is not part of this repository.
Their figures are pre-rendered PNGs in `tutorials/optiDoseR/images/`.

## Deployment

Every push to `main` triggers the GitHub Action in `.github/workflows/publish.yml`. It installs
Quarto and R, runs `quarto render`, and deploys `_site/` to GitHub Pages; progress is shown in the
repository's **Actions** tab. `_site/` itself is never committed.

One-time setup: **Settings → Pages → Source → GitHub Actions**.

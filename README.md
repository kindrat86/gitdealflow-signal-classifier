# GitDealFlow Signal Classifier

Deterministic classifier for GitHub engineering-velocity signals, used to
label observations in the Startup Engineering Acceleration Dataset.

**Paper:** https://ssrn.com/abstract=6606558 (SSRN preprint, 2026)
**Dataset DOI:** [10.5281/zenodo.19650920](https://doi.org/10.5281/zenodo.19650920)

## Signal taxonomy

Each (org, period) observation is classified into one of four acceleration
patterns using heuristics over commit velocity, unique-contributor count,
new-repo creation, and velocity change:

- **Framework migration** (75% of observations) — concentrated refactor
  activity; commits touch core dependencies and build config.
- **Engineering hiring burst** (9%) — unique-contributor count rising faster
  than commit volume; new accounts appearing in merge-commit authorship.
- **Infrastructure buildout** (4%) — new repos spawning under the org;
  disproportionate activity in infra/DevOps repos vs. primary product repo.
- **Deploy frequency spike** (12%) — commit velocity rising sharply without
  proportional contributor growth.

## Files

- `classify.mjs` — pure-function classifier, no dependencies.
- `build-dataset-bundle.mjs` — bundle generator that emits the public CSV
  distributions from the raw data.
- `METHODOLOGY.md` — full methodology (mirrored from
  https://signals.gitdealflow.com/methodology).

## Usage

```js
import { classify } from "./classify.mjs";

classify({
  commitVelocity14d: 267,
  commitVelocityChange: "+75%",
  contributors: 53,
  contributorGrowth: "+0%",
  newRepos: 1,
});
// => "Framework migration"
```

## Public mirrors of the dataset

- **Live (refreshed weekly):** https://signals.gitdealflow.com/api/signals.csv
- **Zenodo (DOI-stamped):** https://zenodo.org/records/19650920
- **Kaggle:** https://www.kaggle.com/datasets/thedatanerd2026/vc-deal-flow-signal
- **Data.world:** https://data.world/thedatanerd2026/vc-deal-flow-signal-startup-engineering-acceleration

## Citation

> The Data Nerd. (2026). *A Longitudinal Panel of GitHub Engineering Velocity
> for Venture-Backed Startups: Dataset and Early Observations* (v1.0.0)
> [Data set]. Zenodo. https://doi.org/10.5281/zenodo.19650920

## License

Code: MIT (see `LICENSE`).
Dataset: CC BY 4.0 — free to reuse with attribution.

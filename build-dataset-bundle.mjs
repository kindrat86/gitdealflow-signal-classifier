#!/usr/bin/env node
// Generates the GitDealFlow public dataset bundle for Kaggle, Data.world, and Zenodo.
// Reads pseo-site/data/startups.json and writes CSV + metadata files in this directory.
// Re-run whenever the source dataset refreshes. Idempotent.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const sourcePath = resolve(repoRoot, "pseo-site", "data", "startups.json");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));

const today = new Date().toISOString().slice(0, 10);
const currentPeriod = source.periods.find((p) => p.current)?.slug ?? source.periods[0].slug;

const csvEscape = (value) => {
  const s = value == null ? "" : String(value);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toRow = (cells) => cells.map(csvEscape).join(",");
const parsePct = (s) => {
  if (typeof s !== "string") return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// ---------------------------------------------------------------------------
// 1. startup_signals.csv — per startup per period (one row per observation)
// ---------------------------------------------------------------------------

const startupRows = [
  toRow([
    "period",
    "sector_slug",
    "sector_name",
    "startup_name",
    "stage",
    "geography",
    "commit_velocity_14d",
    "commit_velocity_change_pct",
    "contributors",
    "contributor_growth_pct",
    "new_repos",
    "signal_type",
    "github_url",
  ]),
];

for (const sector of source.sectors) {
  for (const [periodSlug, snapshot] of Object.entries(sector.periods)) {
    for (const s of snapshot.startups) {
      startupRows.push(
        toRow([
          periodSlug,
          sector.slug,
          sector.name,
          s.name,
          s.stage,
          s.geography,
          s.commitVelocity14d,
          parsePct(s.commitVelocityChange),
          s.contributors,
          parsePct(s.contributorGrowth),
          s.newRepos,
          s.signalType,
          s.githubUrl,
        ]),
      );
    }
  }
}

writeFileSync(resolve(here, "startup_signals.csv"), startupRows.join("\n") + "\n");

// ---------------------------------------------------------------------------
// 2. sector_aggregates.csv — one row per sector per period
// ---------------------------------------------------------------------------

const sectorRows = [
  toRow([
    "period",
    "sector_slug",
    "sector_name",
    "startups_tracked",
    "avg_commit_velocity_14d",
    "median_commit_velocity_14d",
    "total_commits_14d",
    "avg_contributors",
    "positive_velocity_count",
    "top_mover_name",
    "top_mover_change_pct",
    "dominant_signal_type",
  ]),
];

const median = (arr) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

for (const sector of source.sectors) {
  for (const [periodSlug, snapshot] of Object.entries(sector.periods)) {
    const sts = snapshot.startups;
    if (!sts.length) continue;
    const vels = sts.map((s) => s.commitVelocity14d);
    const changes = sts.map((s) => ({ name: s.name, v: parsePct(s.commitVelocityChange) ?? -Infinity }));
    const topMover = changes.reduce((a, b) => (b.v > a.v ? b : a));
    const positive = sts.filter((s) => (parsePct(s.commitVelocityChange) ?? 0) > 0).length;
    const signalCounts = {};
    for (const s of sts) signalCounts[s.signalType] = (signalCounts[s.signalType] ?? 0) + 1;
    const dominant = Object.entries(signalCounts).sort((a, b) => b[1] - a[1])[0][0];
    sectorRows.push(
      toRow([
        periodSlug,
        sector.slug,
        sector.name,
        sts.length,
        Math.round((vels.reduce((a, b) => a + b, 0) / sts.length) * 100) / 100,
        median(vels),
        vels.reduce((a, b) => a + b, 0),
        Math.round((sts.reduce((a, b) => a + b.contributors, 0) / sts.length) * 100) / 100,
        positive,
        topMover.name,
        topMover.v === -Infinity ? "" : topMover.v,
        dominant,
      ]),
    );
  }
}

writeFileSync(resolve(here, "sector_aggregates.csv"), sectorRows.join("\n") + "\n");

// ---------------------------------------------------------------------------
// 3. signal_type_timeseries.csv — signal mix per period
// ---------------------------------------------------------------------------

const signalRows = [toRow(["period", "signal_type", "startup_count", "share_of_total"])];
for (const p of source.periods) {
  const counts = {};
  let total = 0;
  for (const sector of source.sectors) {
    const snap = sector.periods[p.slug];
    if (!snap) continue;
    for (const s of snap.startups) {
      counts[s.signalType] = (counts[s.signalType] ?? 0) + 1;
      total += 1;
    }
  }
  for (const [sig, n] of Object.entries(counts)) {
    signalRows.push(toRow([p.slug, sig, n, Math.round((n / total) * 10000) / 10000]));
  }
}

writeFileSync(resolve(here, "signal_type_timeseries.csv"), signalRows.join("\n") + "\n");

// ---------------------------------------------------------------------------
// 4. datapackage.json — Frictionless Data spec (Data.world reads this natively)
// ---------------------------------------------------------------------------

const datapackage = {
  name: "vc-deal-flow-signal-startup-engineering-acceleration",
  title: "VC Deal Flow Signal — Startup Engineering Acceleration Dataset",
  description:
    "Quarterly panel of GitHub engineering-velocity signals across venture-backed startups, covering 20 sectors and 5 quarters. Tracks commit velocity, contributor growth, repository expansion, and acceleration-signal classification. Designed for venture-capital deal sourcing, academic study of open-source development patterns, and predictive modeling of startup funding events.",
  homepage: "https://gitdealflow.com",
  version: "1.0.0",
  created: today,
  keywords: [
    "venture-capital",
    "startups",
    "github",
    "open-source",
    "engineering-velocity",
    "commit-activity",
    "deal-flow",
    "alternative-data",
    "funding-prediction",
    "repository-analytics",
  ],
  licenses: [
    {
      name: "CC-BY-4.0",
      title: "Creative Commons Attribution 4.0 International",
      path: "https://creativecommons.org/licenses/by/4.0/",
    },
  ],
  contributors: [
    {
      title: "VC Deal Flow Signal",
      email: "signal@gitdealflow.com",
      role: "author",
    },
  ],
  sources: [
    {
      title: "GitHub REST API v3 — public repository metadata",
      path: "https://docs.github.com/en/rest",
    },
  ],
  resources: [
    {
      name: "startup_signals",
      path: "startup_signals.csv",
      profile: "tabular-data-resource",
      format: "csv",
      mediatype: "text/csv",
      encoding: "utf-8",
      description:
        "One row per startup per quarterly period. Primary observation table.",
      schema: {
        fields: [
          { name: "period", type: "string", description: "Quarterly period slug (e.g. q2-2026)." },
          { name: "sector_slug", type: "string" },
          { name: "sector_name", type: "string" },
          { name: "startup_name", type: "string", description: "GitHub organization slug." },
          { name: "stage", type: "string", description: "Self-reported funding stage." },
          { name: "geography", type: "string", description: "ISO region grouping (US, EU, APAC, LATAM, Canada, Unknown)." },
          { name: "commit_velocity_14d", type: "integer", description: "Total commits to the most active public repo over a rolling 14-day window." },
          { name: "commit_velocity_change_pct", type: "number", description: "Percent change in commit velocity vs. the preceding 14-day window." },
          { name: "contributors", type: "integer", description: "Unique contributors in the observation window." },
          { name: "contributor_growth_pct", type: "number" },
          { name: "new_repos", type: "integer", description: "New public repos created by the org in the window." },
          { name: "signal_type", type: "string", description: "One of: Framework migration, Engineering hiring burst, Infrastructure buildout, Deploy frequency spike." },
          { name: "github_url", type: "string", format: "uri" },
        ],
        primaryKey: ["period", "startup_name"],
      },
    },
    {
      name: "sector_aggregates",
      path: "sector_aggregates.csv",
      profile: "tabular-data-resource",
      format: "csv",
      mediatype: "text/csv",
      description: "Sector-level aggregates per quarter.",
      schema: {
        fields: [
          { name: "period", type: "string" },
          { name: "sector_slug", type: "string" },
          { name: "sector_name", type: "string" },
          { name: "startups_tracked", type: "integer" },
          { name: "avg_commit_velocity_14d", type: "number" },
          { name: "median_commit_velocity_14d", type: "number" },
          { name: "total_commits_14d", type: "integer" },
          { name: "avg_contributors", type: "number" },
          { name: "positive_velocity_count", type: "integer", description: "Number of startups with positive velocity change this period." },
          { name: "top_mover_name", type: "string" },
          { name: "top_mover_change_pct", type: "number" },
          { name: "dominant_signal_type", type: "string" },
        ],
        primaryKey: ["period", "sector_slug"],
      },
    },
    {
      name: "signal_type_timeseries",
      path: "signal_type_timeseries.csv",
      profile: "tabular-data-resource",
      format: "csv",
      mediatype: "text/csv",
      description: "Distribution of signal types across startups each quarter.",
      schema: {
        fields: [
          { name: "period", type: "string" },
          { name: "signal_type", type: "string" },
          { name: "startup_count", type: "integer" },
          { name: "share_of_total", type: "number", description: "Share of all observations in the period (0-1)." },
        ],
        primaryKey: ["period", "signal_type"],
      },
    },
  ],
};

writeFileSync(resolve(here, "datapackage.json"), JSON.stringify(datapackage, null, 2) + "\n");

// ---------------------------------------------------------------------------
// 5. dataset-metadata.json — Kaggle dataset metadata (kaggle datasets init format)
// ---------------------------------------------------------------------------

const kaggle = {
  title: "VC Deal Flow Signal — Startup Engineering Acceleration",
  id: "gitdealflow/vc-deal-flow-signal",
  licenses: [{ name: "CC-BY-4.0" }],
  subtitle:
    "GitHub commit velocity and acceleration signals across 20 startup sectors, 5 quarters",
  description: `Quarterly panel of GitHub engineering-velocity signals across venture-backed startups. Covers ${source.sectors.length} sectors and ${source.periods.length} quarters (${[...source.periods].reverse().map((p) => p.name).join(" — ")}).

Collected by [VC Deal Flow Signal](https://gitdealflow.com) from the public GitHub REST API. Designed for venture-capital deal sourcing, academic research on open-source development patterns, and predictive modeling of startup funding events.

**Files**
- \`startup_signals.csv\` — one row per startup per period (primary observation table, ${startupRows.length - 1} rows).
- \`sector_aggregates.csv\` — sector-level aggregates per period.
- \`signal_type_timeseries.csv\` — distribution of signal types over time.

**Signal types**
- Framework migration
- Engineering hiring burst
- Infrastructure buildout
- Deploy frequency spike

**Methodology**: https://signals.gitdealflow.com/methodology

**Citation**
> VC Deal Flow Signal. (${today.slice(0, 4)}). *Startup Engineering Acceleration Dataset* (v1.0.0) [Data set]. https://gitdealflow.com

License: CC BY 4.0 — free to reuse with attribution.`,
  keywords: [
    "finance",
    "venture-capital",
    "github",
    "startups",
    "open-source",
    "time-series",
    "panel-data",
    "alternative-data",
  ],
  collaborators: [],
  data: [
    { path: "startup_signals.csv", description: "One row per startup per quarterly period." },
    { path: "sector_aggregates.csv", description: "Sector-level aggregates per quarter." },
    { path: "signal_type_timeseries.csv", description: "Signal-type distribution over time." },
  ],
};

writeFileSync(resolve(here, "dataset-metadata.json"), JSON.stringify(kaggle, null, 2) + "\n");

// ---------------------------------------------------------------------------
// 6. CITATION.cff — Citation File Format (GitHub + Zenodo auto-parse this)
// ---------------------------------------------------------------------------

const cff = `cff-version: 1.2.0
title: "VC Deal Flow Signal — Startup Engineering Acceleration Dataset"
message: "If you use this dataset, please cite it as below."
type: dataset
authors:
  - name: "The Data Nerd"
    affiliation: "VC Deal Flow Signal"
    website: "https://gitdealflow.com"
    email: "signal@gitdealflow.com"
version: "1.0.0"
date-released: "${today}"
url: "https://gitdealflow.com"
repository-artifact: "https://signals.gitdealflow.com/api/signals.csv"
doi: "10.5281/zenodo.19650920"
identifiers:
  - type: doi
    value: "10.5281/zenodo.19650920"
    description: "Version DOI for v1.0.0"
  - type: doi
    value: "10.5281/zenodo.19650919"
    description: "Concept DOI — resolves to the latest version"
license: "CC-BY-4.0"
keywords:
  - venture-capital
  - startups
  - github
  - engineering-velocity
  - alternative-data
  - panel-data
  - deal-flow
`;
writeFileSync(resolve(here, "CITATION.cff"), cff);

// ---------------------------------------------------------------------------
// 7. Summary
// ---------------------------------------------------------------------------

console.log("Dataset bundle written:");
console.log(`  startup_signals.csv          ${startupRows.length - 1} rows`);
console.log(`  sector_aggregates.csv        ${sectorRows.length - 1} rows`);
console.log(`  signal_type_timeseries.csv   ${signalRows.length - 1} rows`);
console.log(`  datapackage.json             Frictionless Data spec`);
console.log(`  dataset-metadata.json        Kaggle metadata`);
console.log(`  CITATION.cff                 Citation File Format`);

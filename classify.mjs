// classify.mjs — deterministic signal classifier for
// GitHub engineering-velocity observations.
//
// The four acceleration patterns are exclusive: each observation receives
// exactly one label. Heuristic thresholds are documented inline and derived
// from the observational data in https://zenodo.org/records/19650920.
//
// No runtime dependencies.

const parsePct = (s) => {
  if (typeof s === "number") return s;
  if (typeof s !== "string") return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/**
 * Classify a single org-period observation.
 *
 * @param {object} obs
 * @param {number} obs.commitVelocity14d        - Total commits in trailing 14-day window.
 * @param {string|number} obs.commitVelocityChange - Percent change vs. prior window ("+75%" or 75).
 * @param {number} obs.contributors             - Unique contributors in the window.
 * @param {string|number} [obs.contributorGrowth] - Percent change in contributors.
 * @param {number} [obs.newRepos]               - New repos created by the org in the window.
 * @returns {"Framework migration"|"Engineering hiring burst"|"Infrastructure buildout"|"Deploy frequency spike"}
 */
export function classify(obs) {
  const velChange = parsePct(obs.commitVelocityChange) ?? 0;
  const contribGrowth = parsePct(obs.contributorGrowth) ?? 0;
  const newRepos = obs.newRepos ?? 0;
  const contributors = obs.contributors ?? 0;

  // 1. Infrastructure buildout — new repos dominate.
  //    Spawning multiple repos alongside non-trivial contributor base.
  if (newRepos >= 3 && contributors >= 50) {
    return "Infrastructure buildout";
  }

  // 2. Engineering hiring burst — contributors growing faster than commits.
  //    Triggered when contributor growth exceeds velocity change by 50+ pp.
  if (contribGrowth - velChange >= 50 && contribGrowth >= 20) {
    return "Engineering hiring burst";
  }

  // 3. Deploy frequency spike — velocity spike without proportional
  //    contributor growth. Velocity up >=100% while contributors ~flat.
  if (velChange >= 100 && contribGrowth < 20) {
    return "Deploy frequency spike";
  }

  // 4. Framework migration — default for concentrated refactor activity
  //    (moderate velocity change, stable contributor base).
  return "Framework migration";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Self-test when run directly.
  const cases = [
    [{ commitVelocity14d: 267, commitVelocityChange: "+75%", contributors: 53, contributorGrowth: "+0%", newRepos: 1 }, "Framework migration"],
    [{ commitVelocity14d: 158, commitVelocityChange: "+285%", contributors: 100, contributorGrowth: "+0%", newRepos: 0 }, "Deploy frequency spike"],
    [{ commitVelocity14d: 231, commitVelocityChange: "-11%", contributors: 100, contributorGrowth: "+0%", newRepos: 3 }, "Infrastructure buildout"],
    [{ commitVelocity14d: 1158, commitVelocityChange: "-53%", contributors: 8, contributorGrowth: "+220%", newRepos: 0 }, "Engineering hiring burst"],
  ];
  let pass = 0, fail = 0;
  for (const [obs, expected] of cases) {
    const actual = classify(obs);
    const ok = actual === expected;
    console.log(`${ok ? "PASS" : "FAIL"}  expected=${expected}  got=${actual}`);
    if (ok) pass++; else fail++;
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

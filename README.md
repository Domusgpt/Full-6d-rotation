# Refine SO(4) Rotor Pipeline & Extrument Mapping

This branch recenters HypercubeCore on a deterministic SO(4) rotation kernel and a reusable
"extrument" bridge that maps rotation snapshots to external instruments (for example, MIDI
devices). It captures the stabilized math/telemetry stack described throughout the docs while
keeping the codebase ready for the staged rebuild blueprint.

## Quick Start

```bash
npm install
npm run typecheck
npm test -- --run
npm run build
```

The `typecheck` and `test` scripts verify the deterministic rotation helpers, telemetry stores,
and dataset/export services that were refined on this branch. The `build` script produces the
static assets for manual validation in a browser.

## Key Documentation

- [`docs/rotor-pipeline-overview.md`](docs/rotor-pipeline-overview.md) — SO(4) math, uniform-buffer
  contract, and extrument mapping summary.
- [`docs/system-status.md`](docs/system-status.md) — Current state of every subsystem plus manual QA
  steps.
- [`docs/testable-build.md`](docs/testable-build.md) — Checklist for shipping a locally testable build.
- [`docs/refine-rotor-pipeline-branch-report.md`](docs/refine-rotor-pipeline-branch-report.md) — Full
  branch motivation, highlights, and continuation strategy.
- [`docs/rebuild-log.md`](docs/rebuild-log.md) — Session-by-session notes that link code changes to the
  staged clean-room rebuild plan.

## Continuation Path

If you are resuming development, start with the staged plan captured in
[`docs/refine-rotor-pipeline-continuation.md`](docs/refine-rotor-pipeline-continuation.md). It outlines
how to reuse the hardened SO(4) kernel, telemetry loom, dataset exporter, and extrument hub while
progressively rebuilding the HypercubeCore MVP.

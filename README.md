# HypercubeCore Rotor Pipeline Refinement

This branch packages the refined SO(4) rotation kernel, dataset export pipeline, and extrument mapping utilities used across the HypercubeCore rebuild plan. It collects everything required to generate a verified build, stream rotation telemetry to external instruments, and document the system state for follow-up stages.

## Features
- **Deterministic SO(4) rotation bus** – Sequential, matrix, and dual-quaternion helpers share an ordered six-plane angle set with shared energy metrics.
- **Uniform upload orchestration** – A std140 `RotationUniformBuffer` and throttled sync queue guarantee GPU consumers receive every snapshot.
- **Geometry catalog** – Polychoron meshes ship with topology metadata and tests that assert combinatorics for the tesseract, 24-cell, and 600-cell.
- **Extrument integrations** – The parserator, extrument hub, and MIDI adapter normalise sensor data and broadcast snapshots with confidence annotations.
- **Telemetry & dataset export** – Latency tracking, confidence trends, manifest persistence, and worker-backed encoding keep QA artefacts deterministic.
- **Operator tooling** – The control panel includes the plane inspector, telemetry loom, dataset controls, and documentation links for manual QA.

## Getting Started
```bash
npm install
npm run dev
```
Visit http://localhost:5173 to open the control surface. The plane inspector highlights the dominant rotation plane while telemetry panels reflect parserator calibration and dataset state.

## Verification Workflow
The project exposes a unified verification script that runs type checking, Vitest in run mode, and a production build:
```bash
npm run verify
```
Detailed context for the chained workflow lives in [`docs/testable-build.md`](docs/testable-build.md). A full subsystem walkthrough for manual QA follows in [`docs/system-status.md`](docs/system-status.md).

## Documentation Map
- [`docs/rotor-pipeline-overview.md`](docs/rotor-pipeline-overview.md) – Core goals and architecture of the rotor pipeline refinement.
- [`docs/refine-rotor-pipeline-branch-report.md`](docs/refine-rotor-pipeline-branch-report.md) – Branch purpose, stabilisation work, and continuation strategy.
- [`docs/refine-rotor-pipeline-continuation-playbook.md`](docs/refine-rotor-pipeline-continuation-playbook.md) – Stage-by-stage roadmap for extending this foundation.
- [`docs/rebuild-log.md`](docs/rebuild-log.md) – Session-by-session development log with checkpoints for future work.

Refer to [`docs/system-status.md`](docs/system-status.md) for manual QA guidance and [`docs/testable-build.md`](docs/testable-build.md) for test commands before making additional changes.

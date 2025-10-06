# Refine SO(4) Rotor Pipeline & Extrument Mapping — Continuation Playbook

This playbook summarises the branch’s scope, highlights the stabilised components worth carrying forward, and outlines a staged plan for building the next HypercubeCore MVP on top of the refined rotor pipeline.

## Branch Purpose & Scope
- Recenters the project on a deterministic SO(4) rotation kernel where sequential matrices and dual-quaternion paths share the same ordered six-plane snapshot.
- Consolidates rotation state management in `HypercubeCore`, which now owns the std140-aligned uniform buffer and exposes a single upload method for GPU programs.
- Formalises the “extrument” (external instrument) integration surface so IMU mappers, MIDI adapters, and other controllers consume/emit consistent snapshot shapes.

## Core Refinements to Preserve
1. **Rotation math parity** – Reuse `rotationMatrixFromAngles`, `applySequentialRotations`, and `composeDualQuaternion` so every subsystem observes identical plane ordering and tolerances.
2. **Uniform-buffer contract** – Keep `RotationUniformBuffer` responsible for layout/binding and ensure renderers call its `update` entry point when pushing fresh angles.
3. **Snapshot telemetry** – Maintain the typed `RotationSnapshot` interfaces, `rotationEnergy` helper, and associated Vitest coverage to catch regressions when extending the kernel.
4. **Plane inspector telemetry** – Preserve `SIX_PLANE_METADATA` (labels, summaries, cues) and the Plane Inspector highlight logic so operators always see which plane dominates and how the reactive layers should respond.

## Extrument Mapping Surface
- **IMU mapper (`mapImuPacket`)** translates gyro/accel readings into the six-plane snapshot with tunable gains plus confidence metrics for downstream analytics.
- **Extrument hub** coordinates adapter registration, guarded fan-out, and payload normalisation so multiple instruments can subscribe without clobbering state.
- **MIDI adapter** exports the normalised snapshot over Control Change messages, demonstrating how other extruments can reuse the same utility layer.

## Stability Assessment
- The branch ships with exhaustive Vitest coverage for rotation math, uniform uploads, extrument broadcasting, telemetry logging, dataset manifesting, and worker-based frame encoding.
- Buffer reuse and scratch-sharing eliminate per-frame allocations in the rotation path, improving determinism and performance during long captures.
- Documentation updates (rotor pipeline overview, rebuild log, system status, testable build) reflect the code as shipped, reducing divergence between implementation and operator guides.

## Recommended Launch Point for Future Work
The “HypercubeCore–CPE Rebuild Blueprint” recorded in `docs/rebuild-log.md` is the preferred jumping-off point. It incorporates the hardened rotation pipeline while defining staged, clean-room milestones that prevent feature sprawl and keep validation measurable.

## Staged Continuation Strategy
1. **Stages 0–1:** Lift the refined SO(4) kernel into the clean-room `/core` package, add parity tests across sequential/matrix/dual-quaternion flows, and keep the console minimal (geometry picker + rotation controls).
2. **Stage 2:** Restore essential geometry catalogs (tesseract, 24-cell, 600-cell) and keep them GPU-resident; prove that only the rotation uniforms change per frame.
3. **Stage 3:** Expand the parserator/extrument surface—hydrate profile presets, deterministic uniform-sync queues, and replay harnesses for regression capture.
4. **Stages 4–6:** Layer on dataset export, latency envelopes, telemetry loom, projection bridge, HAOS orchestration, and CI tooling, always asserting against the shared snapshot + uniform contract.

## Immediate Next Steps for a Testable Build
- Follow `docs/testable-build.md` to run `npm test -- --run`, `npm run typecheck`, and `npm run build` before manual QA.
- Walk through subsystem validation in `docs/system-status.md`, paying special attention to rotation parity checks, Plane Inspector behaviour, and extrument adapter interactions.
- Record deviations or new requirements in the rebuild log so later stages remain synchronised with the refined foundations.

This document should be updated as follow-on branches land; note staged completions, new adapters, or parity assertions so future operators inherit an accurate continuation map.

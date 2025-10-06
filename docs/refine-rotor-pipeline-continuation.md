# Refine SO(4) Rotor Pipeline: Continuation Playbook

This playbook expands on the branch report and rebuild notes so the refined SO(4) pipeline and extrument mapping work can flow directly into a clean-room MVP. Use it alongside `docs/rebuild-log.md`, `docs/rotor-pipeline-overview.md`, and the staged blueprint when planning next iterations.

## Snapshot of the Refined Foundations

- **Deterministic rotation kernel** – `rotationMatrixFromAngles`, `applySequentialRotations`, and the dual-quaternion helpers consume identical `RotationAngles` ordering and epsilon tolerances, guaranteeing matrix and quaternion parity for all six planes.
- **Uniform-buffer contract** – `RotationUniformBuffer.update` is the single entry point for GPU-bound angles; it owns std140 layout, binding, and dirty-state tracking so every pass reads the same snapshot.
- **Extrument mapping layer** – `ExtrumentHub`, `normalizeSnapshot`, and the MIDI adapter translate rotation snapshots into bounded magnitudes and controller-safe signals with connection lifecycle guards.
- **Dataset + telemetry plumbing** – manifest builders, latency envelopes, telemetry looms, and confidence trends already persist to storage and hydrate from manifests, giving deterministic archives for regression and replay.

## Alignment Checklist

Use this quick sweep before merging further work:

1. **Math parity tests** – Run the dual-quaternion, sequential rotation, and energy unit suites; parity must hold within documented tolerances before any feature work branches off.
2. **Uniform hydration sanity** – Load a dataset manifest in the control panel and verify uniform uploads are sourced from the rehydrated snapshot, not ad-hoc controllers.
3. **Plane inspector cues** – Confirm the inspector highlights the dominant plane after interaction pauses and that the displayed summary/cue text mirrors `docs/system-status.md`.
4. **Extrument guard rails** – With MIDI disabled, ensure the hub idles without throwing; with MIDI enabled, validate connection prompts, payload summaries, and cleanup paths.
5. **Telemetry persistence** – Flush a dataset, reload, and confirm telemetry timelines, manifest stats, and confidence sparklines all restore without mutation.
6. **Documentation pointers** – Confirm `system-status.md`, the rebuild log, and the rotor pipeline overview reference the same module names and file paths touched by recent commits.

## Clean-Room MVP Roadmap (Stages 0–6)

| Stage | Focus | Key Actions | Carry-over Modules |
|-------|-------|-------------|--------------------|
| 0 | Kernel verification | Extract the refined rotation math, uniform buffer, and energy helpers into the `/core` baseline. Re-run parity tests and document epsilon targets. | `rotationUniforms.ts`, `sixPlaneOrbit.ts`, `rotationEnergy.ts` |
| 1 | Minimal renderer | Instantiate `HypercubeCore` with one geometry, wire uniform uploads, and expose a bare status HUD. Disable optional layers (water, bloom, lattice) until Stage 4. | `hypercubeCore.ts`, `frameUtils.ts` |
| 2 | Geometry catalog | Reintroduce tesseract / 24-cell / 600-cell uploads via the GPU-resident pipeline. Validate topology metadata and Euler characteristic assertions. | `geometryCatalog.ts`, `geometryTopology.test.ts` |
| 3 | Parserator ingestion | Port `parserator.ts`, profile presets, and replay harness into the clean-room branch. Lock down calibration persistence and manifest annotations. | `parserator.ts`, `profiles.ts`, `replayHarness.ts` |
| 4 | Telemetry + exports | Layer in the dataset manifest builder, latency tracker, telemetry loom, and manifest export button. Confirm worker/fallback parity for frame encoding. | `datasetManifest.ts`, `latencyTracker.ts`, `datasetExport.ts` |
| 5 | Extruments + audio | Re-enable the extrument hub, MIDI adapter, and audio-reactive shader feeds. Document activation steps and provide defaults that keep external outputs optional. | `extrumentHub.ts`, `midiExtrument.ts`, shader uniform bridges |
| 6 | Presentation polish | Restore the showcase panel, water plane, bloom, and HUD glyph once performance budgets are measured. Update the QA guide and rebuild log with sign-off steps. | `main.ts` showcase scaffolding, water controls, HUD modules |

## Recommended Immediate Tasks

- **Create staging branches per stage**: mirror the table above so each milestone is reviewable and reversible.
- **Automate parity CI**: wire Vitest parity suites into CI to fail builds when quaternion/matrix alignment slips.
- **Document extrument recipes**: expand `docs/system-status.md` with quick-start notes for MIDI routing and external calibration captures.
- **Prepare operator QA scripts**: script console interactions (profile swap, manifest export, dataset reload) so manual testing follows the staged checklist verbatim.

By keeping the refined rotor pipeline as the immutable foundation and layering capabilities in staged increments, the project can ship a lean MVP without sacrificing the advanced telemetry and extrument integrations that differentiate the experience.

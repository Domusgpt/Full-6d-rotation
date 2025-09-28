# HypercubeCore Continuation Strategy

This guide consolidates the recommended path forward after the "Refine SO(4) Rotor Pipeline and Extrument
Mapping" branch. It compares the recent milestone branches, identifies the most promising reference point
for future work, and outlines how to assemble a stable MVP while preserving room for advanced features.

## Recent Branch Comparison

| Branch | Purpose | Stability & Risks | Notable Assets |
| --- | --- | --- | --- |
| **Polychora Showcase Panel** | Curated AV demos with fixed rotation choreographies per polychoron. | Stable for demonstrations but tightly scripted. | Console scenes, parameter presets, cinematic camera cues. |
| **First-Presentation Harmonic Lattice** | Multi-object harmonic rotations aligned to consonant audio ratios for the first public reveal. | Stable when run as a set-piece; complexity makes ad-hoc edits error-prone. | Harmonic rotation schedules, synchronised audio scoring, presentation locking. |
| **Refine SO(4) Rotor Pipeline & Extrument Mapping** | Rebuilt six-plane rotation kernel, uniform uploads, and external adapter plumbing. | High confidence; backed by unit tests across math, telemetry, and adapters. | `RotationUniformBuffer`, `UniformSyncQueue`, parserator calibration APIs, dataset manifest pipeline. |
| **Refocus HypercubeCore – Staged Rebuild Plan** | Strategic blueprint for reconstructing a clean-room MVP using lessons from prior work. | Documentation only, but authoritative on scope sequencing. | Stage definitions, exit criteria, dependency mapping. |

## Recommended Baseline

Use the **Refocus HypercubeCore – Staged Rebuild Plan** as the umbrella roadmap while taking concrete
implementations from **Refine SO(4) Rotor Pipeline & Extrument Mapping** as the technical baseline. The
plan outlines the minimal viable checkpoints; the refined branch supplies production-ready code for the
rotation kernel, telemetry, ingestion, and dataset export contracts.

## MVP Assembly Steps

1. **Stage 0 – Core Shell**
   - Reuse `src/core/hypercubeCore.ts`, `src/core/rotationUniforms.ts`, and `src/core/uniformSyncQueue.ts` to
     guarantee deterministic uniform uploads.
   - Keep only the essential console wiring from `src/main.ts`: geometry selection, rotation controls, and
     parserator calibration.
   - Validate matrix/quaternion parity with `npm test -- --run` to keep math regressions visible.

2. **Stage 1 – Geometry & Projection**
   - Load the minimal geometry catalog from `src/geometry` and project through `src/pipeline/projectionBridge.ts`.
   - Ensure GPU uploads remain resident; avoid reintroducing CPU regeneration paths removed in the refined branch.

3. **Stage 2 – Ingestion & Extruments**
   - Integrate `src/ingestion/parserator.ts`, `src/ingestion/profiles.ts`, and `src/ingestion/extrumentHub.ts`.
   - Offer WebMIDI as the default extrument adapter; keep the hub modular so OSC or other adapters can be
     added without touching the rotation pipeline.

4. **Stage 3 – Telemetry & Datasets**
   - Wire up `src/pipeline/telemetryLoom.ts`, `src/pipeline/confidenceTrend.ts`, and `src/pipeline/datasetManifest.ts`.
   - Expose manifest download/export controls from `index.html` to provide immediate QA feedback.

5. **Stage 4+ – Optional Enhancements**
   - Reintroduce bloom, water, and harmonic showcase modes iteratively, ensuring each effect uses the
     same `RotationUniformBuffer` uploads and telemetry contracts.
   - Layer HAOS or external orchestration via `src/pipeline/haosBridge.ts` once the MVP is stable.

## Manual QA Checklist

1. Run automated checks (`npm run typecheck`, `npm test -- --run`, `npm run build`).
2. Start the dev server (`npm run dev`) and confirm smooth six-plane rotation via mouse/keyboard.
3. Toggle parserator profiles and verify MIDI extrument output via the status block in the control panel.
4. Capture frames until a dataset manifest is populated; download the manifest and confirm it contains
   latency envelopes, confidence histograms, and trend sparklines.
5. Rehydrate the session (refresh the browser) to ensure telemetry, manifest, and confidence trend data
   persist correctly.

By combining the staged plan with the refined rotor pipeline, you can deliver a lean HypercubeCore MVP
that remains extensible for advanced audiovisual showcases and external instrument integrations.

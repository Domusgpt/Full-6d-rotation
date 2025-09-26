# System Status Inventory

This inventory captures the currently implemented subsystems, their responsibilities, and their validation surface so you can verify behaviour quickly before continuing development.

## Core Rotation Bus
- **Rotation snapshots & uniforms.** `RotationUniformBuffer` allocates the std140 buffer, enforces block binding, and updates all six planes in a single call so every render pass shares an identical snapshot contract.【F:src/core/rotationUniforms.ts†L1-L58】
- **Upload orchestration.** `UniformSyncQueue` keeps only the most recent snapshot, tracks skipped uploads, and records timing metadata used for latency telemetry.【F:src/core/uniformSyncQueue.ts†L1-L45】
- **Renderer encapsulation.** `HypercubeCore` owns GL setup, geometry binding, rotation uploads, capture readback, and the uniform-upload listener hook that feeds the export and telemetry pipelines.【F:src/core/hypercubeCore.ts†L1-L160】【F:src/core/hypercubeCore.ts†L882-L938】
- **Unit coverage.** `rotationEnergy` tests guarantee the shared helper remains deterministic and side-effect free for telemetry consumers.【F:src/core/rotationUniforms.test.ts†L1-L44】

## Geometry Catalog & Projection
- The catalog ships with deterministic tesseract, 24-cell, and 600-cell datasets; the 600-cell generator verifies Euler counts before exposing indexed line data and topology metadata for operator readouts.【F:src/geometry/sixHundredCell.ts†L1-L125】
- Geometry uploads flow through `GeometryController`, which updates the control-panel status line with vertex/edge/face/cell counts whenever the selection changes.【F:src/main.ts†L857-L868】【F:src/main.ts†L861-L863】

## Ingestion & Parserator Service
- `Parserator` accepts IMU packets, applies configurable preprocessors, enforces a confidence floor, and maps gyro/accel axes into six rotation planes with profile-specific gains and clamps.【F:src/ingestion/parserator.ts†L1-L178】
- Built-in preprocessors (low-pass gyro, gravity isolation, feature window) can be toggled at runtime, and profile/threshold changes emit telemetry and persist into manifests.【F:src/ingestion/parserator.ts†L129-L178】【F:src/main.ts†L264-L288】

## Extrument Integration
- `ExtrumentHub` manages adapter registration, guarded broadcast, snapshot normalisation, and human-readable payload summaries for the control panel.【F:src/ingestion/extrumentHub.ts†L1-L141】
- The MIDI adapter maps each plane, magnitude, and confidence to control-change values, exposing discovery helpers so WebMIDI devices can subscribe without bespoke wiring.【F:src/ingestion/midiExtrument.ts†L1-L109】
- Control-panel wiring exposes connection status, active adapters, and live payload strings, keeping external integrations visible during QA.【F:src/main.ts†L172-L229】【F:src/main.ts†L800-L835】

## Telemetry, Dataset Export, and Persistence
- The dataset exporter maintains a worker-backed encode queue, records rolling latency samples, and annotates each frame’s envelope for manifest statistics.【F:src/pipeline/datasetExport.ts†L1-L188】
- `DatasetManifestBuilder` assigns deterministic filenames, aggregates latency and confidence histograms, and persists ingestion metadata plus telemetry snapshots for replayability.【F:src/pipeline/datasetManifest.ts†L1-L199】【F:src/pipeline/datasetManifest.ts†L121-L168】
- The telemetry loom provides a bounded, clone-safe event log that hydrates from storage and feeds both the UI and manifest exports.【F:src/pipeline/telemetryLoom.ts†L1-L138】
- Unit suites cover manifest bookkeeping, download naming, telemetry persistence, and histogram rehydration to protect the archival contract.【F:src/pipeline/datasetManifest.test.ts†L1-L200】

## Operator Console & Automation Hooks
- `index.html` hosts the operator console with geometry controls, parserator toggles, extrument status, manifest telemetry, and sparkline canvas regions laid out in the sidebar.【F:index.html†L17-L197】
- `main.ts` binds every DOM control to the rotation bus, telemetry updates, dataset flushing, manifest download, and extrument connection flows, so live sessions exercise the full stack without additional glue code.【F:src/main.ts†L45-L229】【F:src/main.ts†L828-L956】【F:src/main.ts†L959-L1032】
- Synthetic harmonic orbits keep the system active for manual QA even without sensor input, while the focus director and rotation controls expose deterministic reproducibility hooks.【F:src/main.ts†L1011-L1032】【F:src/main.ts†L162-L223】

## Test & Verification Surface
- Automated regression: `npm test -- --run` executes the Vitest suite spanning rotation helpers, parserator, extrument hub, telemetry, manifest, export, and worker codepaths.【F:docs/testable-build.md†L10-L22】
- Static analysis: `npm run typecheck` verifies the DOM/WebMIDI/worker TypeScript surfaces before bundling.【F:docs/testable-build.md†L13-L18】
- Production build: `npm run build` emits the Vite bundle plus dataset worker to validate release readiness.【F:docs/testable-build.md†L19-L24】

Use this document alongside the manual QA checklist to confirm subsystems remain stable as you iterate.

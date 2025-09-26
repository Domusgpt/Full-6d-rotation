# System State Register

## Subsystem Overview
| Subsystem | Primary modules | Runtime status | Automated coverage |
| --- | --- | --- | --- |
| SO(4) rotation kernel & uniform bus | `src/core/so4.ts`, `rotationUniforms.ts`, `uniformSyncQueue.ts` | Deterministic six-plane math feeds a queued uniform buffer before every draw call. | `src/core/so4.test.ts`, `rotationUniforms.test.ts`, `uniformSyncQueue.test.ts` |
| Rendering core & geometry catalog | `src/core/hypercubeCore.ts`, `pipeline/geometryController.ts`, `geometryCatalog.ts` | WebGL2 renderer owns the uniform buffer, VAO state, and geometry loading. | `src/core/frameUtils.test.ts`, geometry topology tests |
| Sensor ingestion & parserator | `src/ingestion/parserator.ts`, `profiles.ts`, `imuMapper.ts` | Profiles, preprocessors, and confidence floors normalize IMU packets into snapshots. | `src/ingestion/parserator.test.ts`, `profiles.test.ts` |
| Extrument mapping | `src/ingestion/extrumentHub.ts`, `midiExtrument.ts` | Normalises snapshots and streams MIDI CC payloads with guarded broadcasts. | `src/ingestion/extrumentHub.test.ts`, `midiExtrument.test.ts` |
| Telemetry & confidence analytics | `src/pipeline/telemetryLoom.ts`, `confidenceTrend.ts`, `main.ts` HUD | Rolling telemetry log hydrates from manifests and plots confidence history. | `src/pipeline/telemetryLoom.test.ts`, `confidenceTrend.test.ts` |
| Dataset capture & manifest | `src/pipeline/datasetExport.ts`, `datasetManifest.ts`, `main.ts` capture loop | Worker-backed exports track latency envelopes and persist manifests. | `src/pipeline/datasetExport.test.ts`, `datasetManifest.test.ts` |
| Focus & PSP orchestration | `src/pipeline/focusDirector.ts`, `rotationBus.ts`, `pspStream.ts` | Focus hints select geometries and broadcast encoded frames to PSP subscribers. | `src/pipeline/focusDirector.test.ts`, `pspStream.test.ts` |
| UI console & manual rotation | `index.html`, `src/main.ts` | Control panel exposes geometry, rotation sliders, telemetry, and extrument controls. | Vitest UI-less tests; manual verification via checklist |

## Detailed Notes
### SO(4) rotation kernel & uniform bus
- `rotationMatrixFromAngles`, sequential vector rotation, and dual-quaternion composition share the same plane ordering, preventing divergence between math paths.【F:src/core/so4.ts†L4-L160】
- The uniform buffer writes six angles into a std140-aligned block while `UniformSyncQueue` de-bounces uploads and records latency metrics for telemetry.【F:src/core/rotationUniforms.ts†L15-L57】【F:src/core/uniformSyncQueue.ts†L3-L46】
- Automated tests assert parity between sequential and matrix rotations plus uniform buffer immutability.【F:src/core/so4.test.ts†L6-L38】【F:src/core/rotationUniforms.test.ts†L1-L74】【F:src/core/uniformSyncQueue.test.ts†L1-L74】

### Rendering core & geometry catalog
- `HypercubeCore` owns WebGL program creation, uniform binding, VAO setup, frame capture, and render loop scheduling, exposing hooks for uniform latency metrics.【F:src/core/hypercubeCore.ts†L1-L120】【F:src/core/hypercubeCore.ts†L66-L118】
- Geometry descriptors are enumerated once, cached, and bound through `GeometryController`, keeping GPU uploads deterministic.【F:src/pipeline/geometryController.ts†L5-L30】
- The renderer captures frames with vertical flip correction so dataset exports receive canonical pixel orientation.【F:src/core/hypercubeCore.ts†L70-L104】

### Sensor ingestion & parserator
- The parserator applies a configurable chain of preprocessors, delta timing, and mapping profiles before emitting rotation snapshots with enforced confidence floors.【F:src/ingestion/parserator.ts†L23-L128】
- Built-in profiles provide tuned spatial/hyperspatial gains, optional clamps, and smoothing values for different calibration modes.【F:src/ingestion/profiles.ts†L20-L69】
- IMU packets translate to six-plane angles while telemetry events log profile hydration, preprocessor toggles, and confidence adjustments for later audits.【F:src/ingestion/imuMapper.ts†L1-L55】【F:src/main.ts†L235-L284】【F:src/main.ts†L540-L586】

### Extrument mapping
- `ExtrumentHub` manages adapter lifecycle, normalization, and guarded broadcasting so multiple outputs can subscribe without mutating shared state.【F:src/ingestion/extrumentHub.ts†L24-L94】
- MIDI adapters clamp and stream plane values, magnitude, and confidence to configurable control change lanes for external synths or controllers.【F:src/ingestion/midiExtrument.ts†L27-L109】
- The main loop displays connection status, payload summaries, and handles WebMIDI discovery failures gracefully.【F:src/main.ts†L172-L229】【F:src/main.ts†L739-L819】

### Telemetry & confidence analytics
- A 180-entry telemetry loom snapshots parserator, ingestion, extrument, and system events, preserving metadata across sessions via manifest hydration.【F:src/pipeline/telemetryLoom.ts†L24-L91】【F:src/main.ts†L185-L247】
- The confidence trend store clamps values, caps history length, and serializes to localStorage for manifest download previews.【F:src/pipeline/confidenceTrend.ts†L18-L88】【F:src/main.ts†L326-L385】
- Canvas rendering draws the 90% reference line and highlights the latest data point for at-a-glance QA.【F:src/main.ts†L414-L501】

### Dataset capture & manifest
- The dataset export service batches frame payloads, prefers a worker if available, and records encode latency samples for telemetry displays.【F:src/pipeline/datasetExport.ts†L51-L170】
- Captured frames include uniform and capture latency envelopes before encoding, ensuring manifests track full pipeline timing.【F:src/main.ts†L883-L920】
- Manifest builder assigns deterministic asset names, aggregates latency statistics, rehydrates telemetry logs, and persists ingestion metadata for reproducible datasets.【F:src/pipeline/datasetManifest.ts†L75-L167】【F:src/pipeline/datasetManifest.ts†L169-L200】【F:src/main.ts†L388-L399】【F:src/main.ts†L687-L695】
- Vitest suites cover worker fallback, latency envelopes, hydration, and download naming, guarding regression risk.【F:src/pipeline/datasetExport.test.ts†L49-L120】【F:src/pipeline/datasetManifest.test.ts†L6-L160】

### Focus, PSP stream, and rotation bus
- `FocusDirector` watches for inactivity, restores a fallback geometry, and applies rotation or confidence hints through the rotation bus.【F:src/pipeline/focusDirector.ts†L17-L85】
- The rotation bus fans out snapshots to the renderer, extrument payloads, and dataset capture, guaranteeing consistent state snapshots.【F:src/pipeline/rotationBus.ts†L5-L26】【F:src/main.ts†L224-L316】
- Encoded frames publish to a local PSP stream so downstream subscribers (e.g., dataset downloads or visualizers) receive updates synchronously.【F:src/pipeline/pspStream.ts†L12-L24】【F:src/main.ts†L928-L936】

### UI console & manual rotation
- The control panel layout exposes geometry selection, projection depth, line width, dataset stats, parserator controls, extrument status, and telemetry log with semantic styling for each category.【F:index.html†L17-L200】
- Rotation sliders allow manual offsets per plane while an auto harmonic orbit keeps the scene animated for hands-free testing.【F:src/main.ts†L959-L1008】【F:src/main.ts†L1011-L1028】
- Dataset telemetry, extrument payload summaries, and manifest metrics refresh every second for live QA feedback.【F:src/main.ts†L721-L737】【F:src/main.ts†L1000-L1032】

### Build & quality gates
- `docs/testable-build.md` enumerates the required install, test, typecheck, and build commands to produce a shippable bundle.【F:docs/testable-build.md†L1-L24】
- Package scripts route through Vitest and TypeScript to keep browser- and worker-facing modules type-safe.【F:package.json†L7-L20】

## Personal Testing Checklist
1. **Prepare tooling** – install dependencies, run the full Vitest suite, static type analysis, and production build to confirm automation parity.
   ```bash
   npm install
   npm test -- --run
   npm run typecheck
   npm run build
   ```
2. **Launch the dev server** – run `npm run dev` and open the reported Vite URL. Confirm the canvas and control panel render without console errors.【F:index.html†L1-L110】
3. **Verify geometry & rotation controls** – switch the geometry dropdown, adjust projection depth/line width, and move rotation sliders; confirm status text updates with vertex/edge counts and slider labels reflect offsets.【F:src/main.ts†L846-L882】【F:src/main.ts†L959-L1008】
4. **Check telemetry counters** – observe uniform upload, capture, and encode latency rows ticking once per second and the confidence trend chart plotting samples as frames accumulate.【F:src/main.ts†L721-L737】【F:src/main.ts†L414-L501】
5. **Exercise parserator settings** – swap mapping profiles, tweak the confidence floor, and toggle preprocessors; confirm telemetry log entries and manifest ingestion metadata reflect the changes.【F:src/main.ts†L264-L288】【F:src/main.ts†L656-L695】【F:src/main.ts†L540-L586】
6. **Test extrument flow (if WebMIDI available)** – click “Connect MIDI”, grant browser access, and ensure the status text lists connected outputs while payload summaries mirror rotation energy. Disconnect or reload to verify cleanup.【F:src/main.ts†L739-L819】
7. **Validate dataset capture** – allow the system to queue frames (pending counter > 0), wait for automatic flush, and confirm manifest statistics, latency metrics, and PSP stream hooks update. Use “Download Manifest” to export the JSON bundle.【F:src/main.ts†L883-L938】【F:src/main.ts†L942-L957】
8. **Persist & reload** – refresh the page to confirm manifests, telemetry, and confidence trend hydrate from localStorage, restoring UI state without manual intervention.【F:src/main.ts†L136-L169】【F:src/main.ts†L185-L247】

Following this checklist validates every subsystem end-to-end so you can personally confirm the SO(4) pipeline, telemetry, dataset export, and extrument integrations remain production-ready.

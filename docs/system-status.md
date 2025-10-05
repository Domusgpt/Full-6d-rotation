# HypercubeCore System Status & QA Guide

This document consolidates the current state of every major HypercubeCore subsystem and
captures the manual QA flows you can run after producing a testable build.

## Quick Reference
- **Automated build & verification:** Follow [`docs/testable-build.md`](./testable-build.md).
- **Primary entry point:** `npm run dev` (served via Vite on port 5173).
- **Datasets & telemetry:** Persist to `localStorage` and can be exported via the control panel.

## 1. Core Rotation & Rendering
| Component | Location | Status | Notes |
| --- | --- | --- | --- |
| Rotation math primitives | `src/core/sixPlaneOrbit.ts`, `src/core/frameUtils.ts` | ✅ Stable | Shared angle ordering across sequential, matrix, and dual-quaternion helpers. Covered by unit tests for immutability and energy calculations. |
| Uniform buffer orchestration | `src/core/rotationUniforms.ts`, `src/core/uniformSyncQueue.ts` | ✅ Stable | Std140-aligned `RotationUniformBuffer` manages uploads; `UniformSyncQueue` gates GPU writes to avoid skipped frames. |
| Renderer shell | `src/core/hypercubeCore.ts` | ✅ Stable | Owns shader compilation, geometry uploads, and per-frame scheduling. Exposes deterministic capture hooks for dataset exports. |
| Uber shader builder | `src/core/uberShaderBuilder.ts` | ✅ Stable | Generates shader variants with the correct uniform bindings for rotation, audio, and lighting controls. |

### Manual QA
1. `npm run dev` → open http://localhost:5173.
2. Rotate geometry with mouse/trackpad; confirm smooth motion and no console errors.
3. Toggle rotation pause/resume from the control panel to ensure uniforms resume correctly.

## 2. Geometry Catalog
| Component | Location | Status | Notes |
| --- | --- | --- | --- |
| Polychoron topology metadata | `src/geometry/types.ts`, `src/geometry/sixHundredCell.ts`, etc. | ✅ Stable | Every geometry embeds Euler characteristic metadata; unit tests cover the 600-cell vertex/face counts. |
| Geometry controller | `src/pipeline/geometryController.ts` | ✅ Stable | Manages live swaps with throttled uniform updates and telemetry hooks. |

### Manual QA
- Cycle through geometries in the console. The status readout should update counts and maintain frame rate.

## 3. Ingestion & Extruments
| Component | Location | Status | Notes |
| --- | --- | --- | --- |
| Parserator service | `src/ingestion/parserator.ts` | ✅ Stable | Profiles, preprocessors, and confidence floors persist to manifests. Tests cover hydration and runtime swaps. |
| Profile registry | `src/ingestion/profiles.ts` | ✅ Stable | High-gain and smoothing presets available; verified by unit tests. |
| Replay harness | `src/ingestion/replayHarness.ts` | ✅ Stable | Plays back captured snapshots for deterministic regression runs. |
| Extrument hub | `src/ingestion/extrumentHub.ts` | ✅ Stable | Normalizes snapshots, manages adapter lifecycles, and guards broadcasts. |
| MIDI adapter | `src/ingestion/midiExtrument.ts` | ✅ Stable | Streams normalized snapshots as Control Change messages. Vitest covers discovery and payload formatting. |

### Manual QA
1. Enable the **Extruments** panel, request WebMIDI access, and connect to a virtual synth.
2. Confirm live rotation updates stream MIDI CC events (verify via synth UI or console logs).
3. Switch parserator profiles to ensure confidence readings respond immediately.

## 4. Telemetry & Analytics
| Component | Location | Status | Notes |
| --- | --- | --- | --- |
| Telemetry loom | `src/pipeline/telemetryLoom.ts` | ✅ Stable | Snapshot log with serialization, hydration, and capacity clamps; unit-tested. |
| Confidence trend store | `src/pipeline/confidenceTrend.ts` | ✅ Stable | Tracks rolling high-confidence ratios with parserator calibration annotations and persistence to localStorage. |
| Latency tracker | `src/pipeline/latencyTracker.ts` | ✅ Stable | Records uniform, capture, and encode timing envelopes for each frame. |
| Focus director | `src/pipeline/focusDirector.ts` | ✅ Stable | Adjusts camera focus based on rotation energy and telemetry thresholds. |
| HAOS bridge | `src/pipeline/haosBridge.ts` | ✅ Stable | Publishes telemetry snapshots to external orchestration clients. |

### Manual QA
- Observe the telemetry timeline in the console. Trigger rotations and dataset exports; confirm logs, latencies, and confidence sparkline update without exceeding capacity limits.

## 5. Dataset Export Pipeline
| Component | Location | Status | Notes |
| --- | --- | --- | --- |
| Manifest builder | `src/pipeline/datasetManifest.ts` | ✅ Stable | Deterministic file naming, p95 latency aggregation, hydration from prior manifests, and persists confidence-trend sparkline samples. |
| Dataset exporter | `src/pipeline/datasetExport.ts` | ✅ Stable | Orchestrates capture, encoding (worker or JSON fallback), and manifest persistence. |
| Frame encoding | `src/pipeline/frameEncoding.ts`, `src/pipeline/datasetWorker.ts` | ✅ Stable | Worker-backed pipeline with fallback path; tests cover both execution modes. |
| PSP stream | `src/pipeline/pspStream.ts` | ✅ Stable | Streams captured frames for progressive preview during exports. |

### Manual QA
1. Accumulate frames (allow the capture queue to run until non-zero frame count is shown).
2. Click **Download Manifest**; verify file name uses timestamped deterministic format.
3. Inspect manifest JSON for telemetry envelopes, confidence histogram, extrument state, and the `confidenceTrend` sparkline payload (each `sample` should include the parserator profile, confidence floor, and preprocessors active for that datapoint).

## 6. Control Panel & UI Layer
| Component | Location | Status | Notes |
| --- | --- | --- | --- |
| Control panel wiring | `src/main.ts` | ✅ Stable | Hydrates/persists confidence trends, telemetry logs, manifest snapshots, and extrument status.
| UI assets | `index.html` | ✅ Stable | Hosts the console layout, dataset controls, extrument panel, and telemetry widgets.

### Manual QA
- Use the console toggles for parserator, telemetry overlays, and dataset exporters. Ensure each panel persists state across refreshes (localStorage-backed).

## 7. Reactive Visualizer & 4D Parameter Effects

| Control | Plane | Visual Response | Reactive Cue |
| --- | --- | --- | --- |
| XY · Spatial spin | `xy` | Traditional spin around the vertical axis that carries the entire hull in an orbit. | Bloom highlights trace the outer rim and the extrument magnitude increases smoothly. |
| XZ · Pitch fold | `xz` | Forward/back tilts that expose top/bottom cells and stretch the projection vertically. | Waterplane ripples sync with the rocking motion and mid-band audio brightens. |
| YZ · Lateral sweep | `yz` | Side-to-side sweep of the silhouette, swapping left/right struts in view. | Telemetry loom shows alternating side pulses while the HUD glyph oscillates. |
| XW · Hyper reveal | `xw` | Hyper-rotation that pulls hidden interior cells outward. | Confidence trend bumps upward and interior highlights flare as latent structure appears. |
| YW · Vertical weave | `yw` | Braids vertical columns into the W axis producing a climbing shimmer. | Telemetry logs note parserator confidence shifts; high-frequency audio partials activate. |
| ZW · Depth breathe | `zw` | Causes the projection to expand and contract as depth trades with W. | Pending-frame telemetry spikes with each inhale/exhale and bass reactive layers pulse. |

### Manual QA
1. Let the default harmonic orbit play (it starts automatically) and hover over each slider to read the summary; confirm the projection behaves as described.
2. Drag a single slider toward ±3.14 radians for a few seconds to isolate that plane and verify the reactive cues (bloom, waterplane, HUD glyph, audio meters) respond as listed.
3. Log a telemetry event (e.g., change parserator profile) while emphasising a hyperplane rotation to confirm confidence metrics stay aligned with perceived motion.

## 8. Documentation & Operational Notes
- [`docs/rebuild-log.md`](./rebuild-log.md): Session-by-session history tying new capabilities to the staged rebuild blueprint.
- [`docs/rotor-pipeline-overview.md`](./rotor-pipeline-overview.md): High-level rationale for the refined rotation and extrument systems.
- [`docs/testable-build.md`](./testable-build.md): Command checklist for automated verification.

## Manual QA Checklist (Post-Automation)
1. Produce a clean workspace and install dependencies.
2. Run all automated checks per `docs/testable-build.md`.
3. Start the dev server and perform the manual QA steps outlined in Sections 1–7.
4. Export a dataset manifest and verify telemetry payloads.
5. (Optional) Connect a WebMIDI target to validate extrument streaming in a live environment.

Completing this checklist confirms the refined SO(4) rotor pipeline, dataset exporter, telemetry instrumentation, and extrument mapping are functioning end-to-end.

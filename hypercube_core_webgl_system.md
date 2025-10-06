# HypercubeCore WebGL System Documentation
*Real-time SO(4) Rendering with Deterministic Uniform Management*

This document reflects the current TypeScript implementation under `src/core/` and `src/pipeline/`. Earlier drafts referenced ad-hoc JavaScript prototypes; all sections below now map to concrete modules in the repository.

## System Overview

HypercubeCore is a WebGL2 renderer that accepts six-plane SO(4) rotation snapshots, keeps geometry resident on the GPU, and exposes capture hooks for dataset export and telemetry pipelines. It cooperates with the parserator ingestion stack and pipeline services described in the staged rebuild blueprint.

## Core Architecture

### HypercubeCore (`src/core/hypercubeCore.ts`)
- Manages WebGL2 context acquisition, shader compilation via `UberShaderBuilder`, VAO state, and animation loop scheduling.
- Owns a single `RotationUniformBuffer` instance and guarantees std140-compliant uploads through `setRotations`.
- Provides `captureFrame` and `setUniformUploadListener` to synchronise dataset exports with the exact snapshot presented to the GPU.
- Exposes `setGeometry` to bind vertex buffers sourced from `src/geometry/` definitions (tesseract, 24-cell, 600-cell, etc.).

### Rotation Uniform Management (`src/core/rotationUniforms.ts`)
- Defines `RotationAngles`, `RotationSnapshot`, and `rotationEnergy` utilities reused across ingestion and telemetry.
- Allocates a vec4×2 uniform buffer (`FLOATS_PER_BLOCK = 8`) to align with std140 rules and avoid driver-specific padding bugs.
- Provides deterministic update semantics that tests cover in `rotationUniforms.test.ts`.

### Six-Plane Orbit & Shader Assembly
- `sixPlaneOrbit.ts` – builds sequential rotation matrices, applies dual-quaternion parity tests, and exposes the canonical plane key ordering used across the codebase.
- `uberShaderBuilder.ts` – assembles vertex/fragment shader sources with projection, lighting, and debug instrumentation injected at build time. Tests in `uberShaderBuilder.test.ts` ensure generated shaders include required uniform blocks and macros.

### Geometry Catalogue (`src/geometry/`)
- `types.ts` defines topology metadata, Euler characteristic checks, and typed attribute layouts.
- `tesseract.ts`, `twentyFourCell.ts`, `sixHundredCell.ts` provide static buffers for regular polychora with deterministic vertex ordering.
- `geometryTopology.test.ts` guards vertex/edge/facet counts and Euler characteristic invariants.

## Pipeline Integration Points

### Uniform Sync Queue (`src/core/uniformSyncQueue.ts`)
- Records every uniform upload with timestamps, pending queue depth, and skip counters used by latency trackers.
- Tests validate that enqueued snapshots resolve in order and remain immutable.

### Dataset Export & Telemetry (`src/pipeline/`)
- `datasetExport.ts` coordinates capture triggers, PSP export, and worker delegation via `datasetWorker.ts`.
- `latencyTracker.ts`, `telemetryLoom.ts`, and `confidenceTrend.ts` consume metrics from the uniform sync queue to surface operator dashboards in the control panel.
- `datasetManifest.ts` persists per-frame latency envelopes, parserator calibration context, and deterministic asset naming for archival.

## Control Panel (`index.html`, `src/main.ts`)
- Organises controls into rotation, geometry, parserator, extrument, dataset telemetry, and manifest sections.
- Hydrates persistent state (confidence trends, telemetry loom, manifests) on load and wires UI actions to the corresponding services.
- Displays uniform upload counts, capture/encode latency, extrument connection state, and manifest statistics to keep operators aligned with runtime behaviour.

## Development & Testing
- **Build/Test Commands:** `npm install`, `npm test -- --run`, `npm run typecheck`, `npm run build` (see `docs/testable-build.md`).
- **Unit Coverage:** Vitest suites cover rotation math, uniform buffer semantics, parserator calibration flows, extrument hub behaviour, dataset export, manifest persistence, telemetry analytics, and worker fallbacks.
- **Manual QA:** Control-panel telemetry and extrument summaries provide real-time validation when testing new parserator profiles or external adapters.

Maintaining the documentation in this format ensures future contributors can map architectural concepts directly to the TypeScript modules that implement them.

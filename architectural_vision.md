# Architectural Vision for HypercubeCore & Parserator Platform

This revision brings the architectural notes back in sync with the current TypeScript codebase that powers the HypercubeCore SO(4) renderer, parserator ingestion stack, and orchestration services. It captures how the real modules under `src/` collaborate today and how the staged rebuild plan extends them.

## System Pillars

### 1. HypercubeCore Rendering Kernel
- **Location:** `src/core/`
- **Key Modules:**
  - `hypercubeCore.ts` – owns the WebGL2 context, shader program lifecycle, uniform buffer binding, and frame capture entry points.
  - `rotationUniforms.ts` – defines the canonical `RotationAngles`/`RotationSnapshot` types plus the std140 uniform buffer contract.
  - `sixPlaneOrbit.ts` & `uberShaderBuilder.ts` – generate sequential rotation matrices and assemble shader sources that consume the uniform block.
- **Responsibilities:**
  - Maintain deterministic parity between sequential-matrix, dual-quaternion, and GPU uniform uploads.
  - Expose capture hooks (`captureFrame`, `setUniformUploadListener`) that feed dataset export and telemetry systems.
  - Provide geometry registration (`setGeometry`) that keeps the active polychoron resident on the GPU for all downstream stages.

### 2. Parserator Micro-Kernel & Extrument Mapping
- **Location:** `src/ingestion/`
- **Key Modules:**
  - `parserator.ts` – runtime-configurable ingestion kernel with profile swapping, confidence-floor tuning, and disposable preprocessors.
  - `profiles.ts` – registry of named calibration profiles used by the console and manifest persistence.
  - `extrumentHub.ts` & `midiExtrument.ts` – adapter hub with snapshot normalisation, MIDI broadcast helpers, and error isolation per adapter.
  - `replayHarness.ts` – deterministic playback utility for captured rotation streams.
- **Responsibilities:**
  - Convert IMU/external instrument packets into `RotationSnapshot` updates for the rotation bus.
  - Persist calibration context (profile, preprocessors, thresholds) for deterministic rehydration.
  - Provide safe broadcast paths to MIDI or other extruments while maintaining snapshot confidence guarantees.

### 3. Pipeline, Telemetry, and Dataset Services
- **Location:** `src/pipeline/`
- **Key Modules:**
  - `datasetExport.ts`, `datasetWorker.ts`, `frameEncoding.ts` – PSP capture/export orchestrators with worker offload and latency tracking.
  - `datasetManifest.ts`, `datasetTypes.ts` – manifest builder with deterministic naming, hydration, and latency envelope aggregation.
  - `telemetryLoom.ts`, `confidenceTrend.ts`, `latencyTracker.ts` – runtime analytics surfaces for control-panel telemetry and manifest enrichment.
  - `contextScheduler.ts`, `focusDirector.ts`, `haosBridge.ts`, `projectionBridge.ts` – orchestration utilities described in the rebuild blueprint stages.
- **Responsibilities:**
  - Sample pipeline latency (sensor→uniform→capture→encode) and expose live/aggregated metrics.
  - Persist manifests, telemetry snapshots, and calibration metadata across sessions.
  - Drive PSP exports via worker-backed pipelines without starving the render loop.

### 4. Control Panel & Operator Experience
- **Location:** `index.html`, `src/main.ts`
- **Key Features:**
  - Parameter console with sections for geometry selection, rotation playback, parserator calibration, extrument status, and dataset telemetry.
  - Hydration/persistence wiring for manifests, telemetry loom, confidence trends, and extrument adapters.
  - Event routing that synchronises UI intent with HypercubeCore, parserator, and export services.

## Cloud Orchestration & HAOS Alignment
- **HAOS Bridge (`src/pipeline/haosBridge.ts`):** Defines the contract for higher-order automation to request captures, adjust focus targets, and subscribe to telemetry envelopes.
- **Focus Director (`src/pipeline/focusDirector.ts`):** Uses telemetry and HAOS cues to prioritise geometry/ingestion tasks during replay or live sessions.
- **Context Scheduler (`src/pipeline/contextScheduler.ts`):** Coordinates worker pools, uniform uploads, and dataset flush cadence to honour latency budgets defined in the rebuild blueprint.

These modules collectively fulfil the distributed-intelligence goals outlined for edge parserator nodes and higher-level orchestration: the parserator stack surfaces calibrated snapshots, HypercubeCore renders deterministic frames, and the pipeline services record artefacts/telemetry for HAOS or external consumers.

## Development Track Alignment
- **Stage 0–1 (Core Kernel Rebuild):** Reuse `RotationUniformBuffer`, `HypercubeCore`, and `parserator` core while establishing parity tests across sequential, matrix, and dual-quaternion paths.
- **Stage 2 (Geometry & Capture):** Keep geometry uploads GPU-resident through `setGeometry` and validate capture via `captureFrame` against staged datasets.
- **Stage 3 (Parserator Service & Extruments):** Expand `extrumentHub` adapters and HAOS bridge hooks to support external instruments and replay harness integration.
- **Stage 4–6 (Export, Telemetry, Automation):** Leverage dataset export worker, manifest persistence, telemetry loom, and HAOS bridge to satisfy automation, performance, and orchestration checkpoints.

All future planning documents should reference these concrete modules and the staged rebuild blueprint to stay aligned with the production TypeScript system.

# Rebuild Blueprint Progress Log

This log captures the follow-on work after the “Implement staged rebuild blueprint” baseline. Each entry records what was added in this session and why that piece matters for the staged HypercubeCore MVP.

## Session – Telemetry & Frame Capture Bring-Up

### What changed
- **WebGL frame capture** (`HypercubeCore.captureFrame`, `flipPixelsVertically`) – expose a deterministic pixel readback so downstream services can pull actual render output instead of placeholder pixels.
- **Dataset export metrics** (`DatasetExportService`) – track pending queue depth, total encoded frames, and last export format while flushing frames through the PSP stream.
- **Control-panel telemetry** (`index.html`, `main.ts`) – surface uniform upload/skipped counts and dataset export metrics next to the rotation controls, keeping the operator aware of buffer health.
- **Synthetic capture wiring** (`main.ts`) – replace the stubbed 1×1 pixel export with real captures throttled by queue depth and broadcast them via `LocalPspStream`.

### Why these pieces matter
- The **frame capture path** proves that Stage 2 geometry uploads can feed Stage 4 dataset export without leaving the GPU pipeline—critical for PSP archival and ML consumers.
- **Dataset metrics** let us validate the UniformSync queue contract (exactly one upload per frame) and ensure capture/export doesn’t fall behind during automated or sensor-driven runs.
- **UI telemetry** provides immediate operator feedback: if skips rise or pending frames spike, we know to adjust ingestion cadence before confidence drops.
- **Real PSP captures** mean every rotation snapshot now carries a verifiable visual, keeping replay harnesses and external extruments in sync with the actual render output.

### Next checkpoints
- Thread the capture path through the dataset exporter worker once the Web Worker harness lands (Stage 4).
- Extend telemetry with rolling latency stats (sensor → uniform upload → capture) to satisfy Stage 6 performance budgets.

## Session – Worker Export Harness & Latency Telemetry

### What changed
- **Dataset export worker** (`datasetWorker.ts`, `DatasetExportService`) – spin up a dedicated encoder worker when available, track per-frame encode latency, and retain the JSON fallback for deterministic Node/Vitest runs.
- **Pipeline latency tracker** (`LatencyTracker`) – capture rolling averages/maxima for sensor→uniform, uniform→capture, and encode phases, wiring the telemetry into the control panel for real-time monitoring.
- **UI telemetry expansion** (`index.html`, `main.ts`) – surface uniform/capture/encode latency readouts plus last export format so operators can correlate queue depth with timing budgets.

### Why these pieces matter
- The **worker harness** keeps Stage 4 PSP exports off the main thread, preventing encode spikes from starving animation or sensor ingestion.
- **Latency telemetry** closes the Stage 6 gap by quantifying the end-to-end pipeline budget, highlighting regressions long before they impact HAOS orchestration or ML taps.
- The **control-panel readouts** give immediate feedback during live sessions, making it easier to tune parserator gains or dataset flush cadence when pending frames creep up.

### Next checkpoints
- Promote the worker harness into a reusable Web Worker pool once Stage 5 inference taps start sharing GPU time.
- Record sensor-to-export latency envelopes alongside encoded frames to feed Stage 6 performance regression tests.

## Session – Sensor→Export Latency Envelopes

### What changed
- **Uniform upload callbacks** (`HypercubeCore.setUniformUploadListener`) – expose a hook after each std140 upload so the main loop can align capture and PSP export with the exact snapshot that reached the GPU.
- **Capture-triggered exports** (`main.ts`) – throttle capture inside the uniform callback, record capture latency, and attach uniform/capture timings to every queued frame before PSP export.
- **Encode annotations** (`DatasetExportService`) – persist encode-complete timestamps and total pipeline latency inside each frame’s metadata, regardless of whether encoding happens inline or via the worker.
- **Latency-aware metadata** (`datasetTypes.ts`, tests) – formalise a `PipelineLatencyEnvelope` contract and cover the fallback/worker paths so regressions surface during CI.

### Why these pieces matter
- **Deterministic envelopes** ensure Stage 6 tooling can assert sensor→uniform→capture→encode budgets directly from dataset artifacts instead of relying on external logs.
- **Render-synchronised capture** keeps PSP snapshots aligned with the rotation state actually presented to the viewer, avoiding off-by-one uniform artefacts in downstream training data.
- **Test coverage** guards against future refactors dropping latency timestamps, giving the rebuild blueprint a verified telemetry contract to build upon.

### Next checkpoints
- Persist latency envelopes alongside dataset manifests so replay harnesses can compare live runs against recorded totals.
- Expose histogram/percentile views of the envelope metrics in the control panel for Stage 6 operator dashboards.

## Session – Dataset Manifest Persistence

### What changed
- **Dataset manifest builder** (`datasetManifest.ts`, tests) – generate deterministic asset names, retain per-frame latency envelopes, and compute aggregate statistics with optional rehydration from previous sessions.
- **Local storage persistence** (`main.ts`) – hydrate the manifest on load, append entries as PSP exports flush, and guard persistence with error logging when storage is unavailable.
- **Control-panel telemetry** (`index.html`, `main.ts`) – surface manifest frame counts and p95 latency so operators can monitor archival coverage alongside live export metrics.

### Why these pieces matter
- The **builder** gives Stage 4+ pipelines a deterministic manifest contract so downstream tooling can reconcile encoded assets with their latency envelopes and rotation snapshots.
- **Persistence** means operators can stop and resume sessions without losing manifest continuity, satisfying the rebuild blueprint’s requirement for deterministic dataset bookkeeping.
- The **UI telemetry** closes the loop by exposing archival health directly in the control panel, enabling quick validation that latency percentiles stay within Stage 6 performance budgets.

### Next checkpoints
- Add manifest export/download affordances so recorded sessions can be archived or shared outside the browser sandbox.
- Thread manifest statistics into the rebuild telemetry loom once percentile visualisations ship in Stage 6.

## Session – Extrument Calibration & Parserator Persistence

### What changed
- **Calibration toolkit** (`calibration.ts`, tests) – introduced reusable helpers to snapshot rotation offsets, blend repeated captures, and serialize the resulting profile for persistence.
- **Parserator integration** (`parserator.ts`, tests) – applied calibrations to every emitted snapshot, exposed smoothing-based capture/clear APIs, and reused the toolkit during replay harness runs.
- **Operator UI & storage** (`index.html`, `main.ts`) – surfaced calibration status in the control panel, added zero/clear buttons, and persisted the active calibration alongside the dataset manifest.

### Why these pieces matter
- The **calibration profile** keeps IMU-driven extruments from drifting after setup, giving operators a deterministic way to zero the six-plane snapshot before routing it to MIDI or other adapters.
- **Parserator smoothing** makes on-device calibration reproducible: repeated captures converge to a stable offset even when live packets include noise, satisfying the rebuild blueprint’s deterministic ingestion requirements.
- The **control-panel affordance** gives immediate confirmation that the active calibration is stored and applied, preventing surprise offsets when reconnecting sensors or reloading the session.

### Next checkpoints
- Extend calibration storage with named presets so multiple devices can share the same browser profile without manual re-zeroing.
- Thread calibration metadata into dataset manifests to keep PSP exports traceable to their ingestion baseline during Stage 6 regression runs.

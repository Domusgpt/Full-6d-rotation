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

## Session – Manifest Export & Archive Controls

### What changed
- **Manifest filename helper** (`createManifestDownloadName`) – normalises manifest IDs and stamps the latest update time to produce portable, deterministic archive names.
- **Control-panel download action** (`index.html`, `main.ts`) – adds a dedicated button that serialises the current manifest, disables itself when empty, and streams a JSON download for archival.
- **Test coverage** (`datasetManifest.test.ts`) – freezes system time to assert download filenames stay deterministic, preventing regressions in the archive contract.

### Why these pieces matter
- **Deterministic filenames** simplify reconciliation between local archives and persisted manifests, letting operators match downloads to on-device sessions at a glance.
- **Inline download control** removes the need for devtools hacks when exporting manifests, ensuring Stage 4 dataset work can be shared or backed up immediately after capture.
- **Tests** guarantee that future refactors keep filenames stable, protecting downstream automation that expects timestamped manifest artefacts.

### Next checkpoints
- Surface manifest last-updated timestamps directly in the control panel to signal when new frames are ready for export.
- Bundle PSP frame batches with the manifest download so a single action captures both metadata and imagery for offline review.

## Session – Parserator Calibration Controls

### What changed
- **Runtime mapping updates** (`parserator.ts`) – allow parserator instances to swap plane-mapping profiles and raise/lower their confidence floor without re-instantiation, keeping calibration live during sessions.
- **Preprocessor lifecycle** (`parserator.ts`) – return disposal handles when registering preprocessors so temporary filters (e.g., gravity isolation) can be removed cleanly.
- **Validation tests** (`parserator.test.ts`) – cover preprocessor ordering, profile switching, gravity isolation, and dynamic confidence floors to lock in the new behaviour.

### Why these pieces matter
- Live **profile switching** supports the rebuild plan’s Stage 3 parserator service, letting operators test alternate IMU mappings or external “extrument” adapters mid-run.
- **Confidence floor tuning** keeps the rotation bus reliable when sensor noise changes, ensuring downstream uniform queues maintain minimum certainty without restarting the pipeline.
- **Disposable preprocessors** simplify adaptive filtering—temporary smoothing or isolation filters can be toggled as telemetry warrants.
- The **test suite** guards the calibration APIs so future refactors keep parserator tooling deterministic and composable for rebuild checkpoints.

### Next checkpoints
- Surface active profile metadata in the control panel and expose quick toggles for common calibration profiles.
- Persist custom confidence floors and preprocessor stacks alongside dataset manifests so replay harnesses reproduce exact ingestion conditions.

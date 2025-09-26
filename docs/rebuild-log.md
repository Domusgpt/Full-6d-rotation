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

## Session – Dataset Worker Pipeline

### What changed
- **Frame encoding refactor** (`frameEncoding.ts`, `datasetTypes.ts`) – centralized dataset frame types and encoding so both the main thread and workers share the exact checksum/metadata contract.
- **Worker-backed export service** (`datasetExport.ts`, `datasetExportWorker.ts`) – spin up a dedicated Web Worker when available, queue encoding jobs with deterministic fallbacks, and track metrics even when the worker is unavailable.
- **Worker coverage** (`datasetExport.test.ts`) – added tests for both the JSON fallback and worker delegation paths to guarantee parity across environments.

### Why these pieces matter
- The **shared encoding module** keeps stage‑4 PSP exports consistent regardless of execution context, making audit logs and ML ingest dependable.
- The **worker pipeline** prevents heavy encodes from blocking the render loop while still failing safely to inline encoding when workers aren’t supported.
- The **dual-path tests** ensure the queue metrics and metadata stay accurate whether we’re running inside a headless test runner or a production browser.

### Next checkpoints
- Stream worker-encoded blobs through the PSP bridge with rolling latency stats so Stage 4 export budgets stay observable.
- Surface worker health indicators in the control panel to alert operators when the pipeline falls back to inline encoding.

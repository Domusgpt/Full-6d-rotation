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

## Session – Dataset Export Worker Harness

### What changed
- **Web Worker encoder** (`datasetExport.worker.ts`, `DatasetExportService`) – move frame encoding off the main thread with a dedicated worker that handles both OffscreenCanvas pipelines and JSON fallbacks, while preserving deterministic error handling.
- **Shared encoder module** (`datasetEncoder.ts`) – extracted reusable encode/checksum helpers so both the worker and inline fallback share identical logic.
- **Worker orchestration tests** (`datasetExport.test.ts`) – cover the worker dispatch path and ensure metrics stay accurate whether the worker is available or we fall back to inline encoding.

### Why these pieces matter
- The **worker harness** satisfies the Stage 4 requirement to push PSP export work off the render loop, protecting frame time even as queue depths grow.
- **Shared helpers** guarantee the worker and fallback paths produce byte-identical payloads, keeping regression tests deterministic across environments.
- **New tests** harden the contract before introducing the Web Worker harness to the rest of the pipeline, making sure telemetry and metrics remain trustworthy when the encoder migrates off-thread.

### Next checkpoints
- Integrate the worker-backed exporter with the upcoming dataset export Web Worker host to stream encoded frames directly to PSP consumers (Stage 4).
- Capture per-frame encode latency from the worker bridge to feed the Stage 6 performance dashboards.

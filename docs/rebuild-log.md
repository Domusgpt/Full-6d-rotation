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
- **Worker-based dataset encoder** (`DatasetExportService`, `datasetExportWorker.ts`) – offloads PNG/WebP encoding to a dedicated Web Worker while keeping a deterministic in-process fallback.
- **Shared frame encoding module** (`frameEncoding.ts`) – centralizes OffscreenCanvas/JSON encoding and checksum logic so both the worker and tests use the same pathway.
- **Worker simulation tests** (`datasetExport.test.ts`) – cover both fallback and worker dispatch paths to guarantee queue metrics and metadata stay correct.

### Why these pieces matter
- The **worker pipeline** satisfies Stage 4’s requirement to free the render loop from encoding cost, keeping PSP export throughput predictable under load.
- **Shared encoding utilities** prevent drift between worker and main-thread behavior, making diagnostics reproducible across environments.
- **Test coverage** ensures telemetry and metadata stay accurate whether the worker is available (browser) or not (headless harnesses).

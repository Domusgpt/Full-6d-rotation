# Testable Build Checklist

To generate a repeatable HypercubeCore build with full test coverage:

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Run the automated test suite**
   Executes Vitest unit tests for the rotation bus, telemetry pipeline, dataset export, and extrument adapters.
   ```bash
   npm test -- --run
   ```
3. **Static type analysis**
   Validates the TypeScript surface (including WebMIDI adapters and worker harnesses) for nullable DOM handles and interface mismatches.
   ```bash
   npm run typecheck
   ```
4. **Production bundle**
   Emits the optimized Vite build (including the dataset worker) into `dist/`.
   ```bash
   npm run build
   ```

Running the commands in this order ensures the rotor pipeline, dataset exporter, and extrument mapping are ready for manual QA or downstream automation.

## Manual QA Walkthrough
1. **Launch the dev server.** Run `npm run dev` and open the served URL to exercise the Vite-powered operator console.【F:package.json†L7-L15】
2. **Confirm geometry switching.** Use the geometry dropdown to swap between shapes and verify the status line updates with vertex/edge/face/cell counts for the active dataset.【F:index.html†L46-L118】【F:src/main.ts†L857-L883】
3. **Exercise rotation controls.** Drag the six plane sliders and watch the inline value labels update while the rotation bus pushes the combined snapshot to the renderer.【F:src/main.ts†L959-L1008】
4. **Adjust parserator calibration.** Change the profile selector or tweak the confidence floor and ensure the telemetry summary reflects the new settings in the sidebar list.【F:index.html†L118-L146】【F:src/main.ts†L264-L288】
5. **Test extrument connections.** Click “Connect extruments” to run MIDI discovery; verify the connection state, adapter labels, and payload summary update as snapshots broadcast.【F:src/main.ts†L172-L229】【F:src/main.ts†L800-L835】
6. **Validate dataset exports.** Let the session run until pending frames flush, then confirm latency metrics, manifest counters, and PSP stream updates advance automatically.【F:src/main.ts†L883-L939】
7. **Download a manifest.** Trigger the export button and inspect the JSON filename and contents to confirm deterministic naming plus persisted telemetry/ingestion metadata.【F:src/main.ts†L942-L956】
8. **Review telemetry history.** Scroll the telemetry list and manifest confidence trend to confirm parserator actions and high-confidence ratios are recorded for the session.【F:index.html†L86-L104】【F:index.html†L147-L197】【F:src/main.ts†L166-L234】

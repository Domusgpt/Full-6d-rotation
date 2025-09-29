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
   After this completes you can run the dedicated parity harness to stress the rotation math across randomized inputs.
   ```bash
   npm run test:parity
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

Once the checklist passes, continue with the subsystem walkthrough and hands-on validation steps in [`docs/system-status.md`](./system-status.md) to finish personal testing.

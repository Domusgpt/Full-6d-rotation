# Testable Build Checklist

To generate a repeatable HypercubeCore build with full test coverage:

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Run the unified verification script**
   Executes TypeScript checks, Vitest in run mode, and the production Vite build in a single chained command.
   ```bash
   npm run verify
   ```

Running `npm run verify` performs:

- `npm run typecheck` – validates the TypeScript surface (including WebMIDI adapters and worker harnesses) for nullable DOM handles and interface mismatches.
- `npm run test:run` – executes Vitest unit tests for the rotation bus, telemetry pipeline, dataset export, and extrument adapters.
- `npm run build` – emits the optimized Vite bundle (including the dataset worker) into `dist/`.

Complete the checklist before moving on to manual QA or downstream automation. The chained script mirrors the order previously listed individually, ensuring the rotor pipeline, dataset exporter, and extrument mapping are ready for further validation.

Once the checklist passes, continue with the subsystem walkthrough and hands-on validation steps in [`docs/system-status.md`](./system-status.md) to finish personal testing.

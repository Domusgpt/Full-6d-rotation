# Refine SO(4) Rotor Pipeline and Extrument Mapping

This document captures the intent and core outcomes of the "Refine SO(4) Rotor Pipeline and Extrument Mapping" work. The branch focused on hardening the six-plane rotation kernel while formalising the bridge between rotation snapshots and external instruments ("extruments").

## Goals

- Guarantee that every subsystem — sequential rotation math, matrix construction, dual-quaternion composition, and GPU uniform uploads — reads the same ordered set of six plane angles.
- Provide an explicit uniform-buffer contract so render programs bind and update the rotation state deterministically.
- Normalise external sensor input and expose reusable adapters so rotation snapshots can feed MIDI or other extruments without bespoke wiring for each deployment.
- Document how the refined pieces fit into the staged rebuild blueprint so future stages can reuse the hardened foundations.

## Rotor Pipeline Improvements

The core rotor pipeline work ensures deterministic parity across the math and rendering paths:

- `rotationMatrixFromAngles`, `applySequentialRotations`, and dual-quaternion helpers share the same `RotationAngles` ordering and produce matching snapshots, keeping CPU math and shader paths in sync.
- `RotationUniformBuffer` owns the std140-compliant buffer layout and exposes a single `update` call for pushing angles to the GPU, preventing divergent uniforms across programs.
- `rotationEnergy` offers a shared utility for energy-weighted telemetry and tests to assert immutability when refactoring the kernel.
- `composeDualQuaternion` and `applyDualQuaternionRotation` reuse scratch buffers and accept caller-provided outputs so streaming flows can avoid per-frame allocations while staying parity-tested against sequential rotations.

## Extrument Mapping

External integration is handled through the extrument hub utilities:

- `ExtrumentHub` wraps adapter registration, connection lifecycle, and guarded broadcasting so multiple outputs can subscribe to rotation updates without interfering with one another.
- `normalizeSnapshot` converts raw rotation snapshots into bounded magnitudes and plane values suitable for MIDI or other control signals, while `describeSnapshot` generates compact human-readable summaries for logs.
- The MIDI extrument adapter streams the normalised payload as control-change messages, making it straightforward to route the SO(4) telemetry into external synths or controllers.

## Staged Rebuild Alignment

The rebuild log documents how these refinements feed directly into the staged MVP plan:

- Stage 0/1 reuse the tightened rotation math and uniform buffer as the baseline kernel for the clean-room core.
- Stage 2 keeps geometry uploads GPU-resident, relying on the same uniform contract to animate polychora without CPU regeneration.
- Stage 3 extends the extrument mapper into the parserator service, reusing the calibrated sensor gains and deterministic snapshot flow introduced here.
- Later stages layer telemetry, dataset export, and HAOS orchestration on top of the stable rotation bus, ensuring all downstream systems trust the same snapshot contract.

These notes provide context for anyone resuming the staged rebuild or integrating new extruments against the refined rotor pipeline. For a continuation checklist and staged integration plan, see [`docs/refine-rotor-pipeline-continuation-playbook.md`](./refine-rotor-pipeline-continuation-playbook.md).

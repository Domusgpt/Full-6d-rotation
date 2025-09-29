# Extrument Quick-Start & Recipes

The refined rotor pipeline ships with an `ExtrumentHub` that broadcasts rotation snapshots to any
registered adapter (for example the MIDI extrument). This guide provides ready-to-run recipes so you can
validate the mapping layer with a virtual synth or hardware gear during manual QA.

## Prerequisites

- A browser that supports the [WebMIDI API](https://www.w3.org/TR/webmidi/) (Chrome, Edge, or recent
  Chromium builds).
- Access to the **Extruments** panel in the HypercubeCore control console (`npm run dev`).
- Optional but recommended: a MIDI monitor or DAW to visualize incoming Control Change messages.

## Recipe 1 – Loop back into a virtual synth

1. **Create a virtual MIDI port**
   - **macOS:** Open **Audio MIDI Setup → MIDI Studio → IAC Driver** and enable the device (create a new
     bus if necessary).
   - **Windows:** Install [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html), run it, and add
     a port named `Hypercube Extrument` (or similar).
   - **Linux:** Use `aconnect`/`aseq` or a desktop environment utility to create a virtual bridge (for
     ALSA users, `aconnect -o` can verify the port once created).
2. **Launch a synth or monitor**
   - Load a lightweight software synth (e.g., [Dexed](https://asb2m10.github.io/dexed/) or your DAW) and set
     its MIDI input to the virtual port created above.
   - Alternatively open a MIDI monitor (like [MIDI Monitor](https://www.snoize.com/MIDIMonitor/) on macOS) to
     observe events without routing audio.
3. **Start HypercubeCore (`npm run dev`) and open the Extruments panel**
   - Click **Request WebMIDI Access**; when prompted, allow the browser to use your MIDI devices.
   - Pick the virtual port from the connection dropdown and press **Connect**.
4. **Verify the mapping**
   - Rotate the polychoron using the console or parserator input and observe incoming CC messages (planes map
     to CC 1–6, magnitude to CC 7, confidence to CC 8 by default).
   - Use the panel’s summary readout to confirm normalized plane values and snapshot cadence.

## Recipe 2 – Connect to external hardware

1. Plug your hardware synth/controller into the machine running HypercubeCore (USB MIDI or a DIN interface).
2. Ensure the device exposes an **input** port to the OS (some devices require switching from `storage` to
   `MIDI` mode).
3. In HypercubeCore’s Extruments panel, choose the hardware port directly and connect.
4. Adjust gain/clamp values in `ExtrumentHub` options if the hardware expects a narrower CC range. For
   example:
   ```ts
   const hub = new ExtrumentHub({
     clamp: { min: 0.1, max: 0.9 },
     transform: (snapshot) => normalizeSnapshot(snapshot, { clamp: true })
   });
   ```
5. If the hardware reacts on specific CC numbers, update `midiExtrument.ts` to remap plane indices to the
   device’s preferred controls before running automated builds.

## Debugging & Telemetry Tips

- The Extruments panel logs connection lifecycle events in the browser console; keep DevTools open to inspect
  disconnects or permission denials.
- `describeSnapshot()` outputs concise summaries (σ, plane samples). Enable **Verbose Telemetry** in the
  control panel to mirror these summaries in the telemetry loom for later inspection.
- Use `docs/testable-build.md` → `npm run test:parity` followed by `npm test -- --run` to confirm the core
  rotation math is healthy before diagnosing extrument issues.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Browser cannot find the MIDI port | Ensure the port is created *before* requesting WebMIDI access and reload the page so the permission prompt restarts. |
| Synth receives notes instead of CC data | Verify the synth is listening for Control Change messages on channel 1, or change the channel in `midiExtrument.ts`. |
| Values appear stuck at 0.5 | Disable the clamp in `normalizeSnapshot` (Extrument panel → **Clamp Payload** toggle) or check that rotation input is actually changing. |
| Spikes when connecting/disconnecting | The hub sends a neutral snapshot on disconnect; some synths treat that as a change. Reduce gain or add smoothing in the device patch. |

These recipes keep the refined extrument mapping aligned with the staged MVP plan—operators can reliably test
virtual or physical integrations before advancing to later rebuild stages.

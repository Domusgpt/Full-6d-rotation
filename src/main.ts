import { HypercubeCore } from './core/hypercubeCore';
import { ZERO_ROTATION, type RotationAngles, type RotationSnapshot } from './core/rotationUniforms';
import { createHarmonicOrbit, SIX_PLANE_KEYS } from './core/sixPlaneOrbit';
import { type GeometryId } from './pipeline/geometryCatalog';
import { RotationBus } from './pipeline/rotationBus';
import { GeometryController } from './pipeline/geometryController';
import { DatasetExportService } from './pipeline/datasetExport';
import { LocalPspStream } from './pipeline/pspStream';
import { FocusDirector } from './pipeline/focusDirector';
import { LatencyTracker } from './pipeline/latencyTracker';

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const geometrySelect = document.getElementById('geometry') as HTMLSelectElement;
const projectionDepthSlider = document.getElementById('projectionDepth') as HTMLInputElement;
const lineWidthSlider = document.getElementById('lineWidth') as HTMLInputElement;
const rotationControlsContainer = document.getElementById('rotation-controls') as HTMLDivElement;
const uniformUploadsEl = document.getElementById('uniform-uploads') as HTMLSpanElement;
const uniformSkipsEl = document.getElementById('uniform-skips') as HTMLSpanElement;
const datasetPendingEl = document.getElementById('dataset-pending') as HTMLSpanElement;
const datasetTotalEl = document.getElementById('dataset-total') as HTMLSpanElement;
const uniformLatencyEl = document.getElementById('uniform-latency') as HTMLSpanElement;
const captureLatencyEl = document.getElementById('capture-latency') as HTMLSpanElement;
const encodeLatencyEl = document.getElementById('encode-latency') as HTMLSpanElement;
const datasetFormatEl = document.getElementById('dataset-format') as HTMLSpanElement;

if (
  !canvas ||
  !statusEl ||
  !geometrySelect ||
  !projectionDepthSlider ||
  !lineWidthSlider ||
  !rotationControlsContainer ||
  !uniformUploadsEl ||
  !uniformSkipsEl ||
  !datasetPendingEl ||
  !datasetTotalEl ||
  !uniformLatencyEl ||
  !captureLatencyEl ||
  !encodeLatencyEl ||
  !datasetFormatEl
) {
  throw new Error('Required DOM nodes are missing');
}

const core = new HypercubeCore(canvas, {
  projectionDepth: Number(projectionDepthSlider.value),
  lineWidth: Number(lineWidthSlider.value)
});

const geometryController = new GeometryController(core);
const rotationBus = new RotationBus();
rotationBus.subscribe(snapshot => core.updateRotation(snapshot));
const latencyTracker = new LatencyTracker();
const datasetExport = new DatasetExportService({
  onLatencySample: latency => latencyTracker.recordEncode(latency)
});
const pspStream = new LocalPspStream();
const focusDirector = new FocusDirector(geometryController, rotationBus, { fallbackGeometry: 'tesseract' });
const MAX_PENDING_FRAMES = 48;

const rotationState: RotationSnapshot = {
  ...ZERO_ROTATION,
  timestamp: performance.now(),
  confidence: 1
};

const manualOffsets: RotationAngles = { ...ZERO_ROTATION };
const autoAngles: RotationAngles = { ...ZERO_ROTATION };

let updateRotationLabels: (combined: RotationAngles, manual: RotationAngles) => void;

function pushRotationSnapshot(timestamp: number) {
  rotationState.timestamp = timestamp;

  let energy = 0;
  for (const plane of SIX_PLANE_KEYS) {
    rotationState[plane] = autoAngles[plane] + manualOffsets[plane];
    energy += Math.abs(rotationState[plane]);
  }

  const normalized = Math.min(1, energy / (Math.PI * SIX_PLANE_KEYS.length));
  rotationState.confidence = 0.75 + 0.25 * (1 - normalized);

  rotationBus.push({ ...rotationState });
  updateRotationLabels(rotationState, manualOffsets);
  updateTelemetry();
}

function formatLatency(avg: number, max: number) {
  if (avg <= 0 && max <= 0) {
    return '0 ms';
  }
  return `${avg.toFixed(1)} ms (max ${max.toFixed(1)})`;
}

function updateTelemetry() {
  const uniformMetrics = core.getUniformMetrics();
  uniformUploadsEl.textContent = `${uniformMetrics.uploads}/${uniformMetrics.enqueued}`;
  uniformSkipsEl.textContent = uniformMetrics.skipped.toString();
  latencyTracker.recordUniform(uniformMetrics);

  const pipelineLatency = latencyTracker.getMetrics();
  uniformLatencyEl.textContent = formatLatency(pipelineLatency.uniformAvgMs, pipelineLatency.uniformMaxMs);
  captureLatencyEl.textContent = formatLatency(pipelineLatency.captureAvgMs, pipelineLatency.captureMaxMs);
  encodeLatencyEl.textContent = formatLatency(pipelineLatency.encodeAvgMs, pipelineLatency.encodeMaxMs);

  const datasetMetrics = datasetExport.getMetrics();
  datasetPendingEl.textContent = datasetMetrics.pending.toString();
  datasetTotalEl.textContent = datasetMetrics.totalEncoded.toString();
  datasetFormatEl.textContent = datasetMetrics.lastFormat ?? '–';
}

updateRotationLabels = createRotationControls(rotationControlsContainer, manualOffsets, () => {
  pushRotationSnapshot(performance.now());
});

pushRotationSnapshot(performance.now());

function populateGeometryOptions() {
  const geometries = geometryController.getAvailableGeometries();
  geometrySelect.innerHTML = '';
  for (const descriptor of geometries) {
    const option = document.createElement('option');
    option.value = descriptor.id;
    option.textContent = descriptor.name;
    geometrySelect.appendChild(option);
  }
}

function setGeometry(id: GeometryId) {
  geometryController.setActiveGeometry(id);
  const descriptor = geometryController.getDescriptor(id);
  if (!descriptor) return;
  const { topology } = descriptor.data;
  statusEl.textContent = `Geometry: ${descriptor.name} · V ${topology.vertices} · E ${topology.edges} · F ${topology.faces} · C ${topology.cells}`;
}

geometrySelect.addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value as GeometryId;
  setGeometry(value);
});

projectionDepthSlider.addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  core.setProjectionDepth(value);
});

lineWidthSlider.addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  core.setLineWidth(value);
});

populateGeometryOptions();
geometrySelect.value = 'tesseract';
setGeometry('tesseract');
core.setUniformUploadListener((snapshot, metrics) => {
  latencyTracker.recordUniform(metrics);
  const datasetMetrics = datasetExport.getMetrics();
  if (datasetMetrics.pending >= MAX_PENDING_FRAMES) {
    return;
  }

  const frame = core.captureFrame();
  if (frame.width === 0 || frame.height === 0) {
    return;
  }

  const captureTime = performance.now();
  const captureLatency = Math.max(0, captureTime - snapshot.timestamp);
  latencyTracker.recordCapture(snapshot.timestamp, captureTime);

  let uniformLatency = metrics.lastUploadLatency;
  if (metrics.lastSnapshotTimestamp !== snapshot.timestamp) {
    uniformLatency = Math.max(0, metrics.lastUploadTime - snapshot.timestamp);
  }

  datasetExport.enqueue({
    width: frame.width,
    height: frame.height,
    pixels: frame.pixels,
    metadata: {
      timestamp: snapshot.timestamp,
      rotationAngles: [snapshot.xy, snapshot.xz, snapshot.yz, snapshot.xw, snapshot.yw, snapshot.zw],
      latency: {
        uniformMs: uniformLatency,
        uniformTimestamp: metrics.lastUploadTime,
        captureMs: captureLatency,
        captureTimestamp: captureTime
      }
    }
  });
  updateTelemetry();
});

startSyntheticRotation(autoAngles, timestamp => pushRotationSnapshot(timestamp));
core.start();

setInterval(() => focusDirector.update(performance.now()), 1000);

setInterval(async () => {
  const frames = await datasetExport.flush();
  if (frames.length) {
    frames.forEach(frame => pspStream.publish(frame));
    updateTelemetry();
  }
}, 2000);

function createRotationControls(
  container: HTMLDivElement,
  manualState: RotationAngles,
  onChange: () => void
): (combined: RotationAngles, manual: RotationAngles) => void {
  const valueLabels = new Map<keyof RotationAngles, HTMLSpanElement>();

  for (const key of SIX_PLANE_KEYS) {
    const group = document.createElement('section');
    group.className = 'control-group';

    const title = document.createElement('label');
    title.textContent = `${key.toUpperCase()} Plane`;
    title.htmlFor = `rotation-${key}`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '-3.14159';
    slider.max = '3.14159';
    slider.step = '0.01';
    slider.value = manualState[key].toString();
    slider.id = `rotation-${key}`;

    const valueLabel = document.createElement('span');
    valueLabel.style.fontSize = '0.8rem';
    valueLabel.style.color = 'rgba(211,246,255,0.8)';
    valueLabel.textContent = '0.00 rad';

    slider.addEventListener('input', () => {
      manualState[key] = Number(slider.value);
      onChange();
    });

    group.appendChild(title);
    group.appendChild(slider);
    group.appendChild(valueLabel);
    container.appendChild(group);

    valueLabels.set(key, valueLabel);
  }

  return (combined: RotationAngles, manual: RotationAngles) => {
    for (const key of SIX_PLANE_KEYS) {
      const label = valueLabels.get(key);
      if (!label) continue;
      const total = combined[key];
      const offset = manual[key];
      label.textContent = `${total.toFixed(2)} rad (offset ${offset.toFixed(2)})`;
    }
  };
}

function startSyntheticRotation(autoState: RotationAngles, onUpdate: (timestamp: number) => void) {
  const orbit = createHarmonicOrbit();
  const startedAt = performance.now();

  const tick = () => {
    const now = performance.now();
    const elapsed = (now - startedAt) / 1000;
    const orbitAngles = orbit(elapsed);

    for (const plane of SIX_PLANE_KEYS) {
      autoState[plane] = orbitAngles[plane];
    }

    onUpdate(now);
  requestAnimationFrame(tick);
};

  requestAnimationFrame(tick);
}

updateTelemetry();
setInterval(updateTelemetry, 1000);

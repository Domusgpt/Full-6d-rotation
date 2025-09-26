import { HypercubeCore } from './core/hypercubeCore';
import { ZERO_ROTATION, type RotationAngles, type RotationSnapshot } from './core/rotationUniforms';
import { createHarmonicOrbit, SIX_PLANE_KEYS } from './core/sixPlaneOrbit';
import { getGeometry, type GeometryId } from './pipeline/geometryCatalog';
import { RotationBus } from './pipeline/rotationBus';
import { deriveRotationDynamics } from './core/rotationDynamics';
import type { RotationDynamics } from './core/styleUniforms';
import { ExtrumentSynth } from './audio/extrumentSynth';
import { ImuStream, type ImuStreamStatus } from './ingestion/imuStream';

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const geometrySelect = document.getElementById('geometry') as HTMLSelectElement;
const projectionDepthSlider = document.getElementById('projectionDepth') as HTMLInputElement;
const lineWidthSlider = document.getElementById('lineWidth') as HTMLInputElement;
const rotationControlsContainer = document.getElementById('rotation-controls') as HTMLDivElement;
const styleIndicatorsContainer = document.getElementById('style-indicators') as HTMLDivElement;
const imuToggle = document.getElementById('imu-toggle') as HTMLButtonElement;
const imuStatus = document.getElementById('imu-status') as HTMLParagraphElement;
const audioToggle = document.getElementById('audio-toggle') as HTMLButtonElement;
const audioStatus = document.getElementById('audio-status') as HTMLParagraphElement;

if (
  !canvas ||
  !statusEl ||
  !geometrySelect ||
  !projectionDepthSlider ||
  !lineWidthSlider ||
  !rotationControlsContainer ||
  !styleIndicatorsContainer ||
  !imuToggle ||
  !imuStatus ||
  !audioToggle ||
  !audioStatus
) {
  throw new Error('Required DOM nodes are missing');
}

const core = new HypercubeCore(canvas, {
  projectionDepth: Number(projectionDepthSlider.value),
  lineWidth: Number(lineWidthSlider.value)
});

const rotationBus = new RotationBus();
const synth = new ExtrumentSynth();
const updateIndicators = createStyleIndicators(styleIndicatorsContainer);

const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const imuUrl = (import.meta.env.VITE_IMU_URL as string | undefined) ?? `${socketProtocol}//${window.location.host}/imu`;

const imuStream = new ImuStream({
  url: imuUrl,
  smoothing: 0.35,
  onSnapshot: handleImuSnapshot,
  onStatus: handleImuStatus
});

rotationBus.subscribe(({ snapshot, dynamics }) => {
  core.updateRotation(snapshot);
  core.updateDynamics(dynamics);
  synth.update(snapshot, dynamics);
});

const rotationState: RotationSnapshot = {
  ...ZERO_ROTATION,
  timestamp: performance.now(),
  confidence: 1
};

let statusBase = 'Geometry: —';

const manualOffsets: RotationAngles = { ...ZERO_ROTATION };
const autoAngles: RotationAngles = { ...ZERO_ROTATION };
const imuAngles: RotationAngles = { ...ZERO_ROTATION };

let imuConfidence = 1;
let imuActive = false;
let stopAutoOrbit: (() => void) | null = null;

let updateRotationLabels: (combined: RotationAngles, manual: RotationAngles) => void;

function resetAngles(target: RotationAngles) {
  for (const plane of SIX_PLANE_KEYS) {
    target[plane] = 0;
  }
}

function pauseAutoOrbit() {
  if (!stopAutoOrbit) return;
  stopAutoOrbit();
  stopAutoOrbit = null;
  resetAngles(autoAngles);
}

function resumeAutoOrbit() {
  if (stopAutoOrbit) return;
  stopAutoOrbit = startSyntheticRotation(autoAngles, pushRotationSnapshot);
}

function pushRotationSnapshot(timestamp: number) {
  rotationState.timestamp = timestamp;

  let energy = 0;
  for (const plane of SIX_PLANE_KEYS) {
    rotationState[plane] = autoAngles[plane] + manualOffsets[plane] + imuAngles[plane];
    energy += Math.abs(rotationState[plane]);
  }

  const normalized = Math.min(1, energy / (Math.PI * SIX_PLANE_KEYS.length));
  let confidence = 0.75 + 0.25 * (1 - normalized);
  if (imuActive) {
    confidence = Math.min(1, Math.max(0, (confidence + imuConfidence) * 0.5));
  }
  rotationState.confidence = confidence;

  const dynamics = deriveRotationDynamics(rotationState);
  rotationBus.push({ ...rotationState }, dynamics);
  updateRotationLabels(rotationState, manualOffsets);
  updateIndicators(dynamics);
  updateStatus(dynamics);
}

function handleImuSnapshot(snapshot: RotationSnapshot) {
  imuActive = true;
  imuConfidence = snapshot.confidence;
  for (const plane of SIX_PLANE_KEYS) {
    imuAngles[plane] = snapshot[plane];
  }
  pushRotationSnapshot(snapshot.timestamp);
}

function handleImuStatus(status: ImuStreamStatus) {
  switch (status.state) {
    case 'connecting': {
      imuToggle.disabled = true;
      imuToggle.textContent = 'Connecting…';
      imuStatus.textContent = 'Opening IMU stream…';
      break;
    }
    case 'open': {
      imuToggle.disabled = false;
      imuToggle.textContent = 'Disconnect IMU Stream';
      imuToggle.classList.add('active');
      imuStatus.textContent = 'IMU stream active. Rotations now follow embodied motion.';
      imuActive = true;
      pauseAutoOrbit();
      imuConfidence = 1;
      resetAngles(imuAngles);
      pushRotationSnapshot(performance.now());
      break;
    }
    case 'closed': {
      imuToggle.disabled = false;
      imuToggle.textContent = 'Connect IMU Stream';
      imuToggle.classList.remove('active');
      imuStatus.textContent = 'IMU link idle. Connect a sensor to drive hyperspatial flow.';
      imuActive = false;
      imuConfidence = 1;
      resetAngles(imuAngles);
      pushRotationSnapshot(performance.now());
      resumeAutoOrbit();
      break;
    }
    case 'error': {
      imuToggle.disabled = false;
      imuToggle.textContent = 'Reconnect IMU Stream';
      imuToggle.classList.remove('active');
      imuStatus.textContent = status.detail ? `IMU stream error: ${status.detail}` : 'IMU stream error occurred.';
      imuActive = false;
      imuConfidence = 0.5;
      resetAngles(imuAngles);
      pushRotationSnapshot(performance.now());
      resumeAutoOrbit();
      break;
    }
    default: {
      imuToggle.disabled = false;
      imuToggle.classList.remove('active');
      imuStatus.textContent = 'IMU link idle. Connect a sensor to drive hyperspatial flow.';
    }
  }
}

updateRotationLabels = createRotationControls(rotationControlsContainer, manualOffsets, () => {
  pushRotationSnapshot(performance.now());
});

pushRotationSnapshot(performance.now());

function setGeometry(id: GeometryId) {
  const geometry = getGeometry(id);
  core.setGeometry(geometry);
  const vertexCount = (geometry.positions.length / 4).toFixed(0);
  const edgeCount = (geometry.indices.length / 2).toFixed(0);
  statusBase = `Geometry: ${id} · vertices ${vertexCount} · edges ${edgeCount}`;
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

imuToggle.addEventListener('click', () => {
  if (imuStream.isActive) {
    imuStream.disconnect();
  } else {
    imuStream.connect();
  }
});

setGeometry('tesseract');
resumeAutoOrbit();
core.start();

audioToggle.addEventListener('click', async () => {
  if (!synth.isActive) {
    try {
      await synth.enable();
      audioToggle.textContent = 'Disable Sonic Weave';
      audioToggle.classList.add('active');
      audioStatus.textContent = 'Sonic weave engaged – rotations now sculpt sound.';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      audioStatus.textContent = `Audio unavailable: ${message}`;
    }
  } else {
    await synth.disable();
    audioToggle.textContent = 'Enable Sonic Weave';
    audioToggle.classList.remove('active');
    audioStatus.textContent = 'Audio engine idle. Click to resume the sonic loom.';
  }
});

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

function startSyntheticRotation(
  autoState: RotationAngles,
  onUpdate: (timestamp: number) => void
): () => void {
  const orbit = createHarmonicOrbit();
  const startedAt = performance.now();
  let active = true;
  let frameHandle = 0;

  const tick = () => {
    if (!active) return;
    const now = performance.now();
    const elapsed = (now - startedAt) / 1000;
    const orbitAngles = orbit(elapsed);

    for (const plane of SIX_PLANE_KEYS) {
      autoState[plane] = orbitAngles[plane];
    }

    onUpdate(now);
    frameHandle = requestAnimationFrame(tick);
  };

  frameHandle = requestAnimationFrame(tick);

  return () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frameHandle);
    resetAngles(autoState);
  };
}

function updateStatus(dynamics: RotationDynamics) {
  statusEl.textContent = `${statusBase} · energy ${(dynamics.energy * 100).toFixed(0)}% · chaos ${(dynamics.chaos * 100).toFixed(0)}%`;
}

function createStyleIndicators(container: HTMLDivElement) {
  const metrics: Array<{ key: keyof RotationDynamics; label: string }> = [
    { key: 'energy', label: 'Energy Flux' },
    { key: 'spatial', label: 'Spatial Flow' },
    { key: 'hyperspatial', label: 'Hyperspatial Flow' },
    { key: 'harmonic', label: 'Harmonic Phase' },
    { key: 'chaos', label: 'Chaos Weave' }
  ];

  const elements = new Map<keyof RotationDynamics, { fill: HTMLSpanElement; value: HTMLSpanElement }>();
  container.replaceChildren();

  for (const metric of metrics) {
    const row = document.createElement('div');
    row.className = 'meter-row';

    const label = document.createElement('span');
    label.textContent = metric.label;
    label.className = 'meter-label';

    const meter = document.createElement('div');
    meter.className = 'meter-bar';

    const fill = document.createElement('span');
    fill.className = 'meter-fill';
    meter.appendChild(fill);

    const value = document.createElement('span');
    value.className = 'meter-value';
    value.textContent = '0%';

    row.appendChild(label);
    row.appendChild(meter);
    row.appendChild(value);
    container.appendChild(row);

    elements.set(metric.key, { fill, value });
  }

  return (dynamics: RotationDynamics) => {
    for (const metric of metrics) {
      const pair = elements.get(metric.key);
      if (!pair) continue;
      const value = Math.max(0, Math.min(1, dynamics[metric.key] as number));
      pair.fill.style.width = `${(value * 100).toFixed(1)}%`;
      pair.value.textContent = `${Math.round(value * 100)}%`;
    }
  };
}

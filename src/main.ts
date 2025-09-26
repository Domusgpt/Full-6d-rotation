import { HypercubeCore, type RotationSolver } from './core/hypercubeCore';
import { ZERO_ROTATION, ZERO_SNAPSHOT, type RotationAngles, type RotationSnapshot } from './core/rotationUniforms';
import { createHarmonicOrbit } from './core/sixPlaneOrbit';
import {
  SIX_PLANE_KEYS,
  createPlaneWeights,
  type RotationPlane,
  type RotationPlaneWeights
} from './core/rotationPlanes';
import { getGeometry, type GeometryId } from './pipeline/geometryCatalog';
import { RotationBus } from './pipeline/rotationBus';
import { deriveRotationDynamics } from './core/rotationDynamics';
import type { RotationDynamics } from './core/styleUniforms';
import { ExtrumentSynth } from './audio/extrumentSynth';
import { ImuStream } from './pipeline/imuStream';
import type { ProjectionMode } from './core/projectionBridge';
import { KerbelizedParserator } from './ingestion/kerbelizedParserator';
import { createConfidenceFloorFilter } from './ingestion/parserFilters';
import { So4ImuIntegrator } from './ingestion/so4Integrator';

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const geometrySelect = document.getElementById('geometry') as HTMLSelectElement;
const projectionModeSelect = document.getElementById('projectionMode') as HTMLSelectElement;
const rotationSolverSelect = document.getElementById('rotationSolver') as HTMLSelectElement;
const projectionDepthSlider = document.getElementById('projectionDepth') as HTMLInputElement;
const projectionDepthLabel = document.getElementById('projectionDepthLabel') as HTMLLabelElement;
const lineWidthSlider = document.getElementById('lineWidth') as HTMLInputElement;
const rotationControlsContainer = document.getElementById('rotation-controls') as HTMLDivElement;
const styleIndicatorsContainer = document.getElementById('style-indicators') as HTMLDivElement;
const planeIndicatorsContainer = document.getElementById('plane-indicators') as HTMLDivElement;
const planeMaskControlsContainer = document.getElementById('plane-mask-controls') as HTMLDivElement;
const audioToggle = document.getElementById('audio-toggle') as HTMLButtonElement;
const audioStatus = document.getElementById('audio-status') as HTMLParagraphElement;
const imuToggle = document.getElementById('imu-toggle') as HTMLButtonElement;
const imuStatus = document.getElementById('imu-status') as HTMLParagraphElement;

if (
  !canvas ||
  !statusEl ||
  !geometrySelect ||
  !projectionModeSelect ||
  !projectionDepthSlider ||
  !rotationSolverSelect ||
  !projectionDepthLabel ||
  !lineWidthSlider ||
  !rotationControlsContainer ||
  !styleIndicatorsContainer ||
  !planeIndicatorsContainer ||
  !planeMaskControlsContainer ||
  !audioToggle ||
  !audioStatus ||
  !imuToggle ||
  !imuStatus
) {
  throw new Error('Required DOM nodes are missing');
}

let projectionMode = (projectionModeSelect.value as ProjectionMode) ?? 'perspective';
const projectionControlValues: Record<ProjectionMode, number> = {
  perspective: Number(projectionDepthSlider.value),
  stereographic: 1.0,
  orthographic: 0.8
};

const initialSolver = (rotationSolverSelect.value as RotationSolver) ?? 'sequential';

const core = new HypercubeCore(canvas, {
  projectionDepth: projectionControlValues.perspective,
  lineWidth: Number(lineWidthSlider.value),
  projectionMode,
  rotationSolver: initialSolver
});
initializeProjectionControls();
core.setProjectionControl(projectionControlValues[projectionMode]);
if (projectionMode === 'perspective') {
  core.setProjectionDepth(projectionControlValues.perspective);
}

const rotationBus = new RotationBus();
const synth = new ExtrumentSynth();
const updateIndicators = createStyleIndicators(styleIndicatorsContainer);
const planeIndicators = createPlaneIndicators(planeIndicatorsContainer);
planeIndicators.updateSnapshot(ZERO_SNAPSHOT);
const planeMaskControls = createPlaneMaskControls(planeMaskControlsContainer, planeWeights, (weights) => {
  planeWeights = weights;
  core.setPlaneWeights(weights);
  planeIndicators.updateWeights(weights);
  pushRotationSnapshot(performance.now());
});
planeIndicators.updateWeights(planeWeights);
planeMaskControls.setWeights(planeWeights);

rotationBus.subscribe(({ snapshot, dynamics }) => {
  core.updateRotation(snapshot);
  core.updateDynamics(dynamics);
  synth.update(snapshot, dynamics);
});

let statusBase = 'Geometry: —';
let rotationSource = 'Harmonic Orbit';
let latestDynamics: RotationDynamics | null = null;
let planeWeights: RotationPlaneWeights = createPlaneWeights();

const parser = new KerbelizedParserator({
  channelCount: 128,
  smoothingAlpha: 0.22,
  minimumConfidence: 0.25,
  filters: [createConfidenceFloorFilter({ minimum: 0.25 })]
});

parser.subscribe((frame) => {
  const { rotation } = frame;
  latestDynamics = deriveRotationDynamics(rotation);
  rotationBus.push({ ...rotation }, latestDynamics);
  updateRotationLabels(rotation, manualOffsets);
  updateIndicators(latestDynamics);
  planeIndicators.updateSnapshot(rotation);
  updateStatus(latestDynamics);
});

const manualOffsets: RotationAngles = { ...ZERO_ROTATION };
const autoAngles: RotationAngles = { ...ZERO_ROTATION };
let stopSynthetic: (() => void) | null = null;
let imuStream: ImuStream | null = null;
let externalConfidence: number | null = null;
let externalTimestamp: number | null = null;
let imuIntegrator: So4ImuIntegrator | null = null;

let updateRotationLabels: (combined: RotationAngles, manual: RotationAngles) => void;

function pushRotationSnapshot(frameTimestamp: number) {
  let energy = 0;
  const combined: RotationSnapshot = {
    ...ZERO_ROTATION,
    timestamp: externalTimestamp ?? frameTimestamp,
    confidence: 1
  };

  for (const plane of SIX_PLANE_KEYS) {
    const masked = (autoAngles[plane] + manualOffsets[plane]) * planeWeights[plane];
    combined[plane] = masked;
    energy += Math.abs(masked);
  }

  const normalized = Math.min(1, energy / (Math.PI * SIX_PLANE_KEYS.length));
  const fallbackConfidence = 0.75 + 0.25 * (1 - normalized);
  combined.confidence = externalConfidence ?? fallbackConfidence;

  parser.ingestRotation(combined);
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
  if (latestDynamics) {
    updateStatus(latestDynamics);
  }
}

geometrySelect.addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value as GeometryId;
  setGeometry(value);
});

projectionDepthSlider.addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  projectionControlValues[projectionMode] = value;
  if (projectionMode === 'perspective') {
    core.setProjectionDepth(value);
  }
  core.setProjectionControl(value);
});

projectionModeSelect.addEventListener('change', (event) => {
  projectionMode = (event.target as HTMLSelectElement).value as ProjectionMode;
  core.setProjectionMode(projectionMode);
  updateProjectionControlUi(projectionMode);
  const controlValue = projectionControlValues[projectionMode];
  projectionDepthSlider.value = controlValue.toString();
  if (projectionMode === 'perspective') {
    core.setProjectionDepth(controlValue);
  }
  core.setProjectionControl(controlValue);
});

rotationSolverSelect.addEventListener('change', (event) => {
  const solver = (event.target as HTMLSelectElement).value as RotationSolver;
  core.setRotationSolver(solver);
});

lineWidthSlider.addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  core.setLineWidth(value);
});

setGeometry('tesseract');
stopSynthetic = startSyntheticRotation(autoAngles, (timestamp) => pushRotationSnapshot(timestamp));
core.setPlaneWeights(planeWeights);
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

imuToggle.addEventListener('click', () => {
  if (!imuStream) {
    const defaultUrl = localStorage.getItem('imuStreamUrl') ?? 'ws://localhost:7000/imu';
    const url = prompt('Enter IMU WebSocket URL', defaultUrl);
    if (!url) {
      imuStatus.textContent = 'IMU stream connection cancelled.';
      return;
    }
    localStorage.setItem('imuStreamUrl', url);
    if (stopSynthetic) {
      stopSynthetic();
      stopSynthetic = null;
    }
    rotationSource = 'IMU Stream';
    imuToggle.textContent = 'Disconnect IMU Stream';
    imuToggle.classList.add('active');
    imuStatus.textContent = 'Connecting to IMU…';
    externalConfidence = null;
    externalTimestamp = null;
    imuStream = new ImuStream({
      url,
      onStatus: (status) => {
        imuStatus.textContent = status;
        if (latestDynamics) {
          updateStatus(latestDynamics);
        }
      },
      onPacket: (packet, dt) => {
        if (!imuIntegrator) {
          imuIntegrator = new So4ImuIntegrator(parser.getGainProfile());
        }
        const snapshot = imuIntegrator.step(packet, dt);
        for (const plane of SIX_PLANE_KEYS) {
          autoAngles[plane] = snapshot[plane];
        }
        externalConfidence = snapshot.confidence ?? 1;
        externalTimestamp = snapshot.timestamp;
        pushRotationSnapshot(performance.now());
      }
    });
    imuStream.start();
    if (latestDynamics) {
      updateStatus(latestDynamics);
    }
  } else {
    imuStream.stop();
    imuStream = null;
    rotationSource = 'Harmonic Orbit';
    imuToggle.textContent = 'Connect IMU Stream';
    imuToggle.classList.remove('active');
    imuStatus.textContent = 'IMU stream idle. Click to connect.';
    externalConfidence = null;
    externalTimestamp = null;
    imuIntegrator = null;
    if (!stopSynthetic) {
      stopSynthetic = startSyntheticRotation(autoAngles, (timestamp) => pushRotationSnapshot(timestamp));
    }
    if (latestDynamics) {
      updateStatus(latestDynamics);
    }
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

function startSyntheticRotation(autoState: RotationAngles, onUpdate: (timestamp: number) => void) {
  const orbit = createHarmonicOrbit();
  const startedAt = performance.now();
  let running = true;
  let frameHandle = 0;

  const tick = () => {
    if (!running) return;
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
    running = false;
    cancelAnimationFrame(frameHandle);
  };
}

function updateStatus(dynamics: RotationDynamics) {
  statusEl.textContent = `${statusBase} · source ${rotationSource} · energy ${(dynamics.energy * 100).toFixed(0)}% · chaos ${(dynamics.chaos * 100).toFixed(0)}%`;
}

function initializeProjectionControls() {
  updateProjectionControlUi(projectionMode);
  projectionDepthSlider.value = projectionControlValues[projectionMode].toString();
}

function updateProjectionControlUi(mode: ProjectionMode) {
  switch (mode) {
    case 'perspective':
      projectionDepthLabel.textContent = 'Projection Depth';
      projectionDepthSlider.min = '1';
      projectionDepthSlider.max = '8';
      projectionDepthSlider.step = '0.1';
      break;
    case 'stereographic':
      projectionDepthLabel.textContent = 'Stereographic Scale';
      projectionDepthSlider.min = '0.2';
      projectionDepthSlider.max = '4';
      projectionDepthSlider.step = '0.05';
      break;
    case 'orthographic':
      projectionDepthLabel.textContent = 'Orthographic Scale';
      projectionDepthSlider.min = '0.2';
      projectionDepthSlider.max = '3';
      projectionDepthSlider.step = '0.05';
      break;
  }
}

const PLANE_COLORS: Record<RotationPlane, string> = {
  xy: '#6ce7ff',
  xz: '#7fffd4',
  yz: '#ffc57a',
  xw: '#dba2ff',
  yw: '#ff86b5',
  zw: '#88f3ff'
};

function createPlaneIndicators(container: HTMLDivElement) {
  container.replaceChildren();

  const indicators = new Map<RotationPlane, {
    card: HTMLDivElement;
    fill: HTMLSpanElement;
    value: HTMLSpanElement;
    direction: HTMLSpanElement;
  }>();
  let weights = createPlaneWeights();

  for (const plane of SIX_PLANE_KEYS) {
    const card = document.createElement('div');
    card.className = 'plane-card';
    card.dataset.direction = 'pos';
    card.dataset.active = 'on';

    const header = document.createElement('div');
    header.className = 'plane-header';
    header.textContent = `${plane.toUpperCase()} Plane`;

    const direction = document.createElement('span');
    direction.className = 'plane-direction';
    direction.textContent = '⟳';
    header.appendChild(direction);

    const value = document.createElement('span');
    value.className = 'plane-value';
    value.textContent = '+0.00π';

    const bar = document.createElement('div');
    bar.className = 'plane-bar';
    const fill = document.createElement('span');
    fill.className = 'plane-fill';
    fill.style.background = PLANE_COLORS[plane];
    bar.appendChild(fill);

    card.appendChild(header);
    card.appendChild(value);
    card.appendChild(bar);
    container.appendChild(card);

    indicators.set(plane, { card, fill, value, direction });
  }

  const updateWeights = (next: RotationPlaneWeights) => {
    weights = { ...next };
    for (const plane of SIX_PLANE_KEYS) {
      const indicator = indicators.get(plane);
      if (!indicator) continue;
      indicator.card.dataset.active = planeState(weights[plane]);
    }
  };

  const updateSnapshot = (snapshot: RotationSnapshot) => {
    for (const plane of SIX_PLANE_KEYS) {
      const indicator = indicators.get(plane);
      if (!indicator) continue;
      const mask = weights[plane];
      const effective = snapshot[plane] * mask;
      const normalized = Math.min(1, Math.abs(effective) / Math.PI);
      const multiple = effective / Math.PI;
      const directionSymbol = effective >= 0 ? '⟳' : '⟲';
      indicator.fill.style.width = `${(normalized * 100).toFixed(1)}%`;
      indicator.fill.style.opacity = (0.45 + normalized * 0.45) * (0.6 + snapshot.confidence * 0.4);
      indicator.value.textContent = mask === 1
        ? `${effective >= 0 ? '+' : '−'}${Math.abs(multiple).toFixed(2)}π`
        : `${effective >= 0 ? '+' : '−'}${Math.abs(multiple).toFixed(2)}π (mask ${mask.toFixed(2)})`;
      indicator.direction.textContent = directionSymbol;
      indicator.card.dataset.direction = effective >= 0 ? 'pos' : 'neg';
      indicator.card.dataset.active = planeState(mask);
    }
  };

  return { updateSnapshot, updateWeights };
}

function planeState(weight: number): 'off' | 'partial' | 'on' {
  if (weight <= 0) return 'off';
  if (weight >= 1) return 'on';
  return 'partial';
}

function createPlaneMaskControls(
  container: HTMLDivElement,
  initial: RotationPlaneWeights,
  onChange: (weights: RotationPlaneWeights) => void
) {
  container.replaceChildren();
  const buttons = new Map<RotationPlane, HTMLButtonElement>();
  const state = createPlaneWeights(initial);

  const updateButton = (plane: RotationPlane) => {
    const button = buttons.get(plane);
    if (!button) return;
    const weight = state[plane];
    button.dataset.active = planeState(weight);
    button.textContent = plane.toUpperCase();
    button.setAttribute('aria-pressed', weight > 0 ? 'true' : 'false');
  };

  for (const plane of SIX_PLANE_KEYS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mask-toggle';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      state[plane] = state[plane] > 0 ? 0 : 1;
      updateButton(plane);
      onChange({ ...state } as RotationPlaneWeights);
    });
    buttons.set(plane, button);
    container.appendChild(button);
    updateButton(plane);
  }

  return {
    getWeights(): RotationPlaneWeights {
      return { ...state } as RotationPlaneWeights;
    },
    setWeights(weights: RotationPlaneWeights) {
      for (const plane of SIX_PLANE_KEYS) {
        state[plane] = weights[plane];
        updateButton(plane);
      }
    }
  };
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

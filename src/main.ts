import { HypercubeCore } from './core/hypercubeCore';
import { ZERO_ROTATION, type RotationAngles, type RotationSnapshot } from './core/rotationUniforms';
import { createHarmonicOrbit, SIX_PLANE_KEYS } from './core/sixPlaneOrbit';
import { getGeometry, type GeometryId } from './pipeline/geometryCatalog';
import { RotationBus } from './pipeline/rotationBus';

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const geometrySelect = document.getElementById('geometry') as HTMLSelectElement;
const projectionDepthSlider = document.getElementById('projectionDepth') as HTMLInputElement;
const lineWidthSlider = document.getElementById('lineWidth') as HTMLInputElement;
const rotationControlsContainer = document.getElementById('rotation-controls') as HTMLDivElement;

if (!canvas || !statusEl || !geometrySelect || !projectionDepthSlider || !lineWidthSlider || !rotationControlsContainer) {
  throw new Error('Required DOM nodes are missing');
}

const core = new HypercubeCore(canvas, {
  projectionDepth: Number(projectionDepthSlider.value),
  lineWidth: Number(lineWidthSlider.value)
});

const rotationBus = new RotationBus();
rotationBus.subscribe(snapshot => core.updateRotation(snapshot));

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
  statusEl.textContent = `Geometry: ${id} · vertices ${vertexCount} · edges ${edgeCount}`;
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

setGeometry('tesseract');
startSyntheticRotation(autoAngles, timestamp => pushRotationSnapshot(timestamp));
core.start();

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

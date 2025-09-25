import { HypercubeCore } from './core/hypercubeCore';
import { ZERO_ROTATION, type RotationAngles, type RotationSnapshot } from './core/rotationTypes';
import { getGeometry, type GeometryId } from './pipeline/geometryCatalog';
import { RotationBus } from './pipeline/rotationBus';
import type { GeometryData } from './geometry/types';
import { deriveExtrumentSnapshot, summariseExtrument } from './synthesis/extrumentMapping';

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const geometrySelect = document.getElementById('geometry') as HTMLSelectElement;
const projectionDepthSlider = document.getElementById('projectionDepth') as HTMLInputElement;
const lineWidthSlider = document.getElementById('lineWidth') as HTMLInputElement;
const matrixBlendSlider = document.getElementById('matrixBlend') as HTMLInputElement;
const dualBlendSlider = document.getElementById('dualBlend') as HTMLInputElement;
const rotationControlsContainer = document.getElementById('rotation-controls') as HTMLDivElement;
const harmonicStatusEl = document.getElementById('harmonic-status') as HTMLParagraphElement;

if (
  !canvas ||
  !statusEl ||
  !geometrySelect ||
  !projectionDepthSlider ||
  !lineWidthSlider ||
  !matrixBlendSlider ||
  !dualBlendSlider ||
  !rotationControlsContainer ||
  !harmonicStatusEl
) {
  throw new Error('Required DOM nodes are missing');
}

const core = new HypercubeCore(canvas, {
  projectionDepth: Number(projectionDepthSlider.value),
  lineWidth: Number(lineWidthSlider.value),
  matrixBlend: Number(matrixBlendSlider.value),
  dualQuaternionBlend: Number(dualBlendSlider.value)
});

const rotationBus = new RotationBus();
rotationBus.subscribe(snapshot => {
  core.updateRotation(snapshot);
  if (activeGeometryData) {
    harmonicStatusEl.textContent = summariseExtrument(deriveExtrumentSnapshot(activeGeometryData, snapshot));
  }
});

const rotationState: RotationSnapshot = {
  ...ZERO_ROTATION,
  timestamp: performance.now(),
  confidence: 1
};

createRotationControls(rotationControlsContainer, rotationState, rotationBus);
rotationBus.push({ ...rotationState });

let activeGeometry: GeometryId = 'tesseract';
let activeGeometryData: GeometryData | null = null;

function updateStatus(geometry: GeometryData) {
  const vertexCount = geometry.positions.length / geometry.vertexStride;
  const edgeCount = geometry.indices.length / 2;
  statusEl.textContent = `Geometry: ${activeGeometry} · vertices ${vertexCount} · edges ${edgeCount} · matrix ${Number(matrixBlendSlider.value).toFixed(2)} · rotor ${Number(dualBlendSlider.value).toFixed(2)}`;
  const snapshot = deriveExtrumentSnapshot(geometry, rotationState);
  harmonicStatusEl.textContent = summariseExtrument(snapshot);
}

function setGeometry(id: GeometryId) {
  const geometry = getGeometry(id);
  activeGeometry = id;
  activeGeometryData = geometry;
  core.setGeometry(geometry);
  updateStatus(geometry);
}

geometrySelect.addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value as GeometryId;
  setGeometry(value);
});

projectionDepthSlider.addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  core.setProjectionDepth(value);
  const geometry = getGeometry(activeGeometry);
  updateStatus(geometry);
});

lineWidthSlider.addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  core.setLineWidth(value);
});

matrixBlendSlider.addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  core.setMatrixBlend(value);
  const geometry = getGeometry(activeGeometry);
  updateStatus(geometry);
});

dualBlendSlider.addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  core.setDualQuaternionBlend(value);
  const geometry = getGeometry(activeGeometry);
  updateStatus(geometry);
});

setGeometry('tesseract');
startSyntheticRotation(rotationBus);
core.start();

function createRotationControls(container: HTMLDivElement, state: RotationSnapshot, bus: RotationBus) {
  const planes: Array<{ key: keyof RotationAngles; label: string }> = [
    { key: 'xy', label: 'XY Plane' },
    { key: 'xz', label: 'XZ Plane' },
    { key: 'yz', label: 'YZ Plane' },
    { key: 'xw', label: 'XW Plane' },
    { key: 'yw', label: 'YW Plane' },
    { key: 'zw', label: 'ZW Plane' }
  ];

  planes.forEach(({ key, label }) => {
    const group = document.createElement('section');
    group.className = 'control-group';

    const title = document.createElement('label');
    title.textContent = label;
    title.htmlFor = `rotation-${key}`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '-3.14159';
    slider.max = '3.14159';
    slider.step = '0.01';
    slider.value = state[key].toString();
    slider.id = `rotation-${key}`;

    const valueLabel = document.createElement('span');
    valueLabel.textContent = `${state[key].toFixed(2)} rad`;
    valueLabel.style.fontSize = '0.8rem';
    valueLabel.style.color = 'rgba(211,246,255,0.8)';

    slider.addEventListener('input', () => {
      state[key] = Number(slider.value);
      state.timestamp = performance.now();
      bus.push({ ...state });
      valueLabel.textContent = `${state[key].toFixed(2)} rad`;
    });

    group.appendChild(title);
    group.appendChild(slider);
    group.appendChild(valueLabel);
    container.appendChild(group);
  });
}

function startSyntheticRotation(bus: RotationBus) {
  let lastTime = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    rotationState.timestamp = now;
    rotationState.xy += dt * 0.35;
    rotationState.xz += dt * 0.21;
    rotationState.yz += dt * 0.17;
    rotationState.xw += dt * 0.17;
    rotationState.yw += dt * 0.11;
    rotationState.zw += dt * 0.07;

    bus.push({ ...rotationState });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

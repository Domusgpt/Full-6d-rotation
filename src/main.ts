import { HypercubeCore } from './core/hypercubeCore';
import { ZERO_ROTATION, type RotationAngles, type RotationSnapshot } from './core/rotationUniforms';
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

createRotationControls(rotationControlsContainer, rotationState, rotationBus);
rotationBus.push({ ...rotationState });

function setGeometry(id: GeometryId) {
  const geometry = getGeometry(id);
  core.setGeometry(geometry);
  statusEl.textContent = `Geometry: ${id} · vertices ${(geometry.positions.length / 4).toFixed(0)} · edges ${geometry.indices.length / 2}`;
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
    rotationState.xw += dt * 0.17;
    rotationState.yw += dt * 0.11;

    bus.push({ ...rotationState });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

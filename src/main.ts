import { HypercubeCore } from './core/hypercubeCore';
import {
  rotationEnergy,
  ZERO_ROTATION,
  type RotationAngles,
  type RotationSnapshot
} from './core/rotationUniforms';
import { createHarmonicOrbit, SIX_PLANE_KEYS } from './core/sixPlaneOrbit';
import { type GeometryId } from './pipeline/geometryCatalog';
import { RotationBus } from './pipeline/rotationBus';
import { GeometryController } from './pipeline/geometryController';
import { DatasetExportService } from './pipeline/datasetExport';
import {
  DatasetManifestBuilder,
  DATASET_MANIFEST_STORAGE_KEY,
  createManifestDownloadName,
  type DatasetManifest
} from './pipeline/datasetManifest';
import { LocalPspStream } from './pipeline/pspStream';
import { FocusDirector } from './pipeline/focusDirector';
import { LatencyTracker } from './pipeline/latencyTracker';
import {
  ExtrumentHub,
  normalizeSnapshot,
  describeSnapshot,
  type NormalizedSnapshot
} from './ingestion/extrumentHub';
import { discoverMidiAdapters } from './ingestion/midiExtrument';
import {
  Parserator,
  gravityIsolation,
  lowPassGyro,
  featureWindow,
  type PreprocessorRegistration,
  type Preprocessor
} from './ingestion/parserator';
import { AVAILABLE_PROFILES, DEFAULT_PROFILE, getProfileById } from './ingestion/profiles';
import { TelemetryLoom } from './pipeline/telemetryLoom';

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
const manifestFramesEl = document.getElementById('manifest-frames') as HTMLSpanElement;
const manifestP95El = document.getElementById('manifest-p95') as HTMLSpanElement;
const manifestConfidenceEl = document.getElementById('manifest-confidence') as HTMLSpanElement;
const manifestDownloadButton = document.getElementById('manifest-download') as HTMLButtonElement;
const parseratorProfileNameEl = document.getElementById('parserator-profile-name') as HTMLSpanElement;
const parseratorProfileSelect = document.getElementById('parserator-profile-select') as HTMLSelectElement;
const parseratorConfidenceValueEl = document.getElementById('parserator-confidence-value') as HTMLSpanElement;
const parseratorConfidenceInput = document.getElementById('parserator-confidence-input') as HTMLInputElement;
const parseratorPreprocessorsEl = document.getElementById('parserator-preprocessors') as HTMLSpanElement;
const parseratorPreprocessorContainer = document.getElementById('parserator-preprocessor-controls') as HTMLDivElement;
const extrumentStatusEl = document.getElementById('extrument-status') as HTMLSpanElement;
const extrumentOutputEl = document.getElementById('extrument-output') as HTMLSpanElement;
const extrumentPayloadEl = document.getElementById('extrument-payload') as HTMLSpanElement;
const extrumentConnectButton = document.getElementById('extrument-connect') as HTMLButtonElement;
const telemetryCountEl = document.getElementById('telemetry-count') as HTMLSpanElement;
const telemetryEventsEl = document.getElementById('telemetry-events') as HTMLUListElement;

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
  !datasetFormatEl ||
  !manifestFramesEl ||
  !manifestP95El ||
  !manifestDownloadButton ||
  !manifestConfidenceEl ||
  !parseratorProfileNameEl ||
  !parseratorProfileSelect ||
  !parseratorConfidenceValueEl ||
  !parseratorConfidenceInput ||
  !parseratorPreprocessorsEl ||
  !parseratorPreprocessorContainer ||
  !extrumentStatusEl ||
  !extrumentOutputEl ||
  !extrumentPayloadEl ||
  !extrumentConnectButton ||
  !telemetryCountEl ||
  !telemetryEventsEl
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

let persistedManifest: DatasetManifest | undefined;
try {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(DATASET_MANIFEST_STORAGE_KEY);
    if (raw) {
      persistedManifest = JSON.parse(raw) as DatasetManifest;
    }
  }
} catch (error) {
  console.warn('Failed to load dataset manifest', error);
}

const manifestBuilder = new DatasetManifestBuilder({ hydrateFrom: persistedManifest });
const pspStream = new LocalPspStream();
const focusDirector = new FocusDirector(geometryController, rotationBus, { fallbackGeometry: 'tesseract' });
const MAX_PENDING_FRAMES = 48;

const extrumentHub = new ExtrumentHub<NormalizedSnapshot>({
  transform: normalizeSnapshot,
  onError: (error, adapter) => {
    console.warn('Extrument adapter error', error);
    extrumentStatusEl.textContent = `Error · ${adapter.id}`;
    extrumentConnected = false;
    extrumentConnectButton.disabled = false;
  }
});
const extrumentAdapterLabels = new Map<string, string>();
let extrumentConnected = false;
const extrumentDisconnectors: Array<() => void> = [];

const parserator = new Parserator();
const telemetryLoom = new TelemetryLoom(180);
if (persistedManifest?.telemetry) {
  telemetryLoom.hydrate(persistedManifest.telemetry);
}
const TELEMETRY_DISPLAY_LIMIT = 24;

type PreprocessorOption = {
  id: string;
  label: string;
  description: string;
  factory: () => Preprocessor;
};

const PREPROCESSOR_OPTIONS: PreprocessorOption[] = [
  {
    id: 'low-pass',
    label: 'Low-pass gyro',
    description: 'Smooths gyro spikes with an adaptive exponential filter.',
    factory: () => lowPassGyro(6)
  },
  {
    id: 'gravity',
    label: 'Gravity isolation',
    description: 'Normalises acceleration vectors to isolate orientation cues.',
    factory: () => gravityIsolation(0.85)
  },
  {
    id: 'feature-window',
    label: 'Feature window',
    description: 'Averages the last eight samples to reduce jitter before mapping.',
    factory: () => featureWindow(8)
  }
];

const preprocessorHandles = new Map<string, PreprocessorRegistration>();
const preprocessorCheckboxes = new Map<string, HTMLInputElement>();
const preprocessorLookup = new Map(PREPROCESSOR_OPTIONS.map(option => [option.id, option]));

rotationBus.subscribe(snapshot => {
  const normalized = normalizeSnapshot(snapshot);
  lastExtrumentSummary = describeSnapshot(normalized);
  extrumentPayloadEl.textContent = lastExtrumentSummary;
  void extrumentHub.broadcastPayload(normalized);
});

populateParseratorProfiles();
renderParseratorPreprocessors();
renderTelemetry();

const hydratedIngestion = persistedManifest?.ingestion;
if (hydratedIngestion) {
  const profile = getProfileById(hydratedIngestion.profileId) ?? DEFAULT_PROFILE;
  parserator.setProfile(profile);
  parserator.setConfidenceFloor(hydratedIngestion.confidenceFloor);
  for (const id of hydratedIngestion.preprocessors) {
    const option = preprocessorLookup.get(id);
    if (option) {
      setPreprocessorState(option, true, false);
    }
  }
  logParseratorEvent('Hydrated parserator config', {
    profile: profile.name,
    profileId: profile.id,
    confidence: parserator.getConfidenceFloor(),
    preprocessors: hydratedIngestion.preprocessors.map(
      value => preprocessorLookup.get(value)?.label ?? value
    )
  });
} else {
  parserator.setProfile(DEFAULT_PROFILE);
  logParseratorEvent('Parserator initialised', {
    profile: DEFAULT_PROFILE.name,
    profileId: DEFAULT_PROFILE.id,
    confidence: parserator.getConfidenceFloor(),
    preprocessors: []
  });
}

parseratorProfileSelect.addEventListener('change', event => {
  const target = event.target as HTMLSelectElement;
  const profile = getProfileById(target.value) ?? DEFAULT_PROFILE;
  parserator.setProfile(profile);
  updateParseratorTelemetry();
  persistIngestionConfig();
  logParseratorEvent('Profile selected', {
    profile: profile.name,
    profileId: profile.id
  });
});

parseratorConfidenceInput.addEventListener('input', () => {
  setConfidenceFloor(Number(parseratorConfidenceInput.value), false);
});

parseratorConfidenceInput.addEventListener('change', () => {
  setConfidenceFloor(Number(parseratorConfidenceInput.value), true);
});

updateParseratorTelemetry();

if (!hydratedIngestion) {
  persistIngestionConfig();
}

const rotationState: RotationSnapshot = {
  ...ZERO_ROTATION,
  timestamp: performance.now(),
  confidence: 1
};

const manualOffsets: RotationAngles = { ...ZERO_ROTATION };
const autoAngles: RotationAngles = { ...ZERO_ROTATION };

let updateRotationLabels: (combined: RotationAngles, manual: RotationAngles) => void;
let lastExtrumentSummary = '–';

function pushRotationSnapshot(timestamp: number) {
  rotationState.timestamp = timestamp;

  for (const plane of SIX_PLANE_KEYS) {
    rotationState[plane] = autoAngles[plane] + manualOffsets[plane];
  }

  const energy = rotationEnergy(rotationState);

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

function updateManifestTelemetry() {
  const manifest = manifestBuilder.getManifest();
  manifestFramesEl.textContent = manifest.stats.totalFrames.toString();
  manifestP95El.textContent =
    manifest.stats.totalFrames && manifest.stats.p95TotalLatencyMs
      ? `${manifest.stats.p95TotalLatencyMs.toFixed(1)} ms`
      : '–';
  manifestDownloadButton.disabled = manifest.stats.totalFrames === 0;

  const histogram = manifest.stats.confidenceHistogram;
  if (histogram?.totalSamples) {
    const bucketSize = histogram.bucketSize || 0.1;
    const thresholdIndex = Math.min(
      histogram.counts.length - 1,
      Math.max(0, Math.ceil(0.9 / bucketSize) - 1)
    );
    const highConfidence = histogram.counts
      .slice(thresholdIndex)
      .reduce((sum, value) => sum + value, 0);
    const percentage = Math.round((highConfidence / histogram.totalSamples) * 100);
    manifestConfidenceEl.textContent = `${percentage}% · ${highConfidence}`;
  } else {
    manifestConfidenceEl.textContent = '–';
  }
}

function persistManifest() {
  try {
    manifestBuilder.updateTelemetry(telemetryLoom.snapshot());
    if (typeof localStorage === 'undefined') {
      return;
    }
    const manifest = manifestBuilder.getManifest();
    localStorage.setItem(DATASET_MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
  } catch (error) {
    console.warn('Failed to persist dataset manifest', error);
  }
}

function logParseratorEvent(message: string, metadata?: Record<string, unknown>) {
  telemetryLoom.record({ category: 'parserator', message, metadata });
  renderTelemetry();
  persistManifest();
}

function renderTelemetry() {
  const events = telemetryLoom.list();
  telemetryCountEl.textContent = `${events.length} events`;
  telemetryEventsEl.innerHTML = '';

  const recent = events.slice(-TELEMETRY_DISPLAY_LIMIT).reverse();
  for (const event of recent) {
    const item = document.createElement('li');
    item.dataset.category = event.category;

    const textWrapper = document.createElement('div');
    textWrapper.className = 'telemetry-text';

    const message = document.createElement('span');
    message.className = 'telemetry-message';
    message.textContent = event.message;
    textWrapper.appendChild(message);

    if (event.metadata && Object.keys(event.metadata).length) {
      const metadata = document.createElement('span');
      metadata.className = 'telemetry-metadata';
      metadata.textContent = formatTelemetryMetadata(event.metadata);
      textWrapper.appendChild(metadata);
    }

    const timestamp = document.createElement('time');
    timestamp.className = 'telemetry-timestamp';
    timestamp.dateTime = new Date(event.timestamp).toISOString();
    timestamp.textContent = formatEventTimestamp(event.timestamp);

    item.appendChild(textWrapper);
    item.appendChild(timestamp);
    telemetryEventsEl.appendChild(item);
  }

  if (!recent.length) {
    const empty = document.createElement('li');
    empty.className = 'telemetry-empty';
    empty.textContent = 'No parserator events yet';
    telemetryEventsEl.appendChild(empty);
  }
}

function formatTelemetryMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${formatMetadataValue(value)}`)
    .join(' · ');
}

function formatMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : 'none';
  }
  if (typeof value === 'number') {
    if (value >= 0 && value <= 1) {
      return value.toFixed(2);
    }
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

function formatEventTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function populateParseratorProfiles() {
  parseratorProfileSelect.innerHTML = '';
  for (const profile of AVAILABLE_PROFILES) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    parseratorProfileSelect.appendChild(option);
  }
}

function renderParseratorPreprocessors() {
  parseratorPreprocessorContainer.innerHTML = '';
  preprocessorCheckboxes.clear();

  for (const option of PREPROCESSOR_OPTIONS) {
    const label = document.createElement('label');
    label.className = 'parserator-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = option.id;
    checkbox.addEventListener('change', () => {
      setPreprocessorState(option, checkbox.checked);
    });

    const textContainer = document.createElement('div');
    const title = document.createElement('span');
    title.textContent = option.label;
    const hint = document.createElement('small');
    hint.textContent = option.description;
    textContainer.appendChild(title);
    textContainer.appendChild(hint);

    label.appendChild(checkbox);
    label.appendChild(textContainer);
    parseratorPreprocessorContainer.appendChild(label);
    preprocessorCheckboxes.set(option.id, checkbox);
  }
}

function setPreprocessorState(option: PreprocessorOption, enabled: boolean, persist = true) {
  const current = preprocessorHandles.get(option.id);
  if (enabled && !current) {
    const registration = parserator.registerPreprocessor(option.factory(), { id: option.id });
    preprocessorHandles.set(option.id, registration);
  } else if (!enabled && current) {
    current.dispose();
    preprocessorHandles.delete(option.id);
  }

  updateParseratorTelemetry();

  if (persist) {
    logParseratorEvent(`${enabled ? 'Enabled' : 'Disabled'} ${option.label}`, {
      preprocessorId: option.id,
      enabled
    });
    persistIngestionConfig();
  }
}

function setConfidenceFloor(value: number, persist = true) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : parserator.getConfidenceFloor()));
  parserator.setConfidenceFloor(clamped);
  updateParseratorTelemetry();
  if (persist) {
    logParseratorEvent('Confidence floor updated', { confidence: clamped });
    persistIngestionConfig();
  }
}

function persistIngestionConfig() {
  const profile = parserator.getProfile();
  manifestBuilder.updateIngestionConfig({
    profileId: profile.id,
    profileName: profile.name,
    confidenceFloor: parserator.getConfidenceFloor(),
    preprocessors: parserator.listPreprocessors()
  });
  persistManifest();
}

function updateParseratorTelemetry() {
  const profile = parserator.getProfile();
  parseratorProfileNameEl.textContent = profile.name;
  parseratorProfileSelect.value = profile.id;

  const confidence = parserator.getConfidenceFloor();
  parseratorConfidenceValueEl.textContent = confidence.toFixed(2);
  parseratorConfidenceInput.value = confidence.toFixed(2);

  const activeIds = parserator.listPreprocessors();
  if (!activeIds.length) {
    parseratorPreprocessorsEl.textContent = '–';
  } else {
    parseratorPreprocessorsEl.textContent = activeIds
      .map(id => preprocessorLookup.get(id)?.label ?? id)
      .join(', ');
  }

  for (const [id, checkbox] of preprocessorCheckboxes) {
    checkbox.checked = preprocessorHandles.has(id);
  }
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
  updateManifestTelemetry();
}

async function connectExtruments() {
  if (extrumentConnected) {
    updateExtrumentStatus();
    return;
  }

  extrumentConnectButton.disabled = true;
  extrumentStatusEl.textContent = 'Scanning MIDI…';

  try {
    const navigatorWithMidi = navigator as Navigator & { requestMIDIAccess?: () => Promise<any> };
    if (!navigatorWithMidi.requestMIDIAccess) {
      extrumentStatusEl.textContent = 'WebMIDI unavailable';
      extrumentConnectButton.disabled = false;
      return;
    }

    const adapters = await discoverMidiAdapters({
      accessFactory: () => navigatorWithMidi.requestMIDIAccess!()
    });

    if (!adapters.length) {
      extrumentStatusEl.textContent = 'No MIDI outputs found';
      extrumentConnectButton.disabled = false;
      return;
    }

    extrumentDisconnectors.forEach(dispose => dispose());
    extrumentDisconnectors.length = 0;

    for (const adapter of adapters) {
      extrumentAdapterLabels.set(adapter.id, adapter.label ?? adapter.id);
      const dispose = extrumentHub.register(adapter);
      extrumentDisconnectors.push(dispose);
      await extrumentHub.connect(adapter.id);
    }

    extrumentConnected = true;
    extrumentStatusEl.textContent = `Connected · ${adapters.length}`;
    extrumentConnectButton.textContent = 'MIDI Connected';
    extrumentConnectButton.disabled = true;
    updateExtrumentStatus();
    extrumentPayloadEl.textContent = lastExtrumentSummary;
  } catch (error) {
    console.error('Failed to connect extruments', error);
    extrumentStatusEl.textContent = 'Connection failed';
    extrumentConnectButton.disabled = false;
  }
}

function updateExtrumentStatus() {
  const states = extrumentHub.listAdapters();
  if (!states.length) {
    extrumentStatusEl.textContent = extrumentConnected ? 'Connected' : 'Idle';
    if (!extrumentConnected) {
      extrumentOutputEl.textContent = '–';
    }
    return;
  }
  const connected = states.filter(state => state.connected);
  if (connected.length) {
    extrumentStatusEl.textContent = `Connected · ${connected.length}`;
  } else {
    extrumentStatusEl.textContent = 'Ready';
  }
  const labels = states
    .map(state => extrumentAdapterLabels.get(state.id) ?? state.id.replace(/^midi:/, ''))
    .join(', ');
  extrumentOutputEl.textContent = labels || '–';
}

updateRotationLabels = createRotationControls(rotationControlsContainer, manualOffsets, () => {
  pushRotationSnapshot(performance.now());
});

pushRotationSnapshot(performance.now());

extrumentConnectButton.addEventListener('click', () => {
  void connectExtruments();
});

manifestDownloadButton.addEventListener('click', downloadManifest);

updateExtrumentStatus();
updateManifestTelemetry();

window.addEventListener('beforeunload', () => {
  extrumentDisconnectors.forEach(dispose => dispose());
});

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
      confidence: snapshot.confidence,
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
    const metrics = datasetExport.getMetrics();
    const format = metrics.lastFormat ?? 'image/png';
    frames.forEach(frame => {
      manifestBuilder.addFrame(frame.metadata, format);
      pspStream.publish(frame);
    });
    persistManifest();
    updateTelemetry();
  }
}, 2000);

function downloadManifest() {
  persistManifest();
  const manifest = manifestBuilder.getManifest();
  const contents = JSON.stringify(manifest, null, 2);
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = createManifestDownloadName(manifest);
  anchor.style.display = 'none';
  const host = document.body ?? document.documentElement;
  host?.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

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

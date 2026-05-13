import { SceneManager } from './scene.js';
import { EnvironmentModel } from './model.js';
import { DeviceDataStore, DeviceDataPanels } from './device_data.js';
import { RequesterPanels } from './requester.js';

const canvas = document.getElementById('three-canvas');
const sceneMgr = new SceneManager(canvas);

const envModel = new EnvironmentModel(sceneMgr.scene);

const store = new DeviceDataStore();
new DeviceDataPanels(document.getElementById('device-data-panels'), store);
const requesterPanels = new RequesterPanels(
  document.getElementById('requester-panels'),
  store
);

loadPresets();

async function loadPresets() {
  let res;
  try {
    res = await fetch('/preset.json');
  } catch (err) {
    console.warn('[preset] fetch failed:', err);
    return;
  }
  if (!res.ok) {
    console.warn(`[preset] not loaded (HTTP ${res.status})`);
    return;
  }
  let preset;
  try {
    preset = await res.json();
  } catch (err) {
    console.warn('[preset] invalid JSON:', err);
    return;
  }
  applyEnvironmentModelPreset(preset?.environmentModel);
  applyRequesterPresets(preset?.requesters);
}

async function applyEnvironmentModelPreset(cfg) {
  if (!cfg || typeof cfg !== 'object') return;

  const offset = cfg.offset ?? {};
  const x = Number(offset.x) || 0;
  const y = Number(offset.y) || 0;
  const z = Number(offset.z) || 0;
  const ry = Number(cfg.rotationYDeg) || 0;
  const scale = Number(cfg.scale);
  const grid = cfg.grid ?? {};
  const cellSize = Number(grid.cellSize);
  const cellCount = parseInt(grid.cellCount, 10);

  document.getElementById('offset-x').value = x;
  document.getElementById('offset-y').value = y;
  document.getElementById('offset-z').value = z;
  document.getElementById('rotation-y').value = ry;
  if (scale > 0) document.getElementById('model-scale').value = scale;
  if (cellSize > 0) document.getElementById('grid-cell-size').value = cellSize;
  if (cellCount > 0) document.getElementById('grid-cell-count').value = cellCount;

  envModel.setOffset(x, y, z);
  envModel.setRotationY(ry);
  if (scale > 0) envModel.setScale(scale);
  if (cellSize > 0 && cellCount > 0) sceneMgr.setGrid(cellSize, cellCount);

  if (typeof cfg.fbxPath === 'string' && cfg.fbxPath) {
    try {
      await envModel.loadFromURL(cfg.fbxPath);
    } catch (err) {
      console.warn(`[preset] failed to load FBX "${cfg.fbxPath}":`, err);
    }
  }
}

function applyRequesterPresets(list) {
  if (!Array.isArray(list)) {
    if (list !== undefined) console.warn('[preset] requesters: expected an array, got:', list);
    return;
  }
  for (const entry of list) {
    const period = Number(entry?.periodSec);
    if (typeof entry?.databaseName !== 'string' || !entry.databaseName || !(period > 0)) {
      console.warn('[preset] skipping invalid requester entry:', entry);
      continue;
    }
    requesterPanels.add(entry.databaseName, period);
  }
}

// Spec-required global function: GetDeviceData(DeviceName, DataCategory, DataName)
window.GetDeviceData = (deviceName, dataCategory, dataName) =>
  store.getDeviceData(deviceName, dataCategory, dataName);
window.deviceDataStore = store;

// --- Set Environment Model ---
const envFileInput = document.getElementById('env-model-file');

document.getElementById('set-env-model').addEventListener('click', () => {
  envFileInput.click();
});

envFileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await envModel.loadFromFile(file);
  } catch (err) {
    alert('Failed to load FBX: ' + err.message);
  } finally {
    envFileInput.value = '';
  }
});

document.getElementById('apply-transform').addEventListener('click', () => {
  const x = parseFloat(document.getElementById('offset-x').value) || 0;
  const y = parseFloat(document.getElementById('offset-y').value) || 0;
  const z = parseFloat(document.getElementById('offset-z').value) || 0;
  const ry = parseFloat(document.getElementById('rotation-y').value) || 0;
  const scale = parseFloat(document.getElementById('model-scale').value);
  const cellSize = parseFloat(document.getElementById('grid-cell-size').value);
  const cellCount = parseInt(document.getElementById('grid-cell-count').value, 10);
  envModel.setOffset(x, y, z);
  envModel.setRotationY(ry);
  if (scale > 0) envModel.setScale(scale);
  if (cellSize > 0 && cellCount > 0) sceneMgr.setGrid(cellSize, cellCount);
});

// --- Add Requester dialog ---
const dialog = document.getElementById('requester-dialog');
const dbInput = document.getElementById('dialog-database');
const periodInput = document.getElementById('dialog-period');

function openDialog() {
  dialog.classList.add('visible');
  dbInput.focus();
}
function closeDialog() {
  dialog.classList.remove('visible');
}
function submitDialog() {
  const name = dbInput.value.trim();
  const period = parseFloat(periodInput.value);
  if (!name || !(period > 0)) {
    alert('Please enter a database_name and a positive request_period.');
    return;
  }
  requesterPanels.add(name, period);
  dbInput.value = '';
  closeDialog();
}

document.getElementById('add-requester').addEventListener('click', openDialog);
document.getElementById('dialog-cancel').addEventListener('click', closeDialog);
document.getElementById('dialog-ok').addEventListener('click', submitDialog);

dialog.addEventListener('click', (e) => {
  if (e.target === dialog) closeDialog();
});
document.addEventListener('keydown', (e) => {
  if (!dialog.classList.contains('visible')) return;
  if (e.key === 'Escape') closeDialog();
  else if (e.key === 'Enter') submitDialog();
});

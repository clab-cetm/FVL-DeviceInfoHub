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

// Spec-required global function: GetDeviceData(DeviceName, DataCategory, DataName)
window.GetDeviceData = (deviceName, dataCategory, dataName) =>
  store.getDeviceData(deviceName, dataCategory, dataName);
window.deviceDataStore = store;

// --- Set Environment Model ---
const envFileInput = document.getElementById('env-model-file');
const modelControls = document.getElementById('model-controls');

document.getElementById('set-env-model').addEventListener('click', () => {
  envFileInput.click();
});

envFileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await envModel.loadFromFile(file);
    modelControls.classList.add('visible');
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
  envModel.setOffset(x, y, z);
  envModel.setRotationY(ry);
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

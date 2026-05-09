// Holds the latest device data keyed by friendly_name. Each entry stores
// `ip`, `updated_at`, and one sub-object per database category (e.g. `transform`,
// `anchor`) with the custom fields from that database's response.
export class DeviceDataStore {
  constructor() {
    this.devices = new Map();
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this.devices);
  }

  ingest(category, response) {
    if (!Array.isArray(response)) return;
    for (const item of response) {
      const name = item?.friendly_name;
      if (!name) continue;

      let entry = this.devices.get(name);
      if (!entry) {
        entry = { friendly_name: name };
        this.devices.set(name, entry);
      }
      if (item.ip !== undefined) entry.ip = item.ip;
      if (item.updated_at !== undefined) entry.updated_at = item.updated_at;
      entry[category] = item.data ?? {};
    }
    this.notify();
  }

  getDeviceData(deviceName, dataCategory, dataName) {
    const dev = this.devices.get(deviceName);
    if (!dev) return undefined;
    const cat = dev[dataCategory];
    if (!cat || typeof cat !== 'object') return undefined;
    return cat[dataName];
  }
}

export class DeviceDataPanels {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this.panels = new Map();
    store.onChange(() => this.render());
  }

  render() {
    for (const [name, data] of this.store.devices) {
      let panel = this.panels.get(name);
      if (!panel) {
        panel = this.createPanel(name);
        this.panels.set(name, panel);
        this.container.appendChild(panel.el);
      }
      panel.update(data);
    }
  }

  createPanel(name) {
    const el = document.createElement('div');
    el.className = 'device-panel';

    const nameEl = document.createElement('div');
    nameEl.className = 'device-name';
    nameEl.textContent = name;

    const ipEl = document.createElement('div');
    ipEl.className = 'device-row';
    const ipLabel = document.createElement('span');
    ipLabel.className = 'label';
    ipLabel.textContent = 'ip';
    const ipVal = document.createElement('span');
    ipEl.append(ipLabel, ipVal);

    const timeEl = document.createElement('div');
    timeEl.className = 'device-row';
    const timeLabel = document.createElement('span');
    timeLabel.className = 'label';
    timeLabel.textContent = 'updated';
    const timeVal = document.createElement('span');
    timeEl.append(timeLabel, timeVal);

    el.append(nameEl, ipEl, timeEl);

    return {
      el,
      update(data) {
        ipVal.textContent = data.ip ?? '-';
        timeVal.textContent = data.updated_at ?? '-';
      }
    };
  }
}

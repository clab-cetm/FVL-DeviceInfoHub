// Periodically GETs `/{databaseName}/all`, feeds the response into the store,
// and notifies its panel via the onResponse callback.
export class Requester {
  constructor(databaseName, periodSec, store, onResponse) {
    this.databaseName = databaseName;
    this.periodSec = periodSec;
    this.store = store;
    this.onResponse = onResponse;
    this.intervalId = null;
    this.start();
  }

  start() {
    this.fetchOnce();
    this.intervalId = setInterval(() => this.fetchOnce(), this.periodSec * 1000);
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async fetchOnce() {
    const url = `/${encodeURIComponent(this.databaseName)}/all`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) {
        this.onResponse({ ok: false, text: `HTTP ${res.status}: ${text}` });
        return;
      }
      try {
        const data = JSON.parse(text);
        this.store.ingest(this.databaseName, data);
      } catch {
        // Non-JSON body — still display it raw.
      }
      this.onResponse({ ok: true, text });
    } catch (err) {
      this.onResponse({ ok: false, text: String(err) });
    }
  }
}

export class RequesterPanels {
  constructor(container, store) {
    this.container = container;
    this.store = store;
  }

  add(databaseName, periodSec) {
    const el = document.createElement('div');
    el.className = 'requester-panel collapsed';

    const header = document.createElement('div');
    header.className = 'requester-header';

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = `${databaseName} @${periodSec}s`;

    const preview = document.createElement('span');
    preview.className = 'preview';
    preview.textContent = 'pending...';

    const status = document.createElement('span');
    status.className = 'status';

    const toggleBtn = document.createElement('button');
    toggleBtn.title = 'Toggle expand/collapse';
    toggleBtn.textContent = '▲';

    const closeBtn = document.createElement('button');
    closeBtn.title = 'Remove requester';
    closeBtn.textContent = '✕';

    header.append(title, preview, status, toggleBtn, closeBtn);

    const body = document.createElement('pre');
    body.className = 'requester-body';
    body.textContent = '';

    el.append(header, body);
    this.container.appendChild(el);

    const requester = new Requester(databaseName, periodSec, this.store, ({ ok, text }) => {
      const oneLine = text.replace(/\s+/g, ' ').trim();
      preview.textContent = oneLine.length > 0 ? oneLine : '(empty)';
      preview.style.color = ok ? '#cfcfcf' : '#f88';
      status.textContent = new Date().toLocaleTimeString();
      body.textContent = formatBody(text);
    });

    toggleBtn.addEventListener('click', () => {
      const collapsed = el.classList.toggle('collapsed');
      toggleBtn.textContent = collapsed ? '▲' : '▼';
    });

    closeBtn.addEventListener('click', () => {
      requester.stop();
      el.remove();
    });
  }
}

function formatBody(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

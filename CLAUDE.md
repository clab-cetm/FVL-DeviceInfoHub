# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DeviceInfoHub is a Go server that ingests device telemetry over OSC (UDP) and exposes it through an HTTP/JSON API. A Three.js console (Frontend/) is the reference client. Built for the 2026《身後的中原》project at FVL — extracts the reusable pieces of an existing console backend into a standalone server.

The full functional spec lives in `Backend/Spec.md` and `Frontend/Spec.md`. Read them before changing public behavior.

## Repo layout

- `Backend/` — Go server. Single-file (`main.go`), `go.mod` module name `DeviceInfoHub`. Runs three goroutines: UDP broadcaster (LAN discovery), OSC server (ingest), HTTP server (query + static files).
- `Frontend/` — Vanilla-JS Three.js console. ES modules with an `<script type="importmap">` pulling Three from unpkg — no bundler, no `npm install`.
- `Backend/DeviceInfoHub.exe` — committed binary kept in sync with `main.go` (per README, rebuild and commit when source changes).
- `README.md` still references a `Server/` folder; the source has since been split into `Backend/` and `Frontend/`. The git status shows the rename in progress — treat that as the source of truth.

## Commands (run from `Backend/`)

```powershell
go mod tidy                  # first-time setup
go run .                     # run server (reads ./config.json, writes ./db/*.db)
go build -o DeviceInfoHub.exe .
```

There is no test suite, linter config, or CI in this repo.

## Runtime architecture

`main.go` is the whole server. Four config-driven concerns, all wired in `main()`:

1. **Config** (`config.json`, loaded relative to cwd) — declares broadcast/OSC/HTTP ports, the set of databases, and the device-ID allowlist. `validateConfig` enforces invariants on startup; failures call `log.Fatalf` and exit.
2. **Per-database SQLite files** — one `db/<name>.db` per entry in `config.databases`. Schema is fixed: `devices(friendly_name PK, data TEXT, ip TEXT, updated_at TEXT)`. `data` holds the OSC payload as JSON (param-name → value). Writes are upserts keyed by `friendly_name`.
3. **OSC ingest** (`startOSCServer`) — listens on raw UDP so the sender IP is captured. The OSC address selects the database: `/transform` → `databases["transform"]` → `db/transform.db`. Argument 0 is always the device id (string); registered ids in `device_id_to_friendly_name` get mapped to a friendly name and the row gets upserted. Unregistered ids are dropped with a log.
4. **HTTP API + static files** (`startHTTPServer`) — single catch-all handler. If the first path segment matches a known database name, it serves the API (`/<db>/all` or `/<db>/<friendly_name>`); otherwise it falls through to `http.FileServer(http.Dir("."))`. CORS is open (`*`).

Because the HTTP server serves static files from the process cwd, the intended deploy pattern is to colocate the binary, `config.json`, and the Frontend assets in one directory — that's why `Frontend/db/` already contains `.db` files (the server was previously run from `Frontend/`).

## Important invariants when editing config or schemas

- Each `databases[*].osc_type_tag` must start with `,` and the **first type character must be `s`** — argument 0 is the device id. `validateConfig` rejects anything else.
- `osc_param_name.length` must equal the number of type characters after the comma. Mismatches `log.Fatalf` on startup.
- The map key in `databases` is both the OSC address suffix (`/<key>`) and the SQLite filename (`db/<key>.db`). Renaming a key effectively migrates to a new database file — old data does not move.
- Adding a new device type usually means: register the device id in `device_id_to_friendly_name`, add a `databases` entry, restart the server. No code change needed.

## Frontend

Loaded by opening `index.html` through the Go server (so the `/<db>/all` fetches are same-origin). The `js/` modules are intentionally split per the spec:

- `scene.js` — Three.js scene, camera, OrbitControls, grid, lights, render loop.
- `model.js` — FBX environment model loader; supports offset + Y-axis rotation.
- `device_data.js` — `DeviceDataStore` keyed by `friendly_name`, with one sub-object per category (e.g. `transform`, `anchor`). Implements `GetDeviceData(deviceName, category, fieldName)`, exposed on `window` per the spec.
- `requester.js` — periodic `GET /<db>/all` poller + collapsible response panel.
- `main.js` — wires the modules and the top-bar UI (Add Requester dialog, Set Environment Model).

Categories are merged on the same device entry, so `Headset_A` ends up with both `entry.transform` and `entry.anchor` populated as those requesters tick.

## Conventions

- Spec/README/code comments are mixed Traditional Chinese and English — match whatever the surrounding context uses.
- Keep `main.go` single-file unless there's a real reason to split; the spec explicitly calls out the single-file structure.
- When the server source changes, rebuild `Backend/DeviceInfoHub.exe` and commit it alongside the source (per README §檔案資訊).

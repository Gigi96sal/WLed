# Spatial engine architecture

Decision and source evidence: [RESEARCH.md](RESEARCH.md).

## Data ownership and flow

```text
local editor -> bounded HTTP JSON -> validate complete candidate -> pending snapshot
                                                               |
                         main-loop frame boundary <-------------+
                                    |
                     active geometry + effect + global time
                                    |
                    sparse sample -> contiguous RGB outputs
                                    |
                  WLED realtimeBroadcast -> UDP/DDP -> WLED slaves
```

`spatial_model` contains geometry, limits, effect registry, validation and rendering.
`spatial_json` owns the versioned interchange schema using bundled ArduinoJson.
`ledwall.cpp` adapts WLED lifecycle, asynchronous HTTP, persistence and DDP. The
editor is a self-contained, hand-authored flash asset in `web_ui.h`. It uses WLED's
existing `common.js`; no Internet/CDN is needed.

Effects know only coordinates, time and effect parameters. They do not know IPs,
GPIOs or controller identities. The adapter sends contiguous output ranges and
does not implement effect mathematics. There is no native WLED 2D matrix, virtual
bus or segment for this world. The master's own native LED effects remain separate.
Do not create native DDP buses targeting the same receivers at the same time.

Only the main loop renders and replaces the active layout. HTTP callbacks validate
complete candidates and enqueue at most one pending update; a short timed mutex
protects snapshot exchange and status. Shared WLED JSON access uses its own JSON
guard. Rendering does not wait for JSON, receiver acknowledgements or name lookup.
Allocation/configuration failure preserves the previous active layout. Rendering
uses a reusable RGB allocation and no heap allocation in its sampling loop.
The native UDP sender can allocate internally.

## Coordinates, output association and time

Coordinates are centimetres, X right, Y down, within the configured rectangle.
Each straight strip has first/last LED-centre endpoints. For N > 1, point i is
`start + (end - start) * i / (N - 1)`. A one-LED strip uses the first endpoint.
Reverse maps physical i to geometric N-1-i. Spatial overlaps are valid; overlapping
physical index intervals on one receiver are rejected.

Controller IDs and strip IDs are stable nonzero numbers. `controller`, `start` and
`count` identify a remote's concatenated WLED physical LED indices. GPIO selection
and colour order belong to the remote's normal WLED configuration. The frame
contains complete remote capacities in controller order, with gaps black, because
the native DDP sender always starts at destination offset zero.

The module accumulates elapsed milliseconds into a 64-bit animation clock and
samples one timestamp per frame. Late frames are skipped rather than accumulated
in a backlog. This provides coherent scene content, not simultaneous remote latch.

Rainbow uses directional phase as hue; wave modulates directional brightness;
ripple uses radial phase; noise uses a deterministic spatial hash with a temporal
sparkle pulse.
Speed is cycles/second, direction degrees, wavelength centimetres, centre in canvas
coordinates. Brightness is applied by the native sender. Module enable/brightness
are controlled in this editor independently of native master segments.

## Configuration and storage

[example-7m-3m.json](example-7m-3m.json) is a complete schema-1 snapshot. Unknown
versions are rejected. Controllers, strips, IDs, literal unicast IPv4 addresses,
numeric types, finite coordinates, physical intervals and resource limits are
validated before acceptance. The maximum is eight controllers, 32 strips and
4,096 configured output LEDs including gaps; this is a memory/input ceiling,
not a tested performance claim. The initial target remains two controllers at 30 FPS.

The adapter keeps persistent configuration separate from frame counters, elapsed
time, queued updates and send diagnostics. Explicit Save writes `/ledwall.json`
through a temporary file and backup; boot validates the primary and can recover
the previous valid backup. JSON corruption or I/O failure must not silently replace
a working scene. A save confirmation is tied to processed status, not HTTP acceptance.
Flash operations can interrupt frames; dragging edits local browser state and does
not write flash. File recovery does not claim power-loss immunity.

## API contract

`GET /json/ledwall` returns a configuration snapshot and runtime status.
`POST /json/ledwall` accepts `{ "config": <snapshot>, "persist": false }` for Apply,
or `persist: true` for Save. Optional `pin` follows WLED's settings PIN policy.
The endpoint uses existing configured PIN checks. HTTP 202 only acknowledges queueing;
poll status for application and persistence. A busy queue returns 409.

Numeric IPs avoid blocking DNS and need DHCP reservations or stable addresses.
Discovery combines main-loop-owned `Nodes` announcements and result-owned mDNS
queries. `RemoteNetwork` has its own bounded 16-device cache and a timed mutex.
Its 8 KiB-stack worker owns blocking HTTP/mDNS calls; the render loop only copies
configuration/announcements once per second. Round-robin probes prevent a dead
first device from starving later entries. HTTP connect/read/body waits and sizes
are bounded (600 ms connect, 1 s header/read, 1.5 s body, 16 KiB response body).
The worker uses a separate filtered 6 KiB JSON document, not WLED's shared pDoc.
Names/outputs/status are copied into fixed records before publication. HTTP targets
must be numeric unicast on a directly connected station/Ethernet or AP subnet,
excluding the master and network/broadcast addresses. Port and endpoint paths are
fixed; redirects are not followed. It is not a general HTTP proxy or subnet sweep.

`GET /json/ledwall/devices` returns read-only health/inventory records. The existing
master PIN gate protects it. POST `/json/ledwall` additionally accepts `action`:
`scan`, `probe` with `ip`, or `prepare` with `ip` and optional `receiverPin`.
These return 202 for queueing, independently of configuration revisions. No
network action runs under the shared JSON or config mutex. Prepare identifies
WLED first, applies only the realtime policy described in README, and reads config
back. Its PIN is transient and is cleared from the cache/worker command after use.

Online is HTTP API availability; DDP mode/source is receiver-reported state.
There is no delivery ACK: send counters report local UDP results. Each new full
frame repairs earlier loss when successfully delivered. Inventory reports configured
hardware outputs, not effect segments, wiring continuity or physical placement.
Disabled streaming releases receivers to their configured WLED realtime timeout
and fallback effect. Layout changes cannot atomically clear a removed/unreachable
receiver; its timeout policy remains authoritative.

## Extension points and validation

Add effects to the type/name registry and the sampler without changing transport.
Polyline geometry can replace endpoint interpolation using cumulative arc length;
schema evolution must explicitly migrate older straight strips. A dedicated ESP32
adapter can reuse the portable model/JSON modules if profiling justifies it.

Portable unit tests exercise production geometry, strict parsing/serialization,
effects and output scatter. Hardware/server stubs and the simulated localhost
controller server were removed at the user's request. Firmware compilation checks
Usermod integration; transport and stability are investigated on real boards using
[DIAGNOSTICS.md](DIAGNOSTICS.md) and the [hardware procedure](HARDWARE_TEST.md).

Diagnostic status is available through both the module snapshot and native
`addToJsonInfo`, including native USB informational JSON. Worker phase/heartbeat
and stack watermarks are atomics; per-destination send counters reset when a new
layout is applied. The debug environment emits rate-limited serial summaries.
Browser polls are serialized, stop in hidden tabs, and include body transfer in
their timeout. The factory state is empty, not an implicit list of sample boards.

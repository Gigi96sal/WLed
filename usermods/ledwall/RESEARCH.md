# Distributed spatial LED wall: technical investigation

Research date: 2026-10-31. Source baseline: WLED `17.0.0-devV5`, fork commit
[`bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3`](https://github.com/Gigi96sal/WLed/commit/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3).
The fork includes a Cinema subsystem; this module does not change it.
Implementation assistance: AI-generated code is marked in its source files.

## Verified WLED behaviour

| Topic | Source evidence and consequence |
| --- | --- |
| DDP output | [`udp.cpp:755`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/udp.cpp#L755) implements `realtimeBroadcast()`. DDP uses UDP port 4048, a 10-byte header, up to 1,440 payload bytes, byte offsets and PUSH on the last packet. RGB therefore fits 480 LEDs per packet. The sender scales brightness. |
| Destination offsets | The sender starts each destination at byte zero (`udp.cpp:768`). Build one complete RGB buffer per controller; unassigned LED ranges are black. A strip start is the remote's global LED index, across its physical buses. |
| Sender cost | `realtimeBroadcast()` constructs a local `WiFiUDP` and writes bytes through the native implementation. The renderer can avoid frame allocations; the existing transport is not claimed allocation-free. |
| Sequence handling | Native output shares a sequence across outputs and includes zero, which means unused (`udp.cpp:751-796`). This is limited packet ordering support, not reliable delivery. |
| DDP receive | [`e131.cpp:25`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/e131.cpp#L25) rejects query/control/status packets, performs basic ordering checks, ignores timecodes and requests display on PUSH. Sending successfully does not prove a receiver is present. |
| Physical display | [`udp.cpp:475`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/udp.cpp#L475) displays received updates after more than 15 ms since the previous show. Standard receivers do not implement a shared scheduled latch time. |
| Virtual LEDs | [`BusNetwork`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/bus_manager.cpp#L704) allocates RGB/RGBW buffers and delegates to the same sender. The [official Virtual LEDs guide](https://kno.wled.ge/advanced/ddp/) describes master-to-standard-WLED operation. |
| UDP synchronization | [`udp.cpp:20`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/udp.cpp#L20) sends effect/colour/palette/segment parameters and timing, rather than an arbitrary colour for every world-space LED. [UDP sync documentation](https://kno.wled.ge/interfaces/udp-notifier/) corroborates this distinction. |
| Native 2D constraints | [`FX_2Dfcn.cpp:38`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/FX_2Dfcn.cpp#L38) rejects axes above 255 and area above `MAX_LEDS`. Classic ESP32 uses 16,384; some RISC-V targets use 4,096 ([`const.h:567`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/const.h#L567)). A 700 x 300 cm world is independent of this matrix. |
| Mapping/buffers | Native 2D maps allocate entries for rectangular logical area (`FX_2Dfcn.cpp:55-63`), while [`FX_fcn.cpp:1435`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/FX_fcn.cpp#L1435) and [`FX.h:624`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/FX.h#L624) show global and per-segment pixel storage. A dense world map is unnecessary here. |
| Usermod lifecycle | [`fcn_declare.h:361`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/fcn_declare.h#L361) defines hooks and registration. Setup precedes web-server initialization; the main-loop usermod runs before `strip.service()` ([`wled.cpp:106`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/wled.cpp#L106)). Direct writes to native pixels in usermod loop would be overwritten. |
| Custom native effects | [`user_fx.cpp:1602`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/usermods/user_fx/user_fx.cpp#L1602) uses `strip.addEffect()`. `handleOverlayDraw()` is another supported hook before bus painting (`FX_fcn.cpp:1881-1921`). Neither is needed when sending independent buffers directly. |
| HTTP concurrency | [`JSONBufferGuard`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/fcn_declare.h#L557) protects the shared document, not layout arrays. Stage validated snapshots and hand them to the main loop with a bounded mutex wait. |

The [official DDP page](https://kno.wled.ge/interfaces/ddp/) explicitly confirms ignored
timecodes. The linked 3waylabs specification was unavailable during investigation;
packet claims above were verified in WLED source, not attributed to an unread spec.

## Architecture comparison and decision

| Approach | Complexity and maintenance | Memory/performance | Integration/reliability |
| --- | --- | --- | --- |
| A: WLED native custom effect + virtual DDP buses | Existing effect and bus APIs; sparse geometry must be fitted to native indices and settings | Native segment, global pixel and bus buffers; regular matrix limits | Strong standard integration, but ownership and geometry are coupled to native render state |
| B: Dedicated ESP32 master | Small conceptual core, but another provisioning, HTTP, OTA, recovery and storage implementation | Lowest potential baseline; most scheduling control | Standard WLED receivers remain possible; substantially more infrastructure to maintain |
| C: WLED usermod + portable sparse engine + native DDP sender | Small adapter, no new core hooks, no new third-party dependency | Only 3 bytes per configured remote LED for frame data, plus fixed config and WLED baseline | Reuses network, web server, OTA and DDP. Own geometry is isolated from WLED segments. Inherits native sender and scheduler limitations |

**Choose C for the MVP.** It gives arbitrary spatial layout without forcing a full
matrix or duplicating WLED infrastructure. The portable core can be reused by B if
measured heap, timing or transport contention warrants that work. This decision
does not establish that 30 FPS is achieved on physical hardware.

[LedFx](https://github.com/LedFx/LedFx) offers a network effect engine and layout UI
but runs on an external computer with Python; its GPL-3.0 project is a useful
comparison, not an ESP32 runtime. [Hyperion](https://github.com/hyperion-project/hyperion.ng)
provides image/LED sampling and a web UI under MIT, but relies on host infrastructure
including Qt/Python. Neither satisfies the autonomous ESP32 requirement unchanged.
No source from either project was copied. Reuse is concentrated on existing WLED
infrastructure and its bundled ArduinoJson, preserving their existing licences.

## Sizing and performance budget

The 7 x 3 m world uses **700 x 300 centimetres**. A nominal 30 LED/m perimeter
uses 600 LEDs: 210 + 90 + 210 + 90, divided between two 300-LED controllers.
This represents perimeter lighting, not a filled LED video wall. The number and
geometry of installed strips remain freely configurable. Endpoints denote LED
centres; adjust them to actual measured placement and pitch.

A 700 x 300 RGB framebuffer would cost 630,000 bytes. The default sparse frame
costs 1,800 bytes; the 4,096-output limit costs 12,288 bytes. These numbers exclude
WLED, Wi-Fi, JSON, configuration snapshots, stacks and allocator overhead. The
[ESP32 memory model](https://developer.espressif.com/blog/esp32-programmers-memory-model/)
explains why advertised SRAM is not equivalent to free heap.

At 30 FPS, 600 LEDs split 300+300 send 60 UDP datagrams/s and 54,000 RGB bytes/s.
Adding DDP and IPv4/UDP headers yields about 450 kbit/s, before Wi-Fi framing,
acknowledgements/retries and management traffic. 1,000 LEDs split 500+500 need
120 datagrams/s and about 756 kbit/s by the same calculation. These are budgets,
not measurements. Every destination uses one scene timestamp, but packets and
physical outputs are sequential and do not form an atomic distributed frame.

Nominal 800 kbit/s WS2812 RGB signalling costs about 30 microseconds per LED plus
latch time: 300 LEDs ~9 ms, 500 ~15 ms, 1,000 ~30 ms. Check the actual LED revision
and driver; see [FastLED chipset timing definitions](https://github.com/FastLED/FastLED/blob/master/src/fl/chipsets/led_timing.h).
Multiple physical outputs can reduce chain duration. Neither link bandwidth nor
these timings prove end-to-end frame rate under simultaneous web activity.

Classic ESP32 without PSRAM is the first build target. S3 with PSRAM offers more
capacity/headroom, but hardware throughput must be measured rather than inferred
from RAM size. Stateful raster effects (blur, particles interacting with neighbours,
image processing) need a separate low-resolution working grid or another model;
the initial four effects are stateless spatial functions.

## Router-free topology

WLED calls `WiFi.softAP()` without overriding the default station limit
([`wled.cpp:734`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/wled.cpp#L734)).
The [Arduino API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/wifi.html#softap)
defaults to four stations: two receivers plus one editor client fit. The current
[IDF v5.5.4 driver guide](https://docs.espressif.com/projects/esp-idf/en/v5.5.4/esp32/api-guides/wifi.html#ap-basic-configuration)
has a higher conditional ceiling, which is not WLED's configured capacity or a
performance guarantee. Start with a shared LAN AP for expansion, DHCP reservations
and no client isolation. SoftAP on the master is an offline small-installation option;
set receiver addresses to that subnet. `noWifiSleep` is a measurement variable
already exposed by WLED (`wled.cpp:887`).

## Receiver discovery and inventory follow-up (2026-11-01)

The [official JSON API reference](https://kno.wled.ge/interfaces/json-api/) lists
`/json/nodes`, `/json/si` and `/json/cfg`. This fork already serializes native node
announcements in [`json.cpp:1092`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/json.cpp#L1092)
and advertises `_wled._tcp` on port 80 in [`wled.cpp:942`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/wled.cpp#L942).
The module now merges these two discovery sources and independently checks the
WLED API from the master. Bounded cache/probe latency and multicast filtering mean
this is best-effort discovery, not exhaustive subnet enumeration.

Per-output start, length, bus type and reversal are serialized from the actual
configured `BusManager` objects in [`cfg.cpp:1175`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/cfg.cpp#L1175).
That makes importing standard-slave output counts possible without new firmware.
The architectural inference is limited: configuration does not establish wiring
continuity, distinguish multiple physical strips daisy-chained on one output, or
locate strips on the wall. The receiver's reported live mode/source is exposed by
[`json.cpp:772`](https://github.com/Gigi96sal/WLed/blob/bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3/wled00/json.cpp#L772).
It is useful DDP diagnostics, not a per-frame delivery or physical-light measurement.

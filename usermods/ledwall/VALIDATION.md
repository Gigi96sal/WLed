# Validation record

## Real-board connectivity investigation and removal of hardware stubs: 2026-11-01

Current rig: master .82 (USB COM8), slave .78 (110 LEDs), slave .81 (181 LEDs).
During the reported fault, .82 stopped answering HTTP and its PC ARP entry was
incomplete. USB remained responsive to native WLED version and informational JSON
requests. In the two-minute `original-usb-network` capture, 13 USB info samples
showed uptime increasing from 753 to 877 seconds, heap roughly 86-90 KiB and RSSI
roughly -52 to -56 dBm; 29 HTTP requests timed out. No restart occurred within
that sampled interval. .81 intermittently reported DDP from .82, while .78 did not.
Earlier local-send failures were close to one per frame; the original aggregate
counters could not identify the failing output. These observations do not yet
establish a Wi-Fi driver, AP, power-saving, socket-resource or electrical cause.

Raw serial/HTTP evidence and a successfully read layout backup are under the
ignored `.pio/ledwall-diagnostics/` directory. The collector is now
`tools/ledwall_diagnostics.py`; it queries actual devices and optionally records
USB, including native read-only informational JSON. It substitutes no device data.

At the user's request the localhost simulated-controller server, ESP32/filesystem
adapter harness/runner, fake UDP boundary test and DOM replacement test were
removed. New firmware/browser defaults contain no sample controllers or strips.
The optional JSON perimeter example and portable geometry/JSON unit tests remain.
Historical records below describe earlier tests that no longer exist.

Added real per-destination send counters, reset/heap/Wi-Fi addressing and sleep
state, main-loop and network-worker heartbeats/stack watermarks, and USB-visible
`info.ledwall` diagnostics. The debug environment adds rate-limited WLED summaries
and native Arduino socket error logging. No watchdog, forced reconnect or Wi-Fi
sleep policy was changed as a speculative fix. The browser now polls sequentially
every five seconds, stops background-tab polling and includes response body transfer
in request deadlines. This bounds editor requests; its effect on the real fault
must be measured with the diagnostic build.

`npm ci`, `npm run build`, all 47 Node tests (8 suites), and the portable C++ runner
passed. `tools/ledwall_diagnostics.py` was exercised on all three actual boards and
COM8; its successful USB and failed/successful HTTP paths were observed directly.
All final builds passed: standard ESP32 (95,200 bytes static RAM / 1,375,327 bytes
flash), LED Wall (99,752 / 1,430,251) and diagnostic LED Wall (99,848 / 1,502,023).
The first diagnostic flag attempt used unsupported PlatformIO `-U` token handling;
the override now removes the inherited macro with `build_unflags` and builds cleanly.
The diagnostic image was subsequently uploaded to the actual master on COM8 at
57600 baud. All written regions passed esptool hash verification; the filesystem
was retained. Recovery followed a wrong-boot-mode error, a Windows progress-output
encoding error and a failed bootloader hash check. External GPIO/strip connections
were removed, manual BOOT/EN entry was repeated and UTF-8 output was enabled for the
successful attempt. Those simultaneous changes do not establish why the earlier
verification failed.

The installed master reports `ledwall-diag-20261101-1`. Its real runtime layout was
restored from the captured snapshot: two controllers, three strips and 291 LEDs,
revision 3 / saved revision 2. The restore was runtime-only; a reboot requires
restoring it again unless the user saves the current layout first.

The five-minute `debug-usb-only` capture contains 73 successful master HTTP reads
and no HTTP errors. After layout activation, output counters reached 7,417 frames
with zero local send errors. The later three-minute `debug-both-slaves` capture
contains 45 successful master HTTP reads and no HTTP errors or resets. At its end,
both slaves reported live DDP with source .82. Four local UDP send failures occurred
in this later interval: `NetworkUDP::endPacket()` logged errno 12 (`ENOMEM`) at
uptime about 806.7 seconds. Sending recovered; each output counter increased from
13 to 15 errors while its attempt count increased from about 16,304 to 21,588.
The largest block remained 98,304 bytes at the sampled HTTP status points. This
transient send failure does not establish the cause of the original LAN outage.

A separate real receiver configuration fault was found on .78: ordinary WLED
Sync used UDP port 4048, colliding with DDP. WLED binds the notifier before the DDP
listener in `wled00/wled.cpp`. The relevant receiver settings were backed up,
`if.sync.port0` was changed to 21324 and the slave was restarted. Its read-back
then reported port 21324 and live DDP from .82. No slave firmware was uploaded.
This receiver fault is separate from the master's unexplained disconnection.

The actual embedded `/ledwall` page was loaded from .82. Discovery/refresh,
selection of existing strips and Reload completed without captured browser console
errors. Both controllers appeared online with their real inventories (181 LEDs /
two outputs on .81; 110 LEDs / one output on .78). Physical lighting still requires
the user's observation; .81 reports its ordinary power state off and nonbaseline
realtime settings. The master remained USB-only throughout these tests. A fresh
firmware boot, diagnostic code, browser request changes and disconnected external
wiring prevent attributing its current stability to one change. The procedure and
remaining comparison are in [DIAGNOSTICS.md](DIAGNOSTICS.md).

The final three-minute `debug-real-editor` capture covered those live editor
actions and closing the agent's test tab. It contains another 45 successful master
HTTP reads, no HTTP errors, no resets and no new local send errors (30 throughout).
Frames increased from 25,761 to 31,046. Sampled heap was 107,256-109,520 bytes,
largest block 98,304 bytes and network-worker minimum free stack 4,848 bytes.
Both slaves still reported DDP from .82 at the end, master uptime 1,269 seconds.
The collector completed normally and closed COM8. No physical-wiring comparison
or confirmation of visible strip output has yet been supplied by the user.

## Discovery routing correction: live diagnosis on 2026-11-01

Read-only HTTP checks against the user's master `192.168.1.79` and slave
`192.168.1.78` established the following:

- The master's `/json/nodes` already listed the slave, age 0. The slave's
  `/json/nodes` also listed the master. Native node announcements therefore worked
  in both directions at the time of the successful observations.
- The slave's `/json/si` and `/json/cfg` reported one WS2812 RGB hardware output,
  start 0, length 110, on GPIO 12. The master reported 30 local LEDs.
- The master's `/json/ledwall/devices` returned the wall's `config`/`status` snapshot
  instead of `available`/`devices`. Its installed AsyncWebServer callback matcher
  accepts child URLs via `startsWith(_uri + "/")`, so the earlier snapshot handler
  consumed the devices request. This is a reproduced routing error, independent
  of whether mDNS additionally finds a device.
- The stored wall already contained the slave and the master as controllers.
  Wall output was disabled, revision/savedRevision 9, frames 0. Some HTTP requests
  timed out and later requests succeeded; no separate cause for those transient
  timeouts has been established.

The three module GET routes now apply exact-path filters. The adapter regression
test extracts the actual installed library's callback URL matcher, registers the
production module routes and dispatches real GET paths through them. It failed
with the original code (devices request yielded config) and passed with the filters.
It also checks the snapshot path, unexpected nested paths and settings-PIN gating.
The network worker remains a stub in this host route test.

The discovery UI now includes configured receivers with a disabled **Already in
wall** button, alongside candidates that can be added. Previously it hid configured
receivers, which could make a successful scan appear empty. The production-JS
regression covers configured, new and offline devices together. `npm test` passed
48 tests in 8 suites, and both C++ runners passed. The real embedded page was also
loaded against the labelled localhost fixture to check the changed list.
Final firmware builds passed for both `esp32dev` and `ledwall_esp32dev`. The
corrected LED Wall image reports 99,632 bytes static RAM and 1,427,603 bytes flash
(90.8% of its application partition). Only the existing DMX/LTO warnings appeared.

No live device was flashed, restarted, or reconfigured during this diagnosis.
The corrected response/worker health must still be checked on the master after
uploading the rebuilt firmware; read-only observations above describe the installed
firmware that exhibited the bug.

## Receiver diagnostics follow-up: 2026-11-01

Implemented native-node/mDNS discovery, independent HTTP health checks, configured
hardware-output inventory/import, receiver preparation and explicit wall start/stop.
No physical ESP32 was flashed or tested. The original reported lighting failure
was not reproduced on real hardware; ordinary Sync, disabled wall output and
receiver realtime addressing/override are now distinguished in the interface.

- `npm ci`, `npm run build`, and `npm test`: 47 tests passed in 8 suites, including
  7 new production-JS import/diagnostic cases (28 LED Wall editor cases total).
- `python tools/run_ledwall_tests.py`: geometry, strict JSON, native DDP routing,
  and remote inventory/health cases passed. The actual filtered HTTP JSON decoder
  is extracted for tests of valid responses, trailing bytes/NUL, filtered configuration
  and receiver-preparation acknowledgements. Truncated, overlapping, virtual,
  malformed and oversized output inventories are rejected or non-importable.
- `python tools/run_ledwall_adapter_tests.py`: production adapter/storage cases
  passed, including PIN gating and network-action dispatch. The background network
  worker is a stub in this adapter suite; it is not a simulated Wi-Fi timing test.
- `pio run -e esp32dev`: succeeded, RAM 95,200 bytes, flash 1,375,327 bytes.
- `pio run -e ledwall_esp32dev`: succeeded, RAM 99,632 bytes, flash 1,426,963 bytes
  (90.7% of application partition). The worker additionally allocates an 8 KiB
  task stack and bounded HTTP/JSON storage at runtime; static RAM is not total use.
- Real embedded editor served by the labelled localhost fixture: online/offline
  display, discovered-controller addition, two-output import with a physical gap,
  live-override warning/preparation, explicit Start wall and revision-confirmed Save
  were exercised. No browser JavaScript errors were reported. Fixture status/data
  are simulated and do not establish DDP or discovery behaviour on real radios.

The first new build exposed a Windows header-name collision with Arduino's
`Network.h`; module files now use `remote_network.h/.cpp`. One subsequent image
generation failed with a missing Python `esptool` import; it was available again
on inspection and both final builds succeeded. No toolchain/package configuration
change was needed. Existing third-party DMX/LTO warnings and the lockfile's two
moderate npm audit findings remain.

Real-device acceptance remains open for multicast/node discovery, remote HTTP/PIN
compatibility, actual DDP reception and physical light, disconnect/reconnect
latency, heap/jitter under probes and OTA. See [HARDWARE_TEST.md](HARDWARE_TEST.md).

## Initial implementation

Date: 2026-10-31. Base commit: `bf180c35db01a1aa2baeb631ef6d9bc0268e2ab3`.
Branch: `ledWall`, tracking `fork/ledWall` (`Gigi96sal/WLed`).
This record describes software verification; no ESP32 was flashed or physically tested.

## Executed successfully

| Check | Result |
| --- | --- |
| `npm ci` and `npm run build` | Dependencies installed; native web assets built/confirmed current |
| `npm test` | All 40 tests passed, including 21 new embedded-editor checks |
| `python tools/run_ledwall_tests.py` | Production C++ geometry, reverse/single/diagonal mapping, RGB scatter/gaps, effect invariants and determinism, strict JSON validation/round-trip/rejected-update preservation, maximum resource limits |
| Native DDP case in the same runner | Actual `realtimeBroadcast()` code and protocol constants extracted from this checkout; captured destination/port, RGB payload, offsets, 480-LED chunk boundary, last-packet PUSH, brightness and local send failures |
| `python tools/run_ledwall_adapter_tests.py` | Actual storage and adapter logic with host boundaries: corrupted/truncated/trailing/oversized files, backup recovery, short writes, rename/remove failures, allocation/JSON-lock failures, body fragments, PIN policy, pending/applied/saved revisions, RGB routing and OTA pause |
| `node --test tools/ledwall-ui-test.js` | Actual embedded scripts compile; control IDs, example snapshots, four effects, invalid inputs and preview temporal direction checked |
| `pio run -e esp32dev` | Standard firmware compiled successfully |
| `pio run -e ledwall_esp32dev` | New Usermod compiled and linked successfully; post-link module validation identifies `ledwall` |

Firmware compilation used PlatformIO 6.2.0, Tasmota platform 2026.5.50,
Arduino ESP32 3.3.8 and the existing Xtensa GCC 15.2.0 toolchain. Node was 22.17.0;
host C++ tests used installed Visual Studio Build Tools through existing compiler
discovery. No new runtime package was added.

The successful custom image reports static RAM **95,672 / 327,680 bytes** and flash
**1,389,675 / 1,572,864 bytes**. The standard build reports 95,200 and 1,375,327
bytes respectively. These are link-time sizes, not free heap under Wi-Fi load,
and the custom environment selects `ledwall` in place of the default usermods;
their difference must not be presented as the isolated cost of this module.
The custom binary is `.pio/build/ledwall_esp32dev/firmware.bin`.

Two integration failures were corrected before the successful build: a native
`MAX_LEDS` macro collision (the module now uses `MAX_OUTPUT_LEDS`) and the bundled
ArduinoJson ABI option (Unicode decoding now matches WLED in all module units).
Build output also includes inherited Arduino/GIF shadow warnings, DMX dependency
string-bound warnings and serial LTO notices; no new-module diagnostic remains.
`npm ci` reports two moderate dependency audit findings in the existing lockfile;
dependency upgrades were outside this change.

## Browser checks executed

The actual embedded page was served by `tools/preview_ledwall.py` with its visible
**no hardware / no DDP / no persistent saves** banner. The endpoint is a test
fixture, not evidence of physical controller operation.

- Initial 7 x 3 m, 600-LED layout loaded.
- Keyboard coordinate changes, reversal, effect selection and endpoint dragging
  updated the layout. A diagonal strip confirmed free angle/length adjustment.
- Controller and strip addition/removal worked and updated counts/associations.
- Apply and Save completed through revision confirmation; reload retained the
  fixture's in-memory snapshot. Firmware persistence was tested separately above.
- A smartphone viewport produced no horizontal overflow (375 px viewport and
  document width); the canvas remained within the viewport.
- No JavaScript error or warning was captured during these interactions.

## Not verified on hardware

Stable 30 FPS, real Wi-Fi loss/jitter, physical output/colour order/current limiting,
cross-controller display skew, simultaneous radio/editor load, runtime heap
low-water/largest-block behaviour, reboot/fallback and real flash power-loss
recovery remain to be measured using [HARDWARE_TEST.md](HARDWARE_TEST.md).
S3 and other targets have not been compiled for this change. No performance or
physical synchronization guarantee is inferred from passing host tests.

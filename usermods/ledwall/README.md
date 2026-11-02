# LED Wall: autonomous sparse spatial RGB engine

This ESP32 WLED Usermod renders one shared 2D scene across multiple standard-WLED
receivers. It calculates colours only at installed LED positions and sends full
RGB frames through WLED's native DDP sender. The browser configures the layout;
the master continues running when the browser is closed.

The optional example is a **7 x 3 metre perimeter, 600 LEDs at nominal 30 LED/m**:
two horizontal 210-LED strips and two vertical 90-LED strips, across two remotes
with 300 LEDs each. The canvas is 700 x 300 cm, independent of LED count. This is
perimeter illumination; a filled video wall needs a separate coverage/pitch design.
Everything in this example is editable. A new master starts **empty and disabled**;
discover/configure real receivers or explicitly import the example JSON.

Read [research and alternatives](RESEARCH.md), [architecture](ARCHITECTURE.md) and
the [hardware validation procedure](HARDWARE_TEST.md). AI assistance is declared
throughout the source; human review remains required before deployment.

## Build and install

From the repository root, with Node 20+, Python and PlatformIO installed:

```sh
npm ci
npm run build
```

Copy the environment from [platformio_override.ini.sample](platformio_override.ini.sample)
into the root's ignored `platformio_override.ini`. If that file already exists,
append the environment rather than replacing personal settings. Then build:

```sh
pio run -e ledwall_esp32dev
pio run -e ledwall_esp32dev --target upload
```

Only upload after selecting and reviewing the intended ESP32 master and serial
port. The module is compiled only into this custom environment; it does not modify
root `platformio.ini`, native effects or the existing Cinema subsystem. The master
does not need local physical LEDs. Keep its ordinary LED configuration small and
do not configure native network buses that compete for these receivers.

On Windows, if `pio` is absent from PATH, use the existing executable under
`%USERPROFILE%\.platformio\penv\Scripts\pio.exe`. The real initial build target is
classic `esp32dev`; other ESP32 boards need their appropriate environment and
separate compilation/validation. ESP8266 master operation is unsupported.

## Configure standard-WLED receivers

1. Install standard WLED on each remote and connect all devices to the same local
   network. Internet is unnecessary. Use DHCP reservations, for example
   `192.168.1.51` and `192.168.1.52`; replace example addresses with your subnet.
2. In each remote's LED Preferences, configure actual GPIO outputs, LED counts,
   colour order and current limits. The example needs 300 global LED indices per
   remote, such as outputs of 210 and 90 LEDs. This module sends RGB; use compatible
   RGB strips such as WS2812B.
3. In Sync Interfaces, enable realtime reception and DDP (UDP port 4048). Leave
   **Skip out-of-sequence packets disabled** (`seqskip: false`). Native sender
   sequence numbering is shared across destinations; that optional receiver
   heuristic can discard valid chunks as the installation grows.
   Keep the ordinary WLED **Sync UDP port** at 21324 (or another non-conflicting
   port). Setting it to 4048 occupies the DDP listener's port and prevents DDP
   reception. After correcting such a conflict, save and restart that receiver.
4. Use realtime offset zero and disable **Use main segment only** for direct global
   LED-index addressing. Avoid reversed/grouped segment transformations for this
   baseline. Set a known native fallback effect and a finite realtime timeout.
5. Decide the receiver realtime brightness policy explicitly. The master already
   scales RGB by the editor brightness. To avoid additional master/receiver dimming,
   use the receiver's maximum realtime-brightness option when appropriate; its
   current limiter and physical output configuration still apply. Verify brightness
   and colour order with a small strip before connecting the whole installation.
6. Permit device-to-device traffic on the LAN; Wi-Fi client isolation prevents DDP.

The native sender starts each destination at LED zero, so configured remote
capacity must match the intended global range. Unassigned indices are sent black.
The editor reports count mismatches and can import the receiver's hardware output inventory.

For a router-free small installation, keep the master's WLED AP active, join both
receivers and the phone to it, and use that subnet's stable receiver addresses.
WLED's default AP capacity is four stations, including the editor phone. Validate
AP addressing and performance separately; use an external AP for expansion.

## Use the editor

Open `http://<master-address>/ledwall`. Unlock with the existing WLED settings PIN
if configured. Add controllers and strips, assign physical start/count ranges,
then drag strips or their endpoint handles. Numeric controls provide the same
position/rotation/length operations. Reverse changes LED order along the geometry.

### Discover and check receivers

**Discover / refresh** merges native WLED node announcements with an mDNS `_wled._tcp`
query. The master caches up to 16 devices and checks their WLED HTTP APIs in a
background FreeRTOS task. No browser-to-slave HTTP requests or CORS exceptions are
needed. Configured receivers are normally polled every 10 seconds, other candidates
every 30 seconds; several unresponsive devices can lengthen a round. Unknown means
no completed check, offline means the WLED API did not answer successfully, and
stale means the last successful check is older than 30 seconds. These labels are
independent of local UDP-send success. Checks continue with the browser closed.

Discovery is limited to the directly connected IPv4 subnet(s), HTTP port 80, and
devices advertising their presence. Node discovery must be enabled in WLED for
native announcements; mDNS is a complementary path. Broadcast/multicast filtering,
AP isolation, devices without announcements, and unsupported/custom HTTP ports can
prevent discovery. **Check IP** queries an explicit numeric local address. The
discovery list is bounded, not a guarantee of finding every network device.
Configured receivers remain visible with **Already in wall**; only new receivers
offer **Add with outputs**. If discovery appears broken, `/json/ledwall/devices`
must return `devices`, not the wall's `config` snapshot. The route-filter correction
requires rebuilding/uploading the master firmware.

**Add with outputs** creates a controller and one spatial strip per configured
hardware output. **Import outputs** updates an existing controller; matching
start/count ranges retain their geometry, while obsolete ranges are replaced and
new ranges get provisional horizontal placement. Review the layout before Apply.
Output starts, lengths and gaps come from `hw.led.ins` in `/json/cfg`; total LEDs
and realtime state come from `/json/si`. Effect segments are not physical strips.
Hardware bus reversal remains on the receiver and is not applied twice by import.
The importer refuses truncated (>16 outputs), overlapping, unsupported/virtual
bus layouts, or layouts exceeding the wall's 8-controller/32-strip/4,096-LED limits.

No slave firmware change is required for standard WLED JSON APIs. A controller
knows only its configured hardware: it cannot measure how many strips are wired in
series on one GPIO, detect a disconnected strip, or determine physical wall positions.
Old/custom firmware or a protected/unavailable config API may require manual counts.

### Start wall output and diagnose reception

The ordinary **Sync** toggle transfers WLED state/effect settings; wall output is
an independent RGB DDP stream. **Start wall** applies the current draft and enables
that stream. **Stop wall** applies a disabled draft; use Save to persist that state.
Apply/Save retain the explicit enable setting and display when DDP remains OFF.
The browser animation is always only an illustrative preview.

Each receiver card shows HTTP health, LED count mismatches, live override, addressing
warnings and the receiver's reported realtime protocol/source IP. A report of
**DDP from this master** confirms the receiver's reported mode/source, not which
effect colours physically appeared, nor any per-frame acknowledgement.

**Prepare receiver** is an explicit write action, separate from discovery/import.
It first identifies WLED via `/json/si`, then POSTs a partial `/json/cfg` setting
realtime enabled, main-segment-only off, respect-LED-maps off, realtime offset 0,
DMX start address 1, sequence skipping off and maximum realtime brightness on.
It also POSTs `/json/state` with power on, live override 0 and ordinary Sync receive
off, to give wall streaming control. Existing LED GPIOs, counts and power limits
are not part of the request. Review realtime brightness/current limits first:
maximum realtime brightness avoids double dimming because wall RGB is already scaled.
Config changes are saved by WLED; the override/power/Sync state change is runtime.
Enter the receiver's own settings PIN in its card if required. It is used only in
RAM for that action, not saved or returned by the master. Errors are shown on the
card; a queued request is not a confirmation that preparation succeeded.

For the first physical check: discover/check the actual slave IP, import its
outputs, place at least one strip, Prepare receiver, choose nonzero wall brightness,
then Start wall. Watch its card for DDP reception. If there is no realtime reception,
check UDP 4048/client isolation and destination addressing. If DDP is reported but
LEDs remain dark, check receiver power/current limits, GPIO/type/wiring and competing
senders/playlists. A normal Sync effect working does not prove DDP delivery.

Choose Rainbow, Wave, Ripple or Noise; adjust speed, direction, wavelength, centre,
seed, brightness and target FPS. Enable DDP output when the receivers are ready.
**Apply** changes runtime state; **Save to master** also persists it. The page waits
for the corresponding processed revision. Import/Export works with complete JSON
snapshots; [example-7m-3m.json](example-7m-3m.json) is ready to customize.

The engine has its own enable/brightness controls in this page. Native WLED
segment power/effect controls on the master do not select this independent scene.
Disabling DDP lets receivers return to their configured fallback after timeout.
The preview is illustrative, not a measurement of the receiver's physical output.
Send errors indicate local transmission failures; successful UDP sends do not
confirm remote reception. The status includes frame work time and heap headroom.

Saved snapshots live in `/ledwall.json` with a previous valid `/ledwall.bak` and
temporary `/ledwall.tmp`. Do not edit these files while saving. Export JSON before
firmware/filesystem replacement. A failed Save can leave the newly applied runtime
scene running while the previous persistent scene remains available for reboot.

## Tests and real-device diagnostics

```sh
python tools/run_ledwall_tests.py
node --test tools/ledwall-ui-test.js
npm test
pio run -e esp32dev
pio run -e ledwall_esp32dev
```

The C++ runners compile production code with GCC, Clang or Visual Studio Build
Tools. They check portable geometry, effects and JSON parsing. They do not emulate
ESP32 boards or UDP delivery. Hardware/server stubs and the simulated localhost
controller server have been removed. Browser startup also has no sample controllers
and does not claim a live layout until it has read the actual master.

For real-board investigation, follow [DIAGNOSTICS.md](DIAGNOSTICS.md). The
`ledwall_esp32dev_debug` environment adds USB logs and per-destination send counters.
`tools/ledwall_diagnostics.py` collects real HTTP/USB data, including through a LAN
outage. Validation results and the limits of earlier historical tests are recorded
in [VALIDATION.md](VALIDATION.md).

## Known limitations and roadmap

- No hard simultaneous latch across receivers: standard WLED ignores DDP timecodes.
- No per-frame delivery ACK, automatic IP migration, frame replay or strict sequence
  fix. Discovery/import is explicit; use reservations and full-frame refresh.
- 30 FPS and 1,000+ LEDs are engineering targets pending hardware measurements.
  The 4,096-output software ceiling is not a proven Wi-Fi performance limit.
- Saves, OTA and other WLED work can interrupt rendering; OTA deliberately pauses
  streaming. Effects restart their phase after master reboot.
- Straight strips only. Polylines, measured timing instrumentation, receiver health
  profiling and a dedicated-master adapter are subsequent milestones.
- Stateless effects only. Neighbour-dependent raster effects need an additional
  low-resolution simulation model and an explicit RAM budget.

Next steps: complete the hardware acceptance record; profile 600/1,000/2,000 LED
layouts with concurrent editor use; optimize native UDP transport only if measured
costs justify it; then add polylines/schema migration.

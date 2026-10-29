# WLED Cinema Bring-up Guide

This guide covers firmware build and upload, wiring, WLED configuration, and
validation of the wired SPI link between:

- one ESP32 DOIT DevKit V1 running WLED as SPI master;
- one AI Thinker ESP32-CAM with OV2640 and 4 MB PSRAM as the left slave;
- one AI Thinker ESP32-CAM with OV2640 and 4 MB PSRAM as the right slave.

## RGB streaming

Both cameras capture JPEG continuously with two PSRAM framebuffers, decode a
160x120 image into 8-bit BGR for perimeter sampling, and send only RGB24 LED colors
across SPI. Photos use native 640x480 JPEG on request. This keeps the preview sharp
without paying the cost of decoding a VGA image for every LED update. WLED sends
geometry, configuration generation and separate sensor controls for each camera.
The target is at most 30 frames/second; actual capture/decode/SPI throughput must
be measured. See the [Espressif JPEG guidance](https://github.com/espressif/esp32-camera#important-to-remember).

**Update WLED and both cameras together.** Protocol major version 4 adds sensor
controls and bounded JPEG metadata/chunks; versions 1-3 are incompatible. Schema
6 stores camera controls as well as perspective corners. Schema 5 migrates with
neutral sensor controls and bounded automatic gain, preserving wiring/corners.
Schema 4 additionally receives identity corners. Older shared-MISO schemas load
disabled. No SPI wiring changes are required.

Each camera must see all four corners of its own screen half. Use perspective
calibration to mark those corners; the screen need not fill the sensor image and
the camera may be rotated or mirrored. This compensates for planar perspective,
not curved-screen geometry, lens distortion or automatic screen detection. Each LED averages a
3x3 pixel patch, centered 5% inward from the relevant outer screen edge. Top and
bottom samples account for each half's position in the full screen. On odd edges,
the center LED belongs to the right camera. The internal order is top left-to-right,
right top-to-bottom, bottom right-to-left, then left bottom-to-top; WLED applies
the configured strip origin and direction afterward.

Frames carry the actual sensor capture timestamp and reference a preceding
configuration poll. The master accepts only references from its current session
and the last 300 ms, checked after the SPI transfer finishes, allowing for capture
and the queued full-duplex response. The preceding poll for that camera must also
be within 150 ms, so a polling interruption cannot revive a pending old response.
The camera still rejects captures older than 150 ms before publication. Each
accepted frame is held for 150 ms from reception, then fades to black over 250 ms.
Capture/transport latency does not consume the display hold. The time-based fade
avoids black flashes when the next sensor frame is slightly late and affects only
the missing camera's portion. Heartbeats maintain link status while the sensor is
not producing valid RGB; check increasing frame counters too.

Use another WLED effect first to test the LED strip itself.

## Perspective calibration

1. Build and upload all three firmwares. Enable Cinema, configure the SPI pins and
	perimeter counts, and save. Both links should report connected.
2. Display a bright rectangle filling the TV with a vertical center line. Avoid
	black bars, overscan or a pattern that hides the actual screen boundary.
3. Open `Config` → `Cinema` → `Camera perspective calibration`. Select `Left half`
	and press `Load camera photo`. The snapshot takes a few seconds and is a color
	640x480 JPEG of the original sensor image, before any geometry correction.
	Acquisition briefly pauses that camera's LED updates; the other camera continues.
4. Drag TL, TR, BR, BL onto the **left half's** top-left, top-right, bottom-right
	and bottom-left screen corners. Its right-hand corners lie on the TV center line.
	The labels refer to screen orientation, not the top/bottom of the sensor image.
	Use numeric X/Y percentages for keyboard adjustment. `Rotate labels` and
	`Mirror labels` change the semantic corner order without moving the camera image.
5. Check the corrected half-screen preview. A rectangular test pattern should look
	rectangular. Crossing corners, concave/flat regions, extremely short edges and
	regions smaller than 1% of the sensor image are rejected.
6. Repeat for `Right half`; its left-hand corners lie on the center line. Each
	camera has its own quadrilateral, retained when switching between the two views.
7. Press `Save`. The firmware applies a projective homography when selecting LED
	samples from subsequent RGB frames, and stores the corners in WLED's configuration.
	The cameras receive the calibration automatically over SPI, including after reboot.
8. Reload the page to verify persistence, then test a bright patch moving around
	the outer screen edges. Recalibrate whenever either camera moves.

Photos use the same settings PIN policy as Cinema settings. One camera photo is
transferred at a time, in CRC-protected 1024-byte chunks with automatic retries.
RGB responses receive at least every other camera poll during photo transfer;
sensor frame rate and LED/network load still affect freshness. The camera holds
its immutable JPEG in PSRAM. Images are limited to 48 KiB; the camera retries with
stronger compression when needed. WLED allocates the declared image length after
validated metadata, copies bounded HTTP chunks, and releases it after 60 seconds. The browser retains
its downloaded photo locally; no photo is stored in flash or sent to an external service.
A failed or expired capture shows an error and can be retried. A controller or
camera reboot cannot combine parts of different snapshots.

## Sensor color setup

Select Left/Right in the calibration editor to adjust that camera independently.
Controls take effect after Save; reload the JPEG to see the result. The image is
sensor output: WLED's LED color boost/black threshold are not applied to the photo.

1. Start with brightness/contrast/saturation at 0 and maximum automatic gain at 4x.
2. Display white, then compare fixed Sunny/Cloudy/Office/Home white-balance presets.
   A fixed preset prevents an automatic white balance from adapting to a solid red
   or blue test screen. Choose the preset that keeps white neutral on your screen.
3. Check red, green and blue separately. Adjust exposure first if bright colors
   clip; increase saturation only after checking white balance and exposure.
4. Check black in the actual installation. Covered-lens noise need not be perfect
   digital black. Restrict gain/exposure as needed; use the LED black threshold
   for residual low-level colors without discarding useful dark screen content.

Auto exposure and gain may be disabled for manual values. Settings are range-checked
by the page, WLED and camera firmware. They use the same OV2640 controls as
[CameraWebServer](https://github.com/espressif/arduino-esp32/tree/master/libraries/ESP32/examples/Camera/CameraWebServer).
The decoder handles RGB/BGR ordering explicitly; arbitrary image effects are not
applied to the sampled colors.

ESP32-CAM-MB users can connect one isolated camera by USB and let PlatformIO reset
it automatically. The camera firmware has no Wi-Fi OTA; never connect its SPI bus
or an independent supply while programming it from USB. An initial serial JPEG
self-check reports the actual source dimensions and decoder time before SPI starts.

## Required hardware

- ESP32 DOIT DevKit V1, 30-pin version;
- two AI Thinker ESP32-CAM boards with OV2640 and at least 2 MB usable PSRAM;
- one USB data cable for the DevKit;
- one USB-to-UART adapter with 3.3 V logic levels for camera programming;
- a stable 5 V supply sized for both cameras and the intended load;
- two 10 kOhm pull-down resistors for camera GPIO12;
- two 10 kOhm pull-up resistors for camera GPIO15;
- six 22-47 ohm series resistors for SCLK, MOSI, two CS lines, and the two
  camera MISO outputs;
- signal cables with a ground conductor paired with each SPI signal;
- the LED strip and its correctly sized power supply if LED output is also tested.

Do not use a USB-to-UART adapter with 5 V logic on camera RX/TX. The ESP32 logic
level is 3.3 V. A weak adapter 5 V output may also be unable to supply the camera's
startup current; use the stable external 5 V supply in that case and join all
grounds.

## Software prerequisites

- Windows PowerShell;
- Node.js 20 or newer;
- repository dependencies installed with `npm ci`;
- PlatformIO installed in the standard user location used below.

Open PowerShell in the repository root and define the PlatformIO command:

```powershell
$pio = "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe"
Test-Path $pio
& $pio device list
```

`Test-Path` must print `True`. Record the COM port for each device. COM port names
in the examples are placeholders and must be replaced with the ports shown on the
test computer.

## 1. Build all firmware

Run these commands from the repository root before connecting the SPI wiring:

```powershell
npm ci
npm run build
& $pio run -e esp32dev
& $pio run -d cinema-camera -e camera_left
& $pio run -d cinema-camera -e camera_right
```

All three PlatformIO commands must finish with `SUCCESS`. The left and right
camera binaries contain different fixed roles; do not upload the same environment
to both boards.

Label the physical camera boards `LEFT` and `RIGHT` before flashing them.

## 2. Upload WLED to the DevKit

1. Leave both cameras and all SPI wires disconnected.
2. Connect only the ESP32 DOIT DevKit V1 to the computer using its USB data cable.
3. Find its port with `& $pio device list`.
4. Upload WLED, replacing `COM4` with the actual port:

```powershell
npm run build
& $pio run -e esp32dev -t upload --upload-port COM4
```

The DevKit normally enters the bootloader automatically. If upload remains at
`Connecting`, hold its `BOOT` button, briefly press `EN`, and release `BOOT` once
writing starts.

After the first boot, connect a phone or computer to the `WLED-AP` network using
password `wled1234`. Complete the captive-portal Wi-Fi setup, then record the WLED
IP address. The device can also normally be reached using its mDNS address shown
by WLED.

## 3. Upload the left camera

Program only one disconnected camera at a time. The camera must not be attached to
the SPI master while it is being flashed.

Connect the USB-to-UART adapter as follows:

| USB-to-UART | AI Thinker ESP32-CAM | Purpose |
|---|---|---|
| GND | GND | Common ground |
| TX | U0R / GPIO3 | Adapter transmit to camera receive |
| RX | U0T / GPIO1 | Adapter receive from camera transmit |
| 5 V supply | 5V | Camera power |
| GND jumper | GPIO0 | Bootloader mode, upload only |

If an external 5 V supply powers the camera, connect its ground to both the camera
and the USB-to-UART ground. Do not connect two independent 5 V sources together.

1. Connect GPIO0 to GND.
2. Power or reset the camera.
3. Start the left upload, replacing `COM7` with the adapter port:

```powershell
& $pio run -d cinema-camera -e camera_left -t upload --upload-port COM7
```

4. If upload remains at `Connecting`, press the camera `RST` button once while
	PlatformIO is trying to connect.
5. After upload succeeds, remove power.
6. Disconnect the GPIO0-to-GND jumper.
7. Restore power or press `RST` to boot the application.

Optional serial check:

```powershell
& $pio device monitor --port COM7 --baud 115200
```

Stop the monitor with `Ctrl+C`. Camera initialization happens before the Cinema
SPI slave is started, so a `Cinema camera initialization failed` message cannot be
caused by the WLED-to-camera SPI wiring. The updated firmware prints the specific
cause immediately before the generic message:

```text
Cinema camera: PSRAM unavailable (found=no, size=0 bytes)
```

or:

```text
Cinema camera: esp_camera_init failed: ESP_ERR_CAMERA_NOT_DETECTED (...)
```

The first case requires checking that the module really has PSRAM and that its 5 V
power is stable. The second case usually means that the OV2640 ribbon cable is
loose or reversed, the camera module is not an AI Thinker OV2640, or the camera
power/reset lines are not reaching the sensor. Reseat the ribbon cable with power
removed and verify the metal contacts face the connector contacts.

`Cinema SPI slave initialization failed` is a separate failure that occurs only
after the camera has initialized. No application error after the boot messages is
expected when both initialization steps succeed.

## 4. Upload the right camera

Repeat the complete camera upload procedure on the board labelled `RIGHT`, using
the right environment:

```powershell
& $pio run -d cinema-camera -e camera_right -t upload --upload-port COM7
```

Remove the GPIO0-to-GND jumper and reset the board after upload. Accidentally
flashing `camera_left` to both boards causes role validation to reject the right
camera even when the electrical wiring is correct.

## 5. Install camera strapping resistors

Install these resistors directly at each ESP32-CAM:

| Camera pin | Resistor | Destination | Reason |
|---|---:|---|---|
| GPIO12 | 10 kOhm | GND | Keeps the flash-voltage strap low during reset |
| GPIO15 | 10 kOhm | 3.3 V | Keeps CS inactive and the boot strap high |

The microSD socket cannot be used because Cinema reuses GPIO12, GPIO13, GPIO14,
and GPIO15. Do not insert or initialize a microSD card during Cinema operation.

## 6. Wire the SPI bus

Turn off the DevKit, both cameras, the LED supply, and all USB connections before
wiring. Never make or break SPI connections while the boards are powered.

| Signal | WLED DOIT master | Left ESP32-CAM | Right ESP32-CAM |
|---|---:|---:|---:|
| SCLK | GPIO18 | GPIO14 | GPIO14 |
| MOSI | GPIO23 | GPIO13 | GPIO13 |
| MISO Left | GPIO19 | GPIO12 | Not connected |
| MISO Right | GPIO21 | Not connected | GPIO12 |
| CS Left | GPIO5 | GPIO15 | Not connected |
| CS Right | GPIO17 | Not connected | GPIO15 |
| Ground | GND | GND | GND |

Only GPIO18 (SCLK) and GPIO23 (MOSI) are shared by both camera branches. GPIO5
connects only to the left camera CS, and GPIO17 connects only to the right camera
CS. Each camera GPIO12 has its own return wire to the master: left to GPIO19,
right to GPIO21. Never connect the two camera MISO outputs together.

ESP32 SPI slaves can drive MISO even with CS inactive; this limitation is documented
in [Espressif's SPI slave restrictions](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/spi_slave.html#restrictions-and-known-issues).
The master switches its SPI2 input through the GPIO matrix before each transaction,
while both CS lines are idle. This keeps the inactive camera electrically isolated
from the selected camera's return signal without an external buffer.

**Migration from shared-MISO wiring:** with power off, disconnect the right
camera GPIO12 from the shared GPIO19 wire and connect it only to master GPIO21.
Configuration schema 4 adds `cinema.spi.misor` for this separate right-camera
input. Older schemas load with Cinema disabled; verify the six GPIO settings,
then explicitly enable and save Cinema after rewiring.

Place the series resistors as follows:

- 22-47 ohm at the master output on SCLK;
- 22-47 ohm at the master output on MOSI;
- 22-47 ohm at the master output on each CS line;
- 22-47 ohm at each camera MISO output, on its own return wire.

GPIO5 is a master strapping pin. The left camera GPIO15 pull-up also holds this CS
line inactive-high during reset. Do not attach any other pull-down or peripheral
to GPIO5.

For 1-1.5 m runs, route each signal with a nearby ground return and keep branch
stubs as short as the installation permits. Start at 1 MHz. Long shared SPI buses
are sensitive to cable topology, grounding, and reflections even when the pin
mapping is correct.

## 7. Connect power and the LED strip

Power both cameras through their 5V pins from a stable supply. Do not power them
from the DevKit 3.3 V output. Connect the power-supply ground, both camera grounds,
the DevKit ground, and the LED-strip ground together.

Configure the LED strip separately in WLED under `Config > LED Preferences`. On a
standard `esp32dev` build, the initial LED data pin is GPIO16. Confirm the actual
installation does not use any Cinema pin: GPIO5, GPIO17, GPIO18, GPIO19, GPIO21, or GPIO23.
WLED PinManager refuses to start Cinema if another configured feature owns one of
these pins.

For normal operation, switch the complete system on together when possible. Avoid
leaving a camera or the master unpowered while another connected SPI node is
powered, because current can flow through GPIO protection paths. If the DevKit is
powered by USB during bench testing, power the cameras immediately before making
the WLED Cinema configuration active. Use reset, not removal of 5 V power, for the
controlled link-loss tests below.

## 8. Configure Cinema in WLED

1. Open the WLED web interface using its IP address.
2. Open `Config`, then select `Cinema`.
3. Enter the perimeter LED counts for `Top`, `Right`, `Bottom`, and `Left`.
4. Count every physical perimeter LED exactly once. The sum must equal the length
	of the WLED segment that will use the Cinema effect.
5. Select the physical corner containing LED 0 and the strip direction.
6. Enter the SPI settings:

| Setting | Initial test value |
|---|---:|
| Clock | 18 |
| MOSI | 23 |
| Left camera MISO | 19 |
| Right camera MISO | 21 |
| Left camera CS | 5 |
| Right camera CS | 17 |
| Clock frequency | 1000000 Hz |

7. Enable Cinema and select `Save`.
8. Confirm the page reports `SPI: Ready`.

The six GPIO values are prefilled on a fresh classic ESP32 configuration, but
verify every value before enabling Cinema. All pins must be distinct and available.

The WLED segment used by the Cinema effect must have grouping `1`, spacing `0`, and
a virtual length exactly equal to `Top + Right + Bottom + Left`.

## 9. Validate both camera links

The Cinema page refreshes link state once per second. Within a few seconds it must
show:

```text
SPI: Ready
Left camera: Connected, sequence <increasing value>, frames <increasing value>
Right camera: Connected, sequence <increasing value>, frames <increasing value>
```

Both sequence and frame counters must increase on each refresh. A connected
camera with a frozen or zero frame counter has a live SPI link but no usable RGB.
The JSON status also reports `ageMs` since the last accepted RGB frame and
`rgbMax`, its brightest received channel (0 means entirely black). An `ageMs`
value of 4294967295 means no RGB frame has been accepted in this session.
`requestAgeMs` reports the latest RGB response's configuration-poll age even when
it was rejected as stale; 4294967295 means no matching current-session poll.

The same data is available as JSON. Replace the address with the WLED IP:

```powershell
$cinemaUrl = "http://192.168.1.50/json/cinema"
Invoke-RestMethod $cinemaUrl | ConvertTo-Json -Depth 4
```

Run the `Invoke-RestMethod` command again after a few seconds and compare the two
sequence values.

A healthy result has `transport` equal to `1`, both `connected` fields set to
`true`, stable nonzero `boot` values, and increasing `sequence` values. The JSON
endpoint exposes aggregate SPI slot and transfer error counters; malformed packets
are rejected before they can update the connection sequence.

## 10. Run controlled fault tests

Run these tests at 1 MHz before increasing the bus speed:

1. Press and hold the left camera `RST` button for more than one second. WLED must
	report the left camera disconnected while the right remains connected.
2. Release `RST`. The left camera must reconnect with a new boot ID.
3. Repeat the held-reset test with the right camera.
4. Briefly reset either camera. WLED must accept the new boot ID and resume
	increasing its sequence without rebooting the master.
5. Leave both cameras running for at least ten minutes. Neither sequence should
	stall and neither link should repeatedly disconnect.
6. Display solid red, green, blue, white, and black screen patterns. The Cinema
	LEDs should follow each color; black must settle fully dark. Allow the sensor's
	automatic exposure/white balance to settle. These tests verify channel order,
	not calibrated color accuracy.
7. Display different colors on the two screen halves, then swap them. Verify that
	the corresponding LED portions follow each half. Use a moving bright patch
	around the outer screen edges to verify origin, direction and camera alignment.
8. Hold either camera in reset while displaying a bright pattern. Its LED portion
	must turn fully black after the freshness deadline; the other half must continue.

After a stable 1 MHz test, change the Cinema clock to 2 MHz and repeat the checks.
Then test the intended 4 MHz profile. Return to the last stable frequency if the
links become intermittent. Do not use 10 MHz as an initial target on long wiring.

## Transport status values

| UI status | JSON `transport` | Meaning |
|---|---:|---|
| Disabled | 0 | Cinema is not enabled |
| Ready | 1 | SPI2 and both CS devices initialized |
| Invalid configuration | 2 | Missing, duplicate, or invalid SPI settings |
| Pin conflict | 3 | Another WLED feature owns a Cinema GPIO |
| No DMA memory | 4 | Internal DMA buffer allocation failed |
| SPI2 unavailable | 5 | The dedicated SPI2 host could not initialize |

`Ready` proves that the WLED transport initialized. It does not by itself prove
that either camera is responding; check both camera connection states as well.

## Troubleshooting

| Symptom | Checks |
|---|---|
| Camera upload stays at `Connecting` | Confirm GPIO0 is tied to GND, press `RST` during connection, verify COM port, and swap TX/RX if necessary |
| Camera repeatedly resets | Use a stronger 5 V supply, shorten power wiring, and confirm common ground |
| Camera initialization fails | Reseat the OV2640 ribbon, confirm the AI Thinker board has working 4 MB PSRAM, and verify 5 V power |
| `Invalid configuration` | Enter six distinct GPIOs and a frequency from 1000000 to 10000000 Hz |
| `Pin conflict` | Move the conflicting LED, button, relay, Ethernet, or other configured function away from GPIO5/17/18/19/21/23 |
| Both cameras disconnected | Check camera power, shared SCLK/MOSI/MISO, common ground, GPIO12/15 resistors, and reduce the clock to 1 MHz |
| Only one camera disconnected | Check that camera's CS wire and power, then confirm its left/right firmware role |
| Connections swap or one role is rejected | Confirm CS Left reaches the board flashed as `camera_left` and CS Right reaches `camera_right` |
| Links connect only at low speed | Improve ground returns and cable topology, shorten stubs, and adjust series damping before raising the clock |
| Cinema effect is black with both links connected | Check increasing frame counters, nonzero configuration generation/counts, exact segment length, effect selection, and that all three devices run protocol v4 |
| Frames increase but colors follow the wrong screen edge | Verify camera roles, semantic calibration corner labels, strip zero corner and direction |
| Photo busy/unavailable or capture times out | Enable and save Cinema first, check the camera link/settings PIN, and retry after the previous capture completes; a memory allocation failure can also prevent starting a photo |
| Occasional black portions despite connected links | Check frame counters and SPI errors, sensor exposure/frame rate, power stability, and bus frequency; reduce LED/network workload on WLED |

## Acceptance checklist

- [ ] WLED `esp32dev`, `camera_left`, and `camera_right` builds report `SUCCESS`.
- [ ] WLED is reachable through the web interface.
- [ ] Each physical camera contains its correct role firmware.
- [ ] GPIO0 is disconnected from GND after each camera upload.
- [ ] Each camera has the required GPIO12 pull-down and GPIO15 pull-up.
- [ ] All devices share ground and both cameras receive stable 5 V power.
- [ ] Camera MISO outputs are separate: left GPIO12 to master GPIO19, right GPIO12 to master GPIO21.
- [ ] WLED reports `SPI: Ready` at 1 MHz.
- [ ] Both cameras report connected with increasing sequences and stable boot IDs.
- [ ] Both frame counters increase and RGB test patterns reach the correct LED portions.
- [ ] Holding either camera in reset affects only that camera's status.
- [ ] Both links remain stable for at least ten minutes.
- [ ] The same checks pass at the selected operating frequency.

Passing this checklist validates firmware loading, camera initialization, SPI
wiring, role assignment, packet integrity, link supervision and basic RGB rendering.
It does not establish calibrated color accuracy or perspective alignment.

## Host regression checks

From the repository root, run `python tools/run_cinema_tests.py`. The runner uses
GCC, Clang, or MSVC (including installed Visual Studio Build Tools on Windows).
It compiles the real controller, SPI master and protocol code against small host
stubs. It checks uptime-based rendering, timeout and black-frame convergence,
camera reboot isolation, configuration updates arriving during SPI initialization,
independent MISO selection, and cleanup after GPIO allocation failures. RGB checks
cover sensor byte order, uneven perimeter counts, both edge directions, truncated
images, command history, and full-duplex exchanges between the real SPI slave and
controller code. They also exercise lost commands, stale queued frames, controller
and camera reboots, and configuration changes. Calibration checks verify an
analytic projective mapping, mirrored/rotated corner ordering, degenerate region
rejection, exact configuration persistence, JPEG metadata, short final chunks, retries and expiry.

The hardware acceptance checklist above remains required for electrical timing,
camera initialization, and reset/reconnect behavior.

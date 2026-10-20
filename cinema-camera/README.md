# WLED Cinema Bring-up Guide

This guide covers firmware build and upload, wiring, WLED configuration, and
validation of the wired SPI link between:

- one ESP32 DOIT DevKit V1 running WLED as SPI master;
- one AI Thinker ESP32-CAM with OV2640 and 4 MB PSRAM as the left slave;
- one AI Thinker ESP32-CAM with OV2640 and 4 MB PSRAM as the right slave.

## Current milestone

The current firmware initializes both cameras in RGB565 QVGA mode and provides a
CRC-protected SPI heartbeat from each camera to WLED. WLED validates the camera
role, boot ID, packet sequence, slot structure, and CRC before reporting a node as
connected.

The camera-to-LED image pipeline is not complete yet. The camera firmware does not
extract perimeter colors or send `FrameRgb` packets. During this milestone:

- `SPI: Ready`, both cameras `Connected`, and increasing packet sequences indicate
  a successful test;
- the frame counters remain `0`;
- the WLED Cinema effect remains black because no RGB frames are published yet.

Use another WLED effect to test the LED strip itself.

## Required hardware

- ESP32 DOIT DevKit V1, 30-pin version;
- two AI Thinker ESP32-CAM boards with OV2640 and 4 MB PSRAM;
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
Left camera: Connected, sequence <increasing value>, frames 0
Right camera: Connected, sequence <increasing value>, frames 0
```

The sequence values must increase on each refresh. `frames 0` is correct for the
current heartbeat milestone.

The same data is available as JSON. Replace the address with the WLED IP:

```powershell
$cinemaUrl = "http://192.168.1.50/json/cinema"
Invoke-RestMethod $cinemaUrl | ConvertTo-Json -Depth 4
```

Run the `Invoke-RestMethod` command again after a few seconds and compare the two
sequence values.

A healthy result has `transport` equal to `1`, both `connected` fields set to
`true`, stable nonzero `boot` values, and increasing `sequence` values. The JSON
endpoint does not currently expose a CRC error counter; malformed packets are
rejected before they can update the connection sequence.

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
| Cinema effect is black with both links connected | Expected until camera RGB extraction and `FrameRgb` publishing are implemented |

Do not diagnose the SPI bus using LED output during this milestone. The authoritative
checks are `SPI: Ready`, both connection flags, increasing sequences, and successful
single-camera reset/reconnect tests.

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
- [ ] Holding either camera in reset affects only that camera's status.
- [ ] Both links remain stable for at least ten minutes.
- [ ] The same checks pass at the selected operating frequency.

Passing this checklist validates firmware loading, camera initialization, SPI
wiring, role assignment, packet integrity, and WLED link supervision. It does not
yet validate screen-color capture or LED color rendering.

## Host regression checks

From the repository root, run `python tools/run_cinema_tests.py`. The runner uses
GCC, Clang, or MSVC (including installed Visual Studio Build Tools on Windows).
It compiles the real controller, SPI master and protocol code against small host
stubs. It checks uptime-based rendering, timeout and black-frame convergence,
camera reboot isolation, configuration updates arriving during SPI initialization,
independent MISO selection, and cleanup after GPIO allocation failures.

The hardware acceptance checklist above remains required for electrical timing,
camera initialization, and reset/reconnect behavior.

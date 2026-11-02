# Diagnose a real LED Wall master

The current test rig uses master `192.168.1.82` on USB **COM8**, and slaves
`192.168.1.78` (110 LEDs) and `192.168.1.81` (181 LEDs). No simulated boards,
UDP replacements or localhost controller server are used.

## What was observed on 2026-11-01

During a user-reported failure the master stopped answering HTTP and the PC could
not complete its ARP entry. USB remained responsive: native WLED `v` returned
the version, and `{"v":true}` returned live info. In one continuous capture,
13 USB responses showed uptime increasing from 753 to 877 seconds while 29 HTTP
requests timed out. Free heap remained about 86-90 KiB and RSSI about -52 to -56 dBm.
This interval demonstrates loss of LAN communication while the main loop was
alive; it does not establish a driver, access-point, power-saving or electrical cause.

Earlier aggregate counters showed roughly one failed local UDP send per frame.
The .81 slave intermittently reported DDP from .82, while .78 did not. Aggregate
counters did not identify the failing destination. No panic, watchdog or brownout
message was captured in the passive original-firmware recording. This does not
exclude failures before recording started or a future crash.

Evidence is stored locally under `.pio/ledwall-diagnostics/` (ignored by Git).
`original-usb-network/layout-latest.json` contains a layout read from the master
during a brief successful HTTP response. Review it before importing/restoring it;
the running revision had later changes that were not all saved to flash.

After the diagnostic upload, the USB-only master answered all sampled HTTP requests
in a five-minute capture and a subsequent three-minute capture without resetting.
Both slaves eventually reported DDP from .82. The second capture did record four
transient `sendto()` failures with errno 12 (`ENOMEM`); output recovered and sampled
heap/largest-block values remained healthy. These observations do not prove the
original fault fixed. Firmware, browser polling and external wiring all changed
before this comparison; record the original power/GPIO arrangement before a
controlled test with the external wiring restored.

Slave .78 had a separate configuration conflict: its ordinary Sync UDP port was
4048, also used by DDP. After backing up the relevant settings, changing the Sync
port to 21324 and restarting that slave, it reported live DDP from the master.
This explains that receiver's failure to enter DDP during the observed test; it
does not explain the master's LAN outage. No receiver firmware update was needed.

## 1. Preserve the layout

Export JSON from the editor while the current layout is still displayed. Export
uses the local browser draft and can work even when the master is not answering.
Save to master requires a successful response and confirmed saved revision.
Uploading firmware reboots the master; runtime-only changes are not automatically
persistent. Do not erase flash/filesystem as part of this investigation.

The restored diagnostic layout is revision 3 / saved revision 2. It is currently
runtime-only. Save the current layout successfully, or retain the captured JSON
for another restore, before a power-cycle comparison. Change physical connections
only with power removed, and document which supply powers the master and strip.

## 2. Build and upload the diagnostic firmware

The ignored root override and the sample contain `ledwall_esp32dev_debug`. It
uses the same board, module and filesystem configuration, adds `WLED_DEBUG` and
Arduino error logging (`CORE_DEBUG_LEVEL=1`), and leaves Wi-Fi power saving and
watchdog configuration at their existing values. Run from the repository root:

```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e ledwall_esp32dev_debug --target upload --upload-port COM8
```

Close any existing serial monitor before uploading. If the upload explicitly waits
for bootloader synchronization, follow the board's BOOT-button procedure; do not
change wiring or flash settings speculatively. Retain the matching diagnostic
`.pio/build/ledwall_esp32dev_debug/firmware.elf` for decoding a captured backtrace.

On the tested COM8 board automatic synchronization returned **Wrong boot mode
0x13**, before flash writing. For manual entry, hold BOOT/FLASH, tap and release
EN/RST, then release BOOT. To preserve that download-mode state for the next upload,
temporarily set `board_upload.before_reset = no-reset` in the ignored debug
environment. Remove that temporary line after the manual upload attempt.
The successful recovery used the master with external GPIO/strip connections
removed, a fresh manual bootloader entry, UTF-8 console output and 57600 baud.
All written regions passed hash verification. These simultaneous changes do not
identify which condition caused the preceding failed bootloader verification.
The debug profile retains the conservative 57600-baud upload speed. On Windows,
set `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8` for an upload process if PlatformIO
otherwise fails to print the uploader's Unicode progress bar.

## 3. Capture HTTP and USB together

```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\python.exe" tools/ledwall_diagnostics.py --master 192.168.1.82 --slave 192.168.1.78 --slave 192.168.1.81 --serial-port COM8 --serial-info --duration 600
```

The tool prints the output folder. It records `events.jsonl` and `serial.log`, and
backs up a readable wall layout to `layout-latest.json`. USB runs at 115200 baud
with DTR/RTS low. The default capture is passive; `--serial-info` explicitly sends
only WLED's native informational `{"v":true}` request every 10 seconds. No power,
effect, Wi-Fi, reboot, PIN or persistent config command is sent by this tool.
Some USB adapters can still toggle control lines when opened; correlate any boot
at capture start with that operation before calling it a spontaneous reset.

For an interactive monitor with exception decoding, use this instead of the
collector (COM8 can have only one owner):

```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device monitor -e ledwall_esp32dev_debug --port COM8 --baud 115200
```

## 4. Reproduce one condition at a time

1. Restore/check the real controller layout and start wall output. Close the editor
   for 60 seconds while the capture continues.
2. Open one `/ledwall` tab on the .82 master and use it for at least 90 seconds.
3. Hide/close that tab for 60 seconds. The new editor does not poll in hidden tabs;
   visible polling is sequential every five seconds, with body transfers included
   in request timeouts. These changes bound browser load, not prove a Wi-Fi fix.
4. If needed, compare output stopped and output running, then test each slave
   separately. Record each manual action's time so counters can be compared.
5. When HTTP fails, leave USB connected and capture at least 20 more seconds before
   resetting anything. The USB `info.ledwall` diagnostics remain useful without HTTP.

## How to interpret the evidence

`[LEDWALL]` summaries are printed every five seconds in the diagnostic build.
They include heap/minimum heap/largest block, Wi-Fi status/sleep, loop/worker stack
minimum free bytes, network heartbeat age, frames and local send errors. Per-output
lines identify each destination IP. Native Arduino driver errors provide the error
at the actual failing socket call; `errnoAfterSend` is only a secondary hint because
the native sender destroys its socket before returning.

The same fields are exposed in `/json/ledwall` and native `/json/info` (therefore
also USB `{"v":true}`). `network.phase` and `heartbeatAgeMs` distinguish an idle
worker from a remote HTTP/mDNS operation. Per-output counters reset on a new layout
revision; global counters continue until reboot. `build` must identify the new
diagnostic revision before interpreting added fields.
`lastError` retains the latest failure even after a successful send. Compare the
counter increment and current per-output `lastResult` before treating that text as
an ongoing failure. A cumulative nonzero error count alone does not show an outage.
Espressif documents UDP `ENOMEM` when lower-level transmit buffers fill in its
[lwIP guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/lwip.html).
That is a possible interpretation of the captured transient errors, not evidence
that application heap was exhausted or that this caused the original LAN outage.
The diagnostics also include the actual IP, subnet mask and gateway so a routing
configuration error can be distinguished from a radio or HTTP issue.
`heap` follows WLED's internal **8-bit-capable** heap query; `minimumHeap` follows
Arduino's minimum **all-internal** heap query. They use different capability masks,
so minimumHeap can exceed heap; do not compare those two numbers as one pool.

- USB uptime continuing during HTTP failure proves the processor is still running
  at those samples. A missing USB response alone does not prove a crash.
- An uptime decrease/boot banner is evidence of a reset; use the reset reason and
  preceding serial text to distinguish panic, watchdog or brownout.
- A low stack watermark or shrinking largest free block is evidence to investigate,
  not an automatic diagnosis of the current failure.
- Online/HTTP and DDP mode/source are separate observations; neither verifies
  physical light output. Check the actual LEDs during the real-device test.

Espressif documents the corresponding panic/backtrace, heap-corruption and
brownout messages in its [fatal errors guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/fatal-errors.html).
Do not disable brownout protection or enable automatic reboot as a substitute for
collecting evidence. Internet connectivity is not required for these LAN/USB tests.

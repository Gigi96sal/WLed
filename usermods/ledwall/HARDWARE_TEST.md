# Hardware acceptance procedure

This procedure has not been executed by the coding agent. Use a classic ESP32
master, two ESP32 standard-WLED receivers and WS2812B strips. Begin at low
brightness with suitable power injection, common signal ground and properly
sized power distribution for the installed strips. Follow WLED's
[wiring guidance](https://kno.wled.ge/basics/wiring-guides/).

Partial real-board connectivity checks on the user's .82/.78/.81 rig are recorded
in [VALIDATION.md](VALIDATION.md) and [DIAGNOSTICS.md](DIAGNOSTICS.md). They do not
complete the optical, persistence, fault-injection and power tests below.

Record firmware versions, board models, LED revision/count per physical output,
router/AP model/channel, topology, power arrangement and all realtime settings.
Keep browser screenshots and short videos tied to that record.

## Discovery and receiver diagnostics (2026-11-01 follow-up)

Before the rendering checks below, verify native node discovery and mDNS with two
real standard-WLED slaves. Check a manually entered local IP as well. Add one slave
from discovery and compare imported `start`/`len` ranges against its LED Preferences,
including two GPIO outputs, a gap and a reversed hardware bus. Confirm the browser
does not double-reverse imported bus indices. Repeat import after changing one output;
matching ranges should keep their geometry, new ranges need placement.

Disconnect one slave: within a completed background probe it should become offline,
without freezing effects on the other. Reconnect it and check recovery. Block HTTP
while allowing DDP: distinguish API-unreachable from actual lighting. Block UDP 4048
while allowing HTTP: the slave may be online but should not report fresh DDP from
the master after its realtime timeout. Test stale state with many slow/offline devices.

Exercise receiver live override, wrong offset/main-segment-only settings and packet
sequence skipping. Use Prepare receiver and verify actual settings on the slave,
including optional PIN rejection and success. Confirm no GPIO/count/current-limit
change. Start wall with nonzero brightness, check source IP and protocol. Stop wall
and verify fallback after timeout; Save and reboot to check the chosen enable state.

Measure frame jitter and heap/largest block with discovery/probes active, browser
closed, controller unreachable and OTA starting during an HTTP check. Discovery and
HTTP being in a background task does not establish radio/timing performance.

## Rendering and persistence

1. **Single-output mapping:** begin with a 10-LED strip on each remote. Use a short
   wavelength Rainbow and zero speed. Check first/middle/last LED positions, colour
   order, endpoints, reversal, diagonal placement and physical start offsets.
   Confirm unused output intervals are black. Reject overlapping physical ranges.
2. **Shared space:** place two strips so their endpoints touch virtually. Run a slow
   directional wave and a radial ripple. The colour/phase should continue across
   controllers at that location. Film both receivers in one high-frame-rate view;
   measure actual display skew rather than describing it as synchronized by eye.
3. **Autonomy and persistence:** Save an enabled scene; confirm saved revision.
   Close all browser tabs and disconnect the PC. Observe ongoing animation, reboot
   the master, then verify geometry/effect/brightness and automatic recovery.
   Repeat with Apply only to confirm unsaved edits do not replace the saved scene.
4. **Receiver recovery:** reboot/unplug one receiver for 30 seconds. The other must
   continue without application-level waits. The returning receiver should resume
   on newly received full frames. Disable the engine and verify the configured
   remote realtime timeout and native fallback effect.
5. **Network failure:** interrupt master Wi-Fi and restore it. Record visible
   fallback, recovery interval and send errors. Try an incorrect IP and a smaller
   remote LED count; document lack of automatic discovery/capacity reconciliation.
   If a controllable AP permits loss injection, test dropped/late packets and
   verify subsequent full frames restore colours. Keep receiver `seqskip` off.
6. **Frame budget:** test 600 outputs split 300+300 at 30 FPS for at least 30 minutes.
   Record frame-counter deltas, frame work time, free heap, largest contiguous
   allocation and resets. Actual frame rate is counter delta / elapsed seconds;
   configured FPS alone proves nothing. Capture packet frequency with Wireshark
   `udp.port == 4048`; verify header offsets/PUSH with 500+500 outputs as well.
7. **Concurrent work:** repeat while dragging, applying, saving and loading the UI
   from a phone and PC. Measure worst gaps, heap low-water/largest block and output
   skew. Save pauses are expected and must be quantified. Test OTA pause/recovery
   using the intended WLED update procedure.
8. **Fault recovery:** back up files first. With output disabled, test a malformed
   primary and intact backup, then two invalid files. Confirm valid backup recovery
   or disabled defaults with a diagnostic. Power-cut experiments during saving are
   separate destructive tests on a disposable fixture; do not claim crash safety
   from the host fault-injection tests.
9. **Scale/topology:** test 1,000 outputs split 500+500, then larger layouts only if
   heap/frame measurements remain acceptable. Repeat router-free with two slaves
   and one phone. Record AP association and animation performance separately.

Acceptance record must distinguish observed results from expected behaviour.
Do not call 30 FPS stable until the measured frame intervals and visual skew meet
the installation's documented tolerance with the editor both open and closed.

# OSRS Tick Practicer

A web-based practice tool for learning Old School RuneScape tick manipulation methods. Users practice the exact click timings of methods like 3-tick fishing against a simulated tick clock and get precise feedback on their errors.

## Language

### Game concepts

**Tick**:
The atomic unit of game time in OSRS, 0.6 seconds of real time at full speed. All game actions resolve on tick boundaries.
_Avoid_: frame, beat, step

**Method**:
A tick manipulation technique the user can practice (e.g. 3-tick fishing, 1-tick chinchompas, 3-tick granite). A named, learnable skill with a fixed timing pattern.
_Avoid_: technique (synonym, pick one), drill, exercise

**Cycle**:
The repeating pattern of ticks that makes up a Method. 3-tick fishing has a Cycle of length 3; the pattern restarts every Cycle.
_Avoid_: loop, rotation, pattern

**Target**:
A clickable entity in the practice scene (e.g. fishing spot, herb, tar, rock). Inputs are judged against both their tick and their Target.
_Avoid_: button, element, node

### Practice engine concepts

**Method Definition**:
Authored, declarative data describing a Method: its Cycle length and the Expected Inputs on each tick of the Cycle. Consumed by the generic engine; contains no logic.
_Avoid_: method config, script

**Input**:
A single user click, quantized to exactly one Tick and one Target.
_Avoid_: click event, action

**Expected Input**:
An Input required by the Method Definition on a specific tick of the Cycle, on a specific Target.
_Avoid_: required click, goal

**Verdict**:
The engine's judgment of an Input or Expected Input: `hit`, `wrong-tick`, `wrong-target`, `missed` (an Expected Input that never came), or `extra` (an Input with no matching expectation that tick).
_Avoid_: result, outcome, score

**Quantization**:
The explicit policy that assigns every Input to exactly one Tick. There is no hidden latency grace; a slowed-down clock is the honest remedy for human reaction time.
_Avoid_: snapping, tolerance, grace window

**Tick Rate**:
The speed at which the engine advances ticks, as a multiple of real time (1.0 = full speed, 0.6s/tick). Can be slowed for practice or paused for manual tick-by-tick stepping.
_Avoid_: speed, tempo

**Metronomic**:
Cycle semantics where Expected Inputs sit at fixed positions of every Cycle, judged against the global tick phase (e.g. 1-tick chinchompas). A Method Definition selects this or Anchored.
_Avoid_: schedule mode, metronome mode

**Anchored**:
Cycle semantics where each Cycle starts from the last hit of the Primary Action. A missed Expected Input shows as Wasted Ticks and the next Primary Action hit re-anchors the Cycle — it never cascades into permanent phase loss.
_Avoid_: reset-based mode, drift mode

**Primary Action**:
The beat-setting Input of an Anchored Method (e.g. clicking the fishing spot). Its hit starts each Cycle.
_Avoid_: main click, anchor click

**Wasted Ticks**:
Ticks that pass unproductively after a missed Expected Input in an Anchored Method. The primary error currency of anchored methods.
_Avoid_: downtime, dead ticks

**Run**:
One practice attempt: an ordered log of every Input with its Tick, Target, and real timestamp. Produces a Verdict breakdown.
_Avoid_: session, attempt

**Replay**:
Deterministic re-simulation of a Run at any Tick Rate, driving the same engine from its input log. The review flow; not a separate renderer.
_Avoid_: playback, review mode

**Scene**:
The generic, data-driven play area: authored Target stand-ins plus an inventory container. Contains no per-method code.
_Avoid_: game view, module scene

**Client Shell**:
The app's replica of the OSRS client frame: Viewport, Inventory Panel, and Chatbox. Practice controls and meta feedback live outside it in app chrome.
_Avoid_: game frame, client window

**Viewport**:
The world region of the Client Shell where world Targets are placed at authored coordinates.
_Avoid_: world view, canvas

**Inventory Panel**:
The 4x7 grid region of the Client Shell. Static Targets occupy authored slots; caught items fill remaining slots.
_Avoid_: inventory, bag

**Chatbox**:
The in-client message log where live Verdict feedback reads as game chat.
_Avoid_: log, console

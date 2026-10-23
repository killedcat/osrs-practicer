# Method Definitions are declarative data judged by one generic engine

The tool must stay extensible as OSRS adds tick manipulation methods, so a Method is authored data — a Method Definition declaring its Cycle, Targets, and Expected Inputs — consumed by a single generic judging engine; there is no per-method code anywhere in engine or UI. Because real methods split into two families, each definition selects its cycle semantics: **Metronomic** (Expected Inputs at fixed positions of every Cycle against the global tick phase, e.g. 1-tick chinchompas) or **Anchored** (each Cycle starts from the last hit of the Primary Action; a miss costs Wasted Ticks and the next Primary Action hit re-anchors instead of cascading permanent phase loss, e.g. 3-tick fishing).

## Considered options

- **One hand-coded module per method** — rejected: N shallow modules duplicating the same timing math; adding a method would mean code changes in engine and UI, failing the deletion test.
- **A single metronomic clock for all methods** — rejected: an anchored method judged against fixed global phase snowballs `wrong-tick` verdicts after one miss, erasing the recovery-not-cascade semantics that anchored play actually teaches.

## Consequences

- Adding a Method is authoring a definition (+ validator pass + replay-golden test); zero engine or UI changes.
- The definition format is one contract with two adapters: in-repo TS authoring today, community JSON import later.
- Quantization is a law: every Input lands on exactly one Tick, with no hidden latency grace; slowing the Tick Rate is the honest remedy for human reaction time.

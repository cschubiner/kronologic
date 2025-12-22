# Claude Code Guidelines for Kronologic

This document provides guidance for Claude Code when working on this project.

## Project Overview

Kronologic is a deduction game scenario generator that uses SAT solving to create mystery puzzles. Players ask questions about character movements through rooms over time to solve mysteries.

## Key Files

- **`src/scenario-solver.js`**: Core SAT solver, CNF builder (`buildCNF()`), decoder (`solveAndDecode()`)
- **`src/scenario-shared.js`**: Scoring functions, shared utilities
- **`tests/scenarios.test.js`**: All test cases using Vitest/Bun
- **`scenario_handler_gpt.html`**: Main scenario generator UI
- **`scenario_handler_v2.html`**: Alternative UI with grid layout
- **`digital-note-sheet.html`**: Player note-taking interface

## Adding New Scenarios (Condensed)

When adding a new scenario (e.g., S18), update all of these:

- `src/scenario-solver.js`: add CNF constraints in `buildCNF()`, store `privKeys.SXX`, decode in `solveAndDecode()`. Use `mulberry32(resolvedSeed)` and room names in SAT variable keys.
- `src/scenario-shared.js`: add `scoreMyScenario()` and hook it in `computeScenarioScore()`.
- `scenario_handler_gpt.html`: add radio button, `sXX: scenarioValue === 'sXX'` in config, private facts display.
- `scenario_handler_v2.html`: add to `SCENARIOS`, add `sXX: scenarioValue === 'sXX'`, private facts display.
- `tests/scenarios.test.js`: add `describe("SXX: ...")`, use `testWithThreshold`, include invalid-config throw tests.
- `README.md`: update Scenarios documentation and Scenario Selection list.
- Run `bun test`.

Common pitfalls: missing config builder line, forgetting one HTML file, room-name vs index mismatch, missing scoring hook.

## Common Patterns

### Room Shuffling
Rooms are shuffled in `buildCNF()`:
```javascript
const shuffledRooms = shuffleWithSeed(config.rooms, resolvedSeed);
const R = shuffledRooms;  // Use R throughout buildCNF
```

When naming SAT variables, use room **names** (not indices) for consistency with decoding:
```javascript
const MY_VAR = (t, ri) => vp.get(`S18_VAR_${t}_${R[ri]}`);  // GOOD
const MY_VAR = (t, ri) => vp.get(`S18_VAR_${t}_${ri}`);     // BAD - decode mismatch
```

### Seeded Random
Use `mulberry32(resolvedSeed)` for deterministic randomness:
```javascript
const rng = mulberry32(resolvedSeed);
const randomIndex = Math.floor(rng() * array.length);
```

### Private Keys Pattern
Store setup data in `privKeys` during CNF building, retrieve during decoding:
```javascript
// In buildCNF:
privKeys.S18 = { selectedChar, targetRoom };

// In solveAndDecode:
if (privKeys.S18) {
  const { selectedChar, targetRoom } = privKeys.S18;
}
```

## Testing

```bash
bun test              # Run all tests
bun test --watch      # Watch mode
bun test S18          # Run specific tests
```

Use `testWithThreshold` for seeded, reproducible tests:
```javascript
testWithThreshold(cfg, (res, cfg, seed) => {
  // Assertions
});
```

## Checklist Before Committing

- [ ] `bun test` passes (all 147+ tests)
- [ ] Both HTML files have config builder updated
- [ ] Both HTML files have private facts display
- [ ] README.md updated with scenario rules
- [ ] No hardcoded values that should be seeded

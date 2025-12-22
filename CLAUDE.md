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

## Adding New Scenarios

When adding a new scenario (e.g., S18), you MUST update ALL of these:

### 1. Core Logic (`src/scenario-solver.js`)

**In `buildCNF()`:**
```javascript
if (config.scenarios && config.scenarios.s18) {
  // Validation
  if (R.length < 2) throw new Error("S18 requires at least 2 rooms");

  // Setup with RNG
  const rng = mulberry32(resolvedSeed);

  // Create SAT variables using vp.get()
  const MY_VAR = (t, ri) => vp.get(`S18_MYVAR_${t}_${R[ri]}`);

  // Add clauses
  clauses.push([...]);

  // Store private keys for decoding
  privKeys.S18 = { key1, key2 };
}
```

**In `solveAndDecode()`:**
```javascript
if (privKeys.S18) {
  const { key1, key2 } = privKeys.S18;
  // Decode SAT solution using val() helper
  // Store results in priv object
  priv.my_scenario = { ... };
}
```

### 2. Scoring (`src/scenario-shared.js`)

**Add scoring function:**
```javascript
function scoreMyScenario(res, cfg) {
  const info = res.priv.my_scenario;
  if (!info) return 0;
  let score = 0;
  // Add difficulty factors
  return score;
}
```

**Add hook in `computeScenarioScore()`:**
```javascript
if (cfg.scenarios.s18 && res.priv.my_scenario) {
  scores.myScenario = scoreMyScenario(res, cfg);
  score += scores.myScenario;
}
```

### 3. UI Updates (BOTH HTML files!)

**Radio button (`scenario_handler_gpt.html`):**
```html
<div class="row">
  <label><input type="radio" name="scenario" id="s18" value="s18" />
    S18: My Scenario (brief description)</label>
</div>
```

**Config builder (CRITICAL - easy to miss!):**
```javascript
scenarios: {
  // ... existing ...
  s18: scenarioValue === 's18',  // ADD THIS LINE
}
```

**Private facts display:**
```javascript
if (res.priv.my_scenario) {
  const info = res.priv.my_scenario;
  pf.push(`My Scenario: ${info.value}`);
}
```

**For `scenario_handler_v2.html`, also add to SCENARIOS array:**
```javascript
{ id: 's18', name: 'My Scenario', desc: 'Brief description.' }
```

### 4. Tests (`tests/scenarios.test.js`)

```javascript
describe("S18: My Scenario", () => {
  it("should enforce main constraint", () => {
    const cfg = { /* config */ };
    testWithThreshold(cfg, (res) => {
      expect(res.priv.my_scenario).toBeTruthy();
    });
  });

  it("should reject invalid configs", () => {
    expect(() => solveAndDecode(cfg)).toThrow("S18 requires...");
  });
});
```

### 5. Documentation (`README.md`)

Add to:
1. Scenarios section with full rules
2. Scenario Selection list

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

# Repository Guidelines for AI Agents

This document provides guidance for AI coding agents (Claude, Codex, etc.) working on this project.

## Project Structure

```
kronologic/
├── src/
│   ├── scenario-solver.js   # SAT solver, CNF builder, decoder
│   └── scenario-shared.js   # Scoring functions, shared utilities
├── tests/
│   └── scenarios.test.js    # All test cases (Vitest/Bun)
├── scenario_handler_gpt.html # Main scenario generator UI
├── scenario_handler_v2.html  # Alternative grid-based UI
├── digital-note-sheet.html   # Player note-taking interface
├── CLAUDE.md                 # Claude-specific guidelines
├── AGENTS.md                 # This file
└── README.md                 # Full documentation
```

## Build & Test Commands

```bash
bun install           # Install dependencies
bun test              # Run all tests (required before commit)
bun test --watch      # Watch mode during development
bun test --coverage   # Coverage report
bun run dev           # Start local dev server (port 3000)
bun x prettier --check "src/**/*.js" "tests/**/*.js"  # Check formatting
```

## Coding Style

- **ES modules** with named exports
- **Two-space indentation**
- **camelCase** for functions/variables, **SCREAMING_SNAKE_CASE** for constants
- Comment only on tricky constraints, not obvious code
- Keep functions focused and small

## Adding New Scenarios

This is the most common task. Follow this checklist strictly:

### Files to Modify (ALL required!)

1. **`src/scenario-solver.js`**
   - Add CNF constraints in `buildCNF()`
   - Add decoding logic in `solveAndDecode()`
   - Use `privKeys.SXX = {...}` to pass data between building and decoding

2. **`src/scenario-shared.js`**
   - Add scoring function `scoreMyScenario(res, cfg)`
   - Add hook in `computeScenarioScore()`: `if (cfg.scenarios.sXX && res.priv.xxx) {...}`

3. **`scenario_handler_gpt.html`**
   - Add radio button input
   - Add `sXX: scenarioValue === 'sXX'` in config object (CRITICAL!)
   - Add private facts display in `updatePrivateFacts()` or similar

4. **`scenario_handler_v2.html`**
   - Add to `SCENARIOS` array
   - Add `sXX: scenarioValue === 'sXX'` in config object (CRITICAL!)
   - Add private facts display

5. **`tests/scenarios.test.js`**
   - Add `describe("SXX: Name", () => {...})`
   - Test main constraints, edge cases, and error conditions
   - Use `testWithThreshold()` for seeded reproducibility

6. **`README.md`**
   - Add full scenario documentation to Scenarios section
   - Add brief entry to Scenario Selection list

### Common Mistakes to Avoid

1. **Missing config builder**: The radio button won't work without `sXX: scenarioValue === 'sXX'` in the scenarios object
2. **Room name vs index mismatch**: Rooms are shuffled; use room names in SAT variable names
3. **Forgetting one HTML file**: Both `scenario_handler_gpt.html` AND `scenario_handler_v2.html` need updates
4. **Missing scoring hook**: Add to `computeScenarioScore()` even if scoring function exists

## SAT Solver Patterns

### Variable Naming
Use descriptive prefixes with scenario ID:
```javascript
const MY_VAR = (t, ri) => vp.get(`S18_MYVAR_${t}_${R[ri]}`);
```

### Seeded Randomness
Always use `mulberry32` for reproducibility:
```javascript
const rng = mulberry32(resolvedSeed);
const choice = array[Math.floor(rng() * array.length)];
```

### Private Keys
Pass data from CNF building to decoding:
```javascript
// In buildCNF:
privKeys.S18 = { carrier1, carrier2, startRoom };

// In solveAndDecode:
if (privKeys.S18) {
  const { carrier1, carrier2, startRoom } = privKeys.S18;
}
```

## Testing Guidelines

- Use `testWithThreshold(cfg, (res, cfg, seed) => {...})` for seeded tests
- Test with multiple seeds by varying `cfg.seed`
- Include validation tests: `expect(() => solveAndDecode(cfg)).toThrow("...")`
- Assert schedule invariants and private data correctness
- Include failing seed in error messages

## Commit Guidelines

- Use conventional prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Keep commits scoped to one change
- Mention affected scenarios in commit message
- Run `bun test` before committing (all tests must pass)

Example:
```
feat: add S18 Heavy Sofa scenario

- CNF constraints for sofa transport mechanics
- Two carriers must be alone to pickup
- Sofa moves to adjacent room each turn during transport
- Tests covering all rules and edge cases
```

## Pull Request Guidelines

- Summarize player-visible impact
- State verification command: `bun test`
- Include seed examples or screenshots for UI changes
- Note any breaking changes to existing scenarios

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

## Adding New Scenarios (Condensed)

This is the most common task. Update all of these:

- `src/scenario-solver.js`: add CNF constraints in `buildCNF()`, store `privKeys.SXX`, decode in `solveAndDecode()`. Use `mulberry32(resolvedSeed)` and room names in SAT variable keys.
- `src/scenario-shared.js`: add `scoreMyScenario()` and hook it in `computeScenarioScore()`.
- `scenario_handler_gpt.html`: add radio button, `sXX: scenarioValue === 'sXX'` in config, private facts display.
- `scenario_handler_v2.html`: add to `SCENARIOS`, add `sXX: scenarioValue === 'sXX'`, private facts display.
- `tests/scenarios.test.js`: add `describe("SXX: ...")`, use `testWithThreshold`, include invalid-config throw tests.
- `README.md`: update Scenarios documentation and Scenario Selection list.
- Run `bun test`.

Common pitfalls: missing config builder line, forgetting one HTML file, room-name vs index mismatch, missing scoring hook.

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

# Repository Guidelines

## Project Structure & Module Organization
`src/scenario-solver.js` houses the SAT solver, decoder, and helpers. Tests live in `tests/scenarios-basic.test.js` and `tests/scenarios-extended.test.js`, Vitest settings in `vitest.config.js`, and the static HTML prototypes (`scenario_handler_gpt.html`, `digital-note-sheet.html`) cover manual checks.

## Build, Test, and Development Commands
Install dependencies with `bun install`. Iterate with `bun test`, run `bun test --coverage` before submitting, and preview HTML tools with `bun x serve .` or by opening them directly.

## Coding Style & Naming Conventions
Use ES modules, two-space indentation, and `camelCase`; reserve `SCREAMING_SNAKE_CASE` for constants. Keep functions tight, comment only on tricky constraints, and format with `bun x prettier --check "src/**/*.js" "tests/**/*.js"` after solver or test edits.

## Testing Guidelines
Vitest runs under Bun; add suites as `tests/*.test.js`. Reuse `testWithThreshold` for seeded reproducibility, assert schedule invariants and private data, note failing seeds in errors, and confirm coverage with `bun test --coverage`.

## Commit & Pull Request Guidelines
Use conventional prefixes (`feat:`, `refactor:`, `docs:`) and keep commits scoped. Mention affected scenarios or solver sections. Pull requests should summarize player impact, state the verification command (`bun test`), and attach screenshots or seed logs when HTML or generated schedules change.

## Scenario Configuration Tips
Solver configs take `rooms`, `edges`, `chars`, timeline `T`, and scenario flags. Document new private fields in the README, pair changes with multi-seed tests (vary `cfg.seed`), and describe how clues shift so scenario authors can brief players.

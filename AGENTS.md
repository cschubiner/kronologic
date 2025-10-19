# Repository Guidelines

## Project Structure & Module Organization
Core solver logic lives in `src/scenario-solver.js`, which exports the SAT routines plus `solveAndDecode` and helper utilities such as `neighbors`. Tests reside in `tests/`, currently centered on `scenarios.test.js` for scenario validation. Static prototypes for the web experience are kept in `scenario_handler_gpt.html` and `digital-note-sheet.html`, while shared configuration (coverage, globals) sits in `vitest.config.js`. Treat the repository root as the working directory for scripts and fixtures.

## Build, Test, and Development Commands
Install dependencies once with `npm install`. Use `npx vitest` for an interactive test run when iterating on solver changes, and `npx vitest run --coverage` before proposing a PR to generate the V8 reports configured in `vitest.config.js`. The HTML tools are static; launch a lightweight server such as `npx serve .` or open the files directly in a browser when you need manual checks.

## Coding Style & Naming Conventions
JavaScript sources follow ES module syntax with two-space indentation and trailing commas avoided unless required. Use `camelCase` for functions and variables, reserve `SCREAMING_SNAKE_CASE` for constants, and keep exported API names descriptive (`solveAndDecode`, `varPool`). Inline comments should clarify constraint intent rather than restating code. Run `npx prettier --check "src/**/*.js" "tests/**/*.js"` if you edit formatting-sensitive sections.

## Testing Guidelines
Vitest is the canonical framework; place new files beside `tests/scenarios.test.js` and suffix them with `.test.js`. Mirror the existing pattern of driving solver runs with seeded configs and assert behavior via helper utilities like `testWithThreshold`. When adding scenarios, include a deterministic seed range and codify edge constraints (e.g., poison timings) so regressions surface quickly. Coverage output from `npx vitest run --coverage` should show meaningful exercise of newly added branches.

## Commit & Pull Request Guidelines
Follow the conventional commit style present in history (`feat: ...`, `refactor: ...`, `docs: ...`). Commits should bundle logically complete changes and mention scenario names or solver components touched. Pull requests need a summary of the gameplay impact, reproduction or test instructions (`npx vitest run`), and references to any tracked issues. Include screenshots or seed logs if UI HTML or scenario outputs change to help reviewers verify behavior quickly.

## Scenario Configuration Tips
Configs passed to `solveAndDecode` include rooms, edges, characters, timeline length (`T`), and `scenarios` flags. When introducing a new constraint, document the expected private fields and schedule invariants in the README and add at least one test case that runs the solver across multiple seeds (use `cfg.seed` offsets as shown in existing suites) to ensure stability under randomized sampling.

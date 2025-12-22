# Kronologic Mystery Game - Scenario Generator

**[View on GitHub Pages](https://cschubiner.github.io/kronologic/)**

A deduction game where players ask questions about character movements through rooms over time to solve mysteries. This tool generates valid scenarios with configurable difficulty using SAT solving.

## Quick Links

- **[Scenario Generator](scenario_handler_gpt.html)** - Generate mystery scenarios with configurable difficulty
- **[Digital Note Sheet](digital-note-sheet.html)** - Interactive note-taking tool for tracking deductions during gameplay

## How the Game Works

### Core Mechanics

Players investigate what happened during a night at a mansion (or other location) by asking two types of questions:

#### 1. Location + Time Questions
**"How many different characters were in [Location] at [Time X]?"**

- **Shared Information (🟢)**: Everyone hears the COUNT of characters
- **Private Information (⚪)**: Only the asker sees ONE randomly selected character who was there

Example: "How many characters were in the Gallery at t=3?"
- Shared: "4 characters were in Gallery at t=3"
- Private: "One character present: Detective"

#### 2. Location + Character Questions
**"How many times did [Character] visit [Location] across all timesteps?"**

- **Shared Information (🟢)**: Everyone hears the total VISIT COUNT
- **Private Information (⚪)**: Only the asker sees ONE randomly selected time when they visited

Example: "How many times did Servant visit the Foyer?"
- Shared: "3 visits by Servant to Foyer"
- Private: "One time visited: t=2"

### Winning the Game

Players must deduce the secret scenario by combining:
- Public information (counts) that everyone knows
- Private information only they've seen
- Logical deduction about what's possible given the constraints

## Scenarios

**Note**: You can only select ONE scenario per puzzle generation. Each scenario creates a unique mystery to solve.

### S1: Poison (Assassin)
**Mystery**: One character poisoned someone at a specific time and location.

**Rules**:
- The assassin is always the **first character** in your character list (by default "A")
- Exactly one victim (not the assassin) was poisoned
- At exactly one (time, room) pair (the "poison moment"):
  - The assassin and victim are both present
  - NO other characters are present (exactly 2 people total)
- At ALL other (time, room) pairs where the assassin is present:
  - Either the assassin is completely alone (1 person), OR
  - At least 2 other people are present with the assassin (3+ people total)
  - The assassin is NEVER alone with exactly one other person except at the poison moment
- You can optionally fix the poison room and/or poison time

**Goal**: Identify the victim, poison time, and poison room.

**Difficulty Factors**: Other character pairs being alone together at various times creates red herrings that look like potential poison moments.

---

### S2: Phantom
**Mystery**: One character was mysteriously alone at every single timestep.

**Rules**:
- Exactly one character is the phantom
- At EVERY timestep (t=1, t=2, ..., t=T):
  - The phantom is in some room
  - NO other character is in the same room as the phantom
  - The phantom is completely isolated at that timestep
- All non-phantom characters must share a room with at least one other character at some point during the timeline
  - This prevents non-phantoms from being completely isolated throughout all timesteps

**Goal**: Identify which character is the phantom.

**Difficulty Factors**: Characters who are alone frequently (but not at every timestep) are harder to distinguish from the true phantom. The more timesteps a non-phantom spends alone, the harder the puzzle. Difficulty scoring adds 100 × (alone proportion) for non-phantoms who are alone in at least T−2 timesteps, and 50 × (alone proportion) for anyone alone at least half the time.

---

### S3: The Singer's Jewels
**Mystery**: A priceless necklace keeps changing hands. The first thief is the first person alone with it in the alphabetically first room (the “Dance Hall”), and any time the holder meets exactly one other person, the jewels pass.

**Rules**:
- At least one character must visit the alphabetically earliest room in the map during the timeline
- Beyond the guaranteed visit, schedules remain unconstrained; the passing narrative is left for downstream clue logic

**Goal**: Track who entered the key room and build the story of how the jewels moved.

**Difficulty Factors**: With more characters and longer timelines, multiple suspects may plausibly be first to reach the room, complicating deduction.

---

### S4: Bomb Duo
**Mystery**: Two accomplices are planning something suspicious.

**Rules**:
- Exactly two characters are the bombers (A1 and A2)
- The bombers are distinct (A1 ≠ A2)
- They must be alone together (exactly those two, no one else) in at least one room/time during the schedule
- **Critical constraint**: For ANY (time, room) pair, if exactly 2 characters are present in that room at that time, those 2 characters MUST be the bombers
- Equivalently: The bombers are the ONLY pair who can ever be alone together
- Other character groupings are allowed:
  - 1 person (anyone can be alone, including bombers)
  - 3+ people (any combination, including with or without bombers)
- But exactly 2 people in a room is ONLY allowed if those 2 are the bombers

**Goal**: Identify the two bombers.

**Difficulty Factors**: The constraint is very restrictive. Bombers being in larger groups (camouflage) and groups of exactly 3 people (near-misses) increase difficulty. Difficulty scoring adds 40 points each time both bombers share a room with extra people and 30 points for every room-time with exactly three occupants.

---

### S5: Lovers
**Mystery**: Two characters are secret lovers who never meet.

**Rules**:
- Exactly two characters are the lovers (L1 and L2)
- The lovers are distinct (L1 ≠ L2)
- The lovers NEVER share a room at any timestep:
  - For ALL (time, room) pairs: L1 and L2 are never both present
- **Every pair of non-lovers must meet at least once**:
  - For any two characters who are NOT both lovers, they must share a room at some (time, room) pair
  - This ensures all non-lovers encounter each other at least once
  - The lovers themselves never meet each other

**Goal**: Identify the two lovers.

**Difficulty Factors**: Other character pairs who rarely meet (but do meet at least once) create confusion about who the actual lovers are. Pairs that meet exactly once are strong red herrings. Difficulty scoring adds 100 points to pairs that never meet, 80 points to pairs that meet exactly once, and 40 points to pairs that meet only twice.

---

### S6: Phantom + Lovers
**Mystery**: One character is a phantom (alone at every timestep) AND there are two lovers who never meet.

**Rules**:
- Combines S2 (Phantom) and S5 (Lovers) constraints
- Exactly one character is the phantom:
  - At EVERY timestep, the phantom is alone in their room
  - NO other character shares a room with the phantom at any time
  - The phantom is in their own category - neither a lover nor a non-lover
- Exactly two characters are the lovers (L1 and L2):
  - The lovers NEVER share a room at any timestep
  - The lovers are distinct from the phantom
  - **Neither lover can be the phantom** (phantom is always alone, so can't have a relationship)
- **Every pair of non-phantom, non-lovers must meet at least once**:
  - For any two characters who are NOT lovers AND NOT the phantom, they must share a room at some point
  - This ensures all "regular" characters encounter each other
  - The phantom is excluded from this requirement (they never meet anyone)

**Goal**: Identify the phantom and the two lovers.

**Difficulty Factors**: The phantom is easy to identify (always alone). The two lovers must avoid each other while still meeting all other non-phantom characters. Other pairs who rarely meet create confusion about who the lovers are.

---

### S7: Aggrosassin
**Mystery**: One character is a serial poisoner who kills everyone they meet one-on-one.

**Rules**:
1. **Exactly one aggrosassin** exists (can be any character, not necessarily the first)

2. **Minimum kill frequency**: The aggrosassin must be in a 1-on-1 meeting (exactly 2 people in a room) for at least **⌈T/2⌉ timesteps**
   - Example: With T=6, the aggrosassin must have 1-on-1 meetings in at least 3 different timesteps
   - This ensures the aggrosassin is actively hunting throughout the timeline

3. **Exclusive two-person meetings**: Any room that contains exactly two people must include the aggrosassin
   - Non-aggrosassin characters can be alone or in groups of 3+, but they are never alone together
   - Every 1-on-1 meeting therefore marks a confirmed kill moment for the aggrosassin

4. **Victims**: The aggrosassin kills everyone they meet 1-on-1
   - Victims = all characters who were alone with the aggrosassin at any timestep
   - A character can be alone with the aggrosassin multiple times (still counts as one victim)

5. **Flexibility otherwise**: The aggrosassin can spend other timesteps alone, in pairs with victims, or in larger groups (which help disguise them between kills)
   - Repeated meetings with the same victim are allowed

**Goal**: Identify the aggrosassin and determine how many victims they claimed.

**Difficulty Factors**: 
- More victims = harder to identify the pattern (more characters to track)
- Aggrosassin appearing in large groups between kills can obscure which 1-on-1s were lethal
- The aggrosassin is not marked (unlike S1 where it's always the first character), so players must deduce who it is from the pattern
- The "half of timesteps" constraint ensures consistent killing behavior, making the pattern more detectable

**Scoring**: Difficulty = (number of victims × 10) + (total 2-person meetings in entire scenario)
- More victims increases difficulty significantly (heavily weighted)
- More kill moments (each 2-person meeting) also raises the score

---

### S8: The Freeze
**Mystery**: Mr. Freeze is on the loose. Anyone they catch alone is frozen in place for the rest of the timeline.

**Rules**:
- Exactly one character is the Freeze (randomly chosen from all characters)
- Whenever the Freeze shares a room with exactly **one** other person, that person is frozen
- Frozen characters remain in that room for all remaining timesteps (even if `mustMove=true`)
- **Randomized kill constraints**: The scenario randomly requires:
  - Between 1-3 kills to occur
  - Specific timesteps where kills must happen (excluding the final timestep)
  - This creates variety - some scenarios have early kills, others have kills spread throughout
- Frozen victims can be visited later, but they never move again

**Goal**: Identify Mr. Freeze and list every frozen victim (with their freeze moments).

**Difficulty Factors**:
- More frozen victims make the pattern more obvious (easier to identify)
- 1-on-1 meetings between non-Freeze characters act as red herrings and increase difficulty
- The randomized kill timing creates unpredictable patterns across different scenarios

**Scoring**: Difficulty = (number of victims × 100) + (non-Freeze 1-on-1 meetings × 5)
- More victims significantly increase difficulty (heavily weighted)
- Red herring 1-on-1 meetings between non-Freeze characters add moderate difficulty

---

### S9: Doctor's Cure
**Mystery**: A doctor starts the game with a handful of already-frozen victims. Mid-game house calls thaw them out and send them moving again.

**Rules**:
- Exactly one doctor exists (randomly chosen)
- At least one character begins frozen in place for the first timestep
- The doctor must perform **at least one heal** that is **not** on the first or last timestep
- Healing happens in-room: a frozen victim must share the room with the doctor when healed
- Frozen characters thaw mid-game and are required to **leave their starting room** after being healed
- Frozen characters may still move after thawing, even if `mustMove` was disabled (the scenario enforces post-heal movement)

**Goal**: Identify the doctor, list who started frozen, and note the heal times/rooms when they were thawed.

**Difficulty Factors**:
- More frozen victims and multiple heal moments increase the amount of timeline bookkeeping
- Heals clustered in the middle timesteps create overlapping movements that are harder to trace
- Forced post-heal movement generates extra paths that can mask who was frozen first

---

### S10: Contagion
**Mystery**: The alphabetically first room on the map is contagious. Anyone who steps inside becomes infected, and infections spread to everyone who shares a room with an infected character.

**Rules**:
- The contagious room is the alphabetically earliest room name in the map
- Any character present in the contagious room at any timestep becomes infected immediately
- Infection is permanent; once infected, a character stays infected for all later timesteps
- Whenever an infected character shares a room with others, every character in that room becomes infected at that timestep (including larger groups)
- At least one character must enter the contagious room during the scenario (guarantees infections occur)

**Goal**: Determine when each character was first infected and reconstruct the infection order.

**Difficulty Factors**:
- More total infected characters increase difficulty
- Infections spread across many different timesteps (especially one new infection per timestep) are hardest to reconstruct
- Large infection jumps (many people infected at once) lower difficulty, while slow, staggered spread raises it

---

### S11: The Vault
**Mystery**: The alphabetically earliest room is designated as The Vault, and only the key holder can unlock it.

**Rules**:
- The Vault is always the alphabetically first room on the map
- The key holder is randomly chosen among the characters
- Nobody may enter The Vault unless the key holder is present at that timestep
- The key holder must enter The Vault **with company** on at least two different timesteps, and those visits must include at least two distinct companions across the night

**Goal**: Identify the key holder and list everyone who ever entered The Vault.

**Difficulty Factors**:
- More Vault entrants create more data to track
- Fewer joint visits (just the minimum two) make the holder harder to confirm
- Vault meetings that happen in small groups increase ambiguity about who held the key

---

### S12: Glue Room
**Mystery**: One randomly chosen room is covered in glue. Anyone who steps inside is stuck there for one extra turn.

**Rules**:
- The glue room is selected randomly (seeded) from the map's rooms
- Whenever a character enters the glue room before the final timestep, they must remain there for the next timestep as well (two turns in a row)
- After the forced extra turn, they must leave the glue room immediately (no three-turn streaks in the glue room)
- If the first time a character arrives is the final timestep, they only appear once (no future turn to show they were stuck)
- The scenario guarantees at least one glue-room entry that is not on the final timestep
- Movement rules automatically allow sticking in place, even if "must move" is enabled

**Goal**: Identify which room is the glue room and when each character first entered it.

**Difficulty Factors**:
- More unique entrants increase the bookkeeping required to track first arrivals
- Short timelines make overlapping two-turn stays harder to separate
- Multiple characters entering in close succession creates ambiguity about who triggered which stuck window

---

### S13: Glue Shoes
**Mystery**: One character has glue on their shoes. Anyone who shares a room with them becomes stuck for an extra turn.

**Rules**:
- The glue carrier is chosen randomly (seeded) from all characters
- Whenever the glue carrier shares a room with others (before the final timestep), every other occupant must stay in that room for exactly one additional turn and then leave
- The glue carrier is never stuck by their own glue and may move freely on the next timestep
- At least one character must get stuck before the final timestep (so the extra-turn effect is visible)
- Movement constraints allow stuck victims to remain in place even if "must move" is enabled

**Goal**: Identify which character has the glue shoes and when each affected character was first stuck by them.

**Difficulty Factors**:
- More total victims or multi-person stick events create tangled overlaps
- Glue encounters early in the timeline obscure later movements if the carrier keeps moving quickly
- Victims who reappear with the carrier on different turns raise questions about which meeting caused their first stuck moment

---

### S14: The Curse of Amarinta
**Mystery**: A supernatural curse jumps between people whenever the current carrier meets someone who isn't cursed yet.

**Rules**:
- Exactly one character starts cursed at **Time 1**
- The curse only changes hands when a cursed and uncursed character share a room in the same timestep
  - During that meeting, **everyone in the room is cursed** for that time
  - Starting next timestep, the previously cursed attendees are freed and the previously uncursed attendees now carry the curse
- If a cursed character is alone or only meets other cursed characters, nothing changes
- Players learn which characters are cursed at **Time 6** and must work backward to find the original carrier
- Requires at least six timesteps so the Time 6 snapshot is meaningful

**Goal**: Use the Time 6 cursed list and the meeting pattern to deduce who was cursed in Time 1.

**Difficulty Factors**:
- Multiple handoff events in quick succession create red herrings about when the curse flipped
- Rooms hosting mixed groups (cursed and uncursed) make the Time 6 snapshot compatible with fewer origins
- Long stretches without meetings keep the initial carrier cursed longer, widening the search space

---

### S15: World Travelers
**Mystery**: Three characters are the top travelers, ranked by how many unique rooms they visited.

**Rules**:
- **1st place** visits ALL rooms (the "greatest world traveler")
- **2nd place** visits exactly R-1 rooms (misses one room)
- **3rd place** visits exactly R-2 rooms (misses two rooms)
- All other characters visit at most R-3 rooms (loose constraint, ties allowed among non-top-3)
- Requires at least 4 rooms and 3 characters

**Goal**: Deduce who is 1st, 2nd, and 3rd place by analyzing which rooms each character visited.

**Difficulty Factors**:
- Characters with similar visit counts to the top 3 create red herrings
- More characters means more suspects to eliminate
- Larger maps make it harder to track who visited which rooms

---

### S16: Homebodies
**Mystery**: Each character visited a different number of unique rooms. One character—the homebody—never left their starting room.

**Rules**:
- Each character visits a **unique** number of rooms: 1, 2, 3, ... up to N (where N = number of characters)
- The **homebody** visits exactly 1 room and stays there the entire game
- All other characters **must move every turn** (cannot stay in the same room twice in a row)
- Requires at least as many rooms as characters

**Goal**: Determine the complete ranking of who visited how many rooms, and identify the homebody.

**Difficulty Factors**:
- Adjacent visit counts (e.g., 2 vs 3 rooms) require careful tracking
- More characters create more rankings to deduce
- The homebody is easy to spot if alone, but harder if others visit their room

---

## Using the Generator

### Basic Setup

1. **Define the Map**: Use Mermaid-like syntax to create room connections
   ```
   graph TD
     Foyer --- Stairs
     Foyer --- Gallery
     Gallery --- Masks
   ```

2. **Set Characters**: Comma-separated list (e.g., "A, B, C, D, S, J")

3. **Choose Timesteps**: How many time periods (2-10, typically 6)

4. **Movement Rules**:
   - "Must move each time": Characters can't stay in the same room
   - "Allow stay": Characters can remain in their current room

### Scenario Selection

Enable one scenario:
- **S1 (Poison)**: Optional fixed room/time
- **S2 (Phantom)**: No configuration needed
- **S3 (Singer's Jewels)**: No configuration needed
- **S4 (Bomb)**: No configuration needed (bombers automatically share a private 1-on-1 moment)
- **S5 (Lovers)**: No configuration needed
- **S6 (Phantom + Lovers)**: No configuration needed
- **S7 (Aggrosassin)**: No configuration needed
- **S8 (The Freeze)**: No configuration needed
- **S9 (Doctor's Cure)**: No configuration needed
- **S10 (Contagion)**: No configuration needed
- **S11 (The Vault)**: No configuration needed
- **S12 (Glue Room)**: No configuration needed
- **S13 (Glue Shoes)**: No configuration needed
- **S14 (Curse of Amarinta)**: No configuration needed
- **S15 (World Travelers)**: No configuration needed (requires 4+ rooms, 3+ characters)
- **S16 (Homebodies)**: No configuration needed (requires rooms ≥ characters)

### Difficulty Control

**Percentile (0-100)**: Controls puzzle difficulty
- **0-20**: Easiest puzzles (few red herrings)
- **40-60**: Medium difficulty
- **80-100**: Hardest puzzles (many confusing patterns)

**Samples**: How many scenarios to generate (10-5000)
- More samples = better percentile accuracy
- Recommended: 100-500 for good results

## Technical Details

- **SAT Solver**: Uses DPLL algorithm with unit propagation
- **Timeout**: 5 seconds per scenario attempt (skips if too complex)
- **Deterministic**: Same seed produces same scenario
- **Pure JavaScript**: Runs entirely in browser, no server needed

## Development

### Local Development Server

The scenario generator uses ES6 modules, which require a web server (they don't work with `file://` protocol due to CORS restrictions). To run locally:

```bash
# Start the development server
bun run dev
```

Then open your browser to:
- **Scenario Generator**: http://localhost:3000/scenario_handler_gpt.html
- **Note Sheet**: http://localhost:3000/digital-note-sheet.html

**Note**: The generator works perfectly on GitHub Pages without any build step. The dev server is only needed for local development.

### Running Tests

This project uses [Bun](https://bun.sh) for running tests:

```bash
bun test
```

To run tests in watch mode:

```bash
bun test --watch
```

## Note-Taking Interface

The **note-sheet.html** file provides an interactive note-taking tool designed for players to track their deductions during gameplay.

### Features

**Time-Step Mini-Maps**
- Visual representation of the location graph for each timestep
- Click any room to add/remove character placements
- Color-coded character chips show who you believe was where
- Strikethrough mode (click chip) marks "NOT here" deductions
- Adaptive grid layout (responsive for mobile/tablet/desktop)

**Character Placement Tracking**
- Add character initials to rooms by clicking
- Toggle strikethrough to mark negative deductions (e.g., "Detective was NOT in Office at t=3")
- Remove placements with × button
- Visual feedback: room borders change color when characters are placed

**Visit Count Table**
- Track how many times each character visited each location
- Input boxes for recording shared information from questions
- Helps identify patterns and contradictions

**Deduction Notes**
- Rich text editor with formatting (bold, italic, lists)
- Record logical chains and elimination reasoning
- Auto-saves to browser localStorage

**Undo/Redo System**
- Full history tracking (up to 50 states)
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo)
- Recover from mistakes easily

**Data Persistence**
- Auto-saves all placements, counts, and notes to localStorage
- Export to JSON file for backup or sharing
- Survives page refresh

### Intended Workflow

1. **Generate a scenario** using the main generator (scenario_handler_gpt.html)
2. **Open note-sheet.html** in a separate tab/window
3. **As you ask questions**, record information:
   - Shared counts go in the visit tracking table
   - Private character sightings get placed on the time-step maps
   - Logical deductions go in the notes area
4. **Use visual patterns** to spot contradictions:
   - If a character appears in two places at once, you made an error
   - Strikethrough helps track "impossible" placements
   - Color-coding makes it easy to see character movements
5. **Solve the mystery** by combining all information sources

### Integration with Main Generator

The note sheet is designed to work alongside the scenario generator:
- Generator provides the **questions and answers**
- Note sheet provides the **workspace for deduction**
- Players manually transfer information between the two tools
- This separation keeps private information truly private (each player has their own note sheet)

### Example Use Case

**Scenario**: S2 (Phantom) with 6 characters, 6 timesteps

1. Player asks: "How many characters in Gallery at t=3?" → Answer: "2 characters"
2. Player records "2" in their notes
3. Player's private info: "One character present: Detective"
4. Player clicks Gallery on t=3 mini-map, adds Detective chip
5. Later, player learns Detective was also in Foyer at t=3 (contradiction!)
6. Player uses strikethrough on Gallery placement to mark it as wrong
7. Player writes in notes: "Detective NOT in Gallery at t=3 - must be in Foyer"

## Example Workflow

1. Generate 100 scenarios at 75th percentile with S2 (Phantom) enabled
2. System creates 100 valid solutions, scores them by difficulty
3. Selects a scenario from the 60-80th percentile range
4. Players ask questions using the Question Interface
5. Players use the note-taking interface to track deductions
6. Players deduce which character is the phantom based on:
   - How many people were in each room at each time (shared)
   - Specific character sightings (private to each player)
   - Logical elimination using their notes

## Tips for Game Masters

- Start with **50th percentile** for new players
- Use **S2 (Phantom)** or **S5 (Lovers)** for simpler mysteries
- **S4 (Bomb)** is very restrictive and creates unique patterns
- Combine multiple scenarios for expert-level challenges
- More timesteps = more data = easier deduction
- Fewer characters = easier to track

---

## Creating New Scenarios (Developer Guide)

When implementing a new scenario (e.g., S17), follow this checklist to ensure all pieces are in place:

### 1. Add CNF Constraints (`src/scenario-solver.js`)

In the `buildCNF()` function, add your scenario's constraints:

```javascript
// S17: Your Scenario Name — brief description
if (config.scenarios && config.scenarios.s17) {
  // Validate requirements
  if (C.length < 3) throw new Error("S17 requires at least 3 characters");

  // Use seeded RNG for deterministic randomness
  const rng = mulberry32(resolvedSeed);

  // Add CNF clauses for your constraints
  // ... clauses.push([...]);

  // Store private data for decoding later
  privKeys.S17 = { someKey: someValue };
}
```

**Key patterns:**
- Use `mulberry32(resolvedSeed)` for deterministic randomness
- Use `buildTotalizer()` for cardinality constraints (exactly K, at most K)
- Store any values needed for decoding in `privKeys.SXX`

### 2. Add Decoding (`src/scenario-solver.js`)

In `solveAndDecode()`, decode the solution to extract meaningful information:

```javascript
// S17 decoding
if (privKeys.S17) {
  // Analyze the solved schedule
  const someAnalysis = {};
  for (const ch of C) {
    // Process schedule[ch][t] for each timestep
  }

  // Store in priv object for display
  priv.your_scenario_key = {
    someValue: privKeys.S17.someKey,
    computedData: someAnalysis,
  };
}
```

**Tip:** Some scenarios (like S14: Curse of Amarinta) compute information *after* solving rather than encoding everything in CNF. This is useful when:
- The computation is complex but deterministic given the schedule
- You want to show "what if" scenarios (e.g., "what if X was the origin?")
- The player needs to work backwards from revealed information

### 3. Add Scoring Function (`src/scenario-shared.js`)

Add a scoring function and hook it into `scoreScenario()`:

```javascript
// In scoreScenario():
if (cfg.scenarios.s17 && res.priv.your_scenario_key) {
  scores.yourScenario = scoreYourScenario(res, cfg);
  score += scores.yourScenario;
}

// New function:
function scoreYourScenario(res, cfg) {
  const info = res.priv.your_scenario_key;
  if (!info) return 0;

  let score = 0;
  // Add points for complexity/difficulty factors
  // e.g., red herrings, number of suspects, etc.
  return score;
}
```

### 4. Add Private Facts Display (`scenario_handler_gpt.html` and `scenario_handler_v2.html`)

In both HTML files, add display logic for private facts:

```javascript
// In the updatePrivateFacts() or renderNoteEl() function:
if (cfg.scenarios.s17 && res.priv.your_scenario_key) {
  const info = res.priv.your_scenario_key;
  noteEl.innerHTML += `
    <h4>S17: Your Scenario</h4>
    <p>Key Info: ${info.someValue}</p>
  `;
}
```

### 5. Add Radio Button/Config (`scenario_handler_gpt.html` and `scenario_handler_v2.html`)

**In `scenario_handler_gpt.html`:**
```html
<div class="row">
  <label><input type="radio" name="scenario" id="s17" value="s17" />
    S17: Your Scenario (brief description)</label>
</div>
```

And in the config object:
```javascript
scenarios: {
  // ... existing scenarios ...
  s17: scenarioValue === 's17',
}
```

**In `scenario_handler_v2.html`:**
```javascript
const SCENARIOS = [
  // ... existing scenarios ...
  { id: 's17', name: 'Your Scenario', desc: 'Brief description.' }
];
```

### 6. Add Tests (`tests/scenarios.test.js`)

Add comprehensive tests:

```javascript
describe("S17: Your Scenario", () => {
  it("should enforce your main constraint", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"]],
      chars: ["X", "Y", "Z"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s17: true },
      seed: 1700,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const info = res.priv.your_scenario_key;
      expect(info).toBeTruthy();
      // Assert your constraints hold
    });
  });

  it("should reject invalid configs", () => {
    const cfg = { /* invalid config */ };
    expect(() => solveAndDecode(cfg)).toThrow("S17 requires...");
  });
});
```

### 7. Update Documentation (`README.md`)

Add your scenario to:
1. The Scenarios section with full rules, goal, and difficulty factors
2. The Scenario Selection list with brief description

### Complete Checklist

- [ ] CNF constraints in `buildCNF()` (`src/scenario-solver.js`)
- [ ] Decoding in `solveAndDecode()` (`src/scenario-solver.js`)
- [ ] Scoring function in `src/scenario-shared.js`
- [ ] Private facts display in both `scenario_handler_*.html` files
- [ ] Radio button/config in both `scenario_handler_*.html` files
- [ ] Tests in `tests/scenarios.test.js`
- [ ] Documentation in `README.md`
- [ ] Run `bun test` to verify all tests pass

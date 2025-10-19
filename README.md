# Kronologic Mystery Game - Scenario Generator

A deduction game where players ask questions about character movements through rooms over time to solve mysteries. This tool generates valid scenarios with configurable difficulty using SAT solving.

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

### S1: Poison (Assassin)
**Mystery**: One character poisoned someone at a specific time and location.

**Rules**:
- The assassin is always the **first character** in your character list (by default "A")
- At the poison time/location, the assassin was **alone with exactly one other person** (the victim)
- This is the **ONLY time** the assassin is ever alone with just one other person
- At all other times, the assassin is either completely alone, or with 2+ people

**Goal**: Identify when, where, and who was poisoned.

**Difficulty Factors**: Other characters being in pairs at various times creates red herrings.

---

### S2: Phantom
**Mystery**: One character was mysteriously alone at every single timestep.

**Rules**:
- One character is the phantom
- At every timestep (t=1, t=2, ..., t=T), the phantom is in a room by themselves
- All other characters must share a room with someone at least once

**Goal**: Identify which character is the phantom.

**Difficulty Factors**: Characters who are alone frequently (but not always) are harder to distinguish from the true phantom.

---

### S4: Bomb Duo
**Mystery**: Two accomplices planted a bomb that explodes at the final timestep.

**Rules**:
- Two characters are the bombers
- The bomb explodes at the **final timestep** (always)
- The bombers were alone together in the plant room at the final time
- **Critical**: The bombers are the ONLY pair who are ever alone together (exactly 2 people in a room) at ANY time
- Other characters can be in groups of 1, 3, 4, 5, 6... but never exactly 2 (except the bombers)

**Goal**: Identify the two bombers and which room they planted the bomb in.

**Difficulty Factors**: The constraint is very restrictive, making valid scenarios rare but distinctive.

---

### S5: Lovers
**Mystery**: Two characters are secret lovers who never meet.

**Rules**:
- Two characters are the lovers
- They are **never** in the same room at the same time
- They avoid each other completely throughout all timesteps

**Goal**: Identify the two lovers.

**Difficulty Factors**: Other pairs who rarely meet create confusion.

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

Enable one or more scenarios:
- **S1 (Poison)**: Optional fixed room/time
- **S2 (Phantom)**: No configuration needed
- **S4 (Bomb)**: Optional fixed room (time is always final)
- **S5 (Lovers)**: No configuration needed

### Difficulty Control

**Percentile (0-100)**: Controls puzzle difficulty
- **0-20**: Easiest puzzles (few red herrings)
- **40-60**: Medium difficulty
- **80-100**: Hardest puzzles (many confusing patterns)

**Samples**: How many scenarios to generate (10-5000)
- More samples = better percentile accuracy
- Recommended: 100-500 for good results

### How Difficulty Scoring Works

The generator creates many valid scenarios and scores them based on "red herrings" - patterns that look suspicious but aren't the actual solution. Higher scores = harder puzzles.

#### S1: Poison Scoring
**What makes it harder**: Other character pairs being alone together at various times

- **+60 points** for each pair of characters (not assassin-victim) who are alone together at any time/room
- The more "suspicious pairs" exist, the harder it is to identify the actual poisoning

**Example**: If characters B and C are alone in the Library at t=2, and D and E are alone in the Kitchen at t=4, that's +120 difficulty (2 red herring pairs).

#### S2: Phantom Scoring
**What makes it harder**: Characters who are alone frequently (but not always)

- **+100 points** per character who is alone T-1 or T-2 times (weighted by proportion)
- **+50 points** per character who is alone ≥50% of the time (weighted by proportion)
- Characters who are "almost phantoms" make it much harder to identify the true phantom

**Example**: With T=6 timesteps, if character B is alone 5 times (but not all 6), that's a strong red herring worth ~83 points.

#### S4: Bomb Duo Scoring
**What makes it harder**: Bombers being camouflaged in larger groups, and "near miss" groups of 3

- **+40 points** each time the bombers are together in a room WITH other people (not alone)
  - This camouflages them since they're not obviously the "only pair"
- **+30 points** for each group of exactly 3 people at any time/room
  - Groups of 3 are "near misses" - one person away from being a suspicious pair
  - Creates confusion about what counts as a "pair"

**Example**: If bombers meet in the Library with 2 other people at t=2 and t=4, that's +80. If there are 4 groups of 3 people throughout the timeline, that's +120 more, for +200 total difficulty.

#### S5: Lovers Scoring
**What makes it harder**: Character pairs who rarely meet

- **+100 points** for pairs who never meet (0 meetings)
- **+80 points** for pairs who meet exactly once
- **+40 points** for pairs who meet 2 times
- Pairs that avoid each other create confusion about who the actual lovers are

**Example**: With T=6, if characters A and B never meet, C and D meet once, and E and F meet twice, that's +220 difficulty from red herrings.

#### Combined Scoring
When multiple scenarios are enabled, scores are added together. The percentile selection then picks from the sorted list:
- **0th percentile**: Minimum score (easiest)
- **50th percentile**: Median score
- **100th percentile**: Maximum score (hardest)

Higher percentiles select scenarios with more confusing patterns.

## Technical Details

- **SAT Solver**: Uses DPLL algorithm with unit propagation
- **Timeout**: 5 seconds per scenario attempt (skips if too complex)
- **Deterministic**: Same seed produces same scenario
- **Pure JavaScript**: Runs entirely in browser, no server needed

## Example Workflow

1. Generate 100 scenarios at 75th percentile with S2 (Phantom) enabled
2. System creates 100 valid solutions, scores them by difficulty
3. Selects a scenario from the 60-80th percentile range
4. Players ask questions using the Question Interface
5. Players deduce which character is the phantom based on:
   - How many people were in each room at each time (shared)
   - Specific character sightings (private to each player)

## Tips for Game Masters

- Start with **50th percentile** for new players
- Use **S2 (Phantom)** or **S5 (Lovers)** for simpler mysteries
- **S4 (Bomb)** is very restrictive and creates unique patterns
- Combine multiple scenarios for expert-level challenges
- More timesteps = more data = easier deduction
- Fewer characters = easier to track

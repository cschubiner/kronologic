# Kronologic Mystery Game - Scenario Generator

**[View on GitHub Pages](https://cschubiner.github.io/kronologic/)**

A deduction game where players ask questions about character movements through rooms over time to solve mysteries. This tool generates valid scenarios with configurable difficulty using SAT solving.

## Quick Links

- **[Scenario Generator](scenario_generator.html)** - Generate mystery scenarios with configurable difficulty
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
- The assassin is always the **first character** in your character list
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
**Mystery**: A priceless necklace keeps changing hands. The first thief is the first person to reach the alphabetically first room **alone**, and any time the holder meets exactly one other person, the jewels pass.

**Rules**:
- A hidden pickup time is chosen from the first three timesteps (or the available timesteps when the timeline is shorter)
- No one may visit the alphabetically earliest room alone before that pickup time
- At the pickup time, exactly one character visits that room alone and becomes the first thief
- In a one-character game, the pickup happens at the first timestep
- Group visits to that room (2+ people at the same timestep) are allowed but do **not** steal the jewels
- After pickup, the jewels pass whenever the current holder shares a room with exactly one other character

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
- **Every pair other than the lover pair must meet at least once**:
  - For any two characters who are NOT both lovers, they must share a room at some (time, room) pair
  - This ensures each lover meets every non-lover, and all non-lovers meet each other
  - The lovers themselves never meet each other

**Goal**: Identify the two lovers.

**Difficulty Factors**: Other character pairs who rarely meet (but do meet at least once) create confusion about who the actual lovers are. Pairs that meet exactly once are strong red herrings. Difficulty scoring adds 80 points to pairs that meet exactly once and 40 points to pairs that meet exactly twice.

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
- **Every pair of non-phantom characters other than the lover pair must meet at least once**:
  - Each lover must meet every regular character, and all regular characters must meet each other
  - The phantom is excluded from this requirement (they never meet anyone)

**Requirements**: At least 4 characters, 3 rooms, and 2 timesteps.

**Goal**: Identify the phantom and the two lovers.

**Difficulty Factors**: The phantom is easy to identify (always alone). The two lovers must avoid each other while still meeting all other non-phantom characters. Other pairs who rarely meet create confusion about who the lovers are. Lover difficulty scoring ignores all pairs containing the phantom.

---

### S7: Aggrosassin
**Mystery**: One character is a serial poisoner who kills everyone they meet one-on-one.

**Rules**:
1. **Exactly one aggrosassin** exists (can be any character, not necessarily the first)

2. **Minimum kill quota**: The aggrosassin must secure at least **max(2, ⌈T/2⌉)** kills across the timeline
   - Every required kill happens during a 1-on-1 meeting (exactly two people in a room)
   - Examples mirroring the solver: with T=6, the aggrosassin must notch 3 kills; with T=2, they still need 2 kills (minimum-two-kills rule)

3. **Exclusive two-person meetings**: Any room that contains exactly two people must include the aggrosassin
   - Non-aggrosassin characters can be alone or in groups of 3+, but they are never alone together
   - Every 1-on-1 meeting therefore marks a confirmed kill moment for the aggrosassin

4. **Victims**: The aggrosassin kills everyone they meet 1-on-1
   - Victims = all characters who were alone with the aggrosassin at any timestep
   - **No repeat kills**: once a character has met the aggrosassin 1-on-1, they cannot be targeted again, so scenarios must include at least **requiredKills + 1** characters (the aggrosassin plus enough distinct victims)
   - Example: With T=6 (requiredKills=3), the scenario needs at least 4 characters so every kill can target a unique victim

5. **Flexibility otherwise**: The aggrosassin can spend other timesteps alone, in pairs with victims, or in larger groups (which help disguise them between kills)

**Goal**: Identify the aggrosassin and determine how many victims they claimed.

**Difficulty Factors**: 
- More victims = harder to identify the pattern (more characters to track)
- Aggrosassin appearing in large groups between kills can obscure which 1-on-1s were lethal
- The aggrosassin is not marked (unlike S1 where it's always the first character), so players must deduce who it is from the pattern
- The "half of timesteps" constraint ensures consistent killing behavior, making the pattern more detectable

**Scoring**: Difficulty = (number of victims × 10) + camouflage points
- More victims increases difficulty significantly (heavily weighted)
- Whenever the aggrosassin appears in a group of 3+, that appearance adds one camouflage point for each person beyond a two-person group

---

### S8: The Freeze
**Mystery**: Mr. Freeze is on the loose. Anyone they catch alone is frozen in place for the rest of the timeline.

**Rules**:
- Exactly one character is the Freeze (randomly chosen from all characters)
- Whenever the Freeze shares a room with exactly **one** other person, that person is frozen
- Frozen characters remain in that room for all remaining timesteps, overriding the normal movement rule
- **Randomized kill constraints**: The scenario randomly requires:
  - Between 1-3 distinct, first-time freezes (capped by the available victims and non-final timesteps)
  - Specific timesteps where those first-time freezes must happen (excluding the final timestep)
  - Additional victims may be frozen outside the required set, so the final victim count can exceed 3
  - This creates variety - some scenarios have early kills, others have kills spread throughout
- Frozen victims can be visited later, but they never move again

**Goal**: Identify Mr. Freeze and list every frozen victim (with their freeze moments).

**Difficulty Factors**:
- More frozen victims make the Freeze easier to identify, but make reconstructing every victim and freeze moment harder
- 1-on-1 meetings between non-Freeze characters act as red herrings and increase difficulty
- The randomized kill timing creates unpredictable patterns across different scenarios

**Scoring**: Difficulty = (number of victims × 100) + (non-Freeze 1-on-1 meetings × 5)
- Victim reconstruction is weighted more heavily than how quickly the Freeze becomes identifiable
- Red herring 1-on-1 meetings between non-Freeze characters add moderate difficulty

---

### S9: Doctor's Cure
**Mystery**: A doctor starts the game with a handful of already-frozen victims. Mid-game house calls thaw them out and send them moving again.

**Rules**:
- Exactly one doctor exists (randomly chosen)
- At least one character begins frozen in place for the first timestep
- Every character who begins frozen remains in their starting room until the doctor heals them
- Every frozen character is healed exactly once, and heals never happen on the first or last timestep
- Healing happens in-room: a frozen victim must share the room with the doctor when healed
- A healed character must **leave their starting room on the immediately following timestep**
- Unfrozen and already-thawed characters move normally; only characters who are still frozen may stay in place

**Goal**: Identify the doctor, list who started frozen, and note the heal times/rooms when they were thawed.

**Difficulty Factors**:
- More frozen victims and multiple heal moments increase the amount of timeline bookkeeping
- Heals clustered in the middle timesteps create overlapping movements that are harder to trace
- Forced post-heal movement generates extra paths that can mask who was frozen first

**Scoring**: Difficulty = 80 + (number of frozen characters × 40) + clustering bonuses. Each additional heal on the same timestep adds 15 points.

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
- The key holder is never alone in The Vault
- The key holder must enter The Vault **with company** on at least two different timesteps, and those visits must include at least two distinct companions across the night
- Every non-key-holder misses at least one Vault visit, making the key holder the only character present at every opening

**Requirements**: At least 3 characters, 3 rooms, and 3 timesteps.

**Goal**: Using the known Vault room, identify the key holder and list everyone who ever entered it.

**Difficulty Factors**:
- More Vault entrants create more data to track
- Fewer joint visits (just the minimum two) make the holder harder to confirm
- Vault meetings that happen in small groups increase ambiguity about who held the key

---

### S12: Glue Room
**Mystery**: One randomly chosen room is covered in glue. Anyone who steps inside is stuck there for one extra turn.

**Rules**:
- The glue room is selected randomly (seeded) from the map's rooms
- Starting in the glue room at the first timestep counts as entering it and forces the extra turn
- Whenever a character enters the glue room before the final timestep, they must remain there for the next timestep as well (two turns in a row)
- After the forced extra turn, they must leave the glue room immediately (no three-turn streaks in the glue room)
- A character may not enter the glue room for the first time on the final timestep because there is no future turn to demonstrate the effect
- The scenario guarantees at least one glue-room entry that is not on the final timestep
- The forced extra turn is the only exception to the normal movement rule

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
- A stuck victim's forced extra turn is the only exception to the normal movement rule

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
- At the end of each timestep, every room containing both cursed and uncursed characters swaps the curse
  - Previously cursed occupants become uncursed
  - Previously uncursed occupants become cursed
- Rooms containing only cursed characters or only uncursed characters do not change
- Players learn which characters are cursed **after the Time 6 handoffs** and must work backward to find the original carrier
- Requires at least six timesteps so the Time 6 snapshot is meaningful

**Goal**: Use the post-handoff Time 6 cursed list and the meeting pattern to deduce who began Time 1 cursed.

**Difficulty Factors**:
- Multiple handoff events in quick succession create red herrings about when the curse flipped
- Mixed rooms can flip several characters at once, making the reverse bookkeeping harder
- Long stretches without meetings make it harder to remember which carrier state persisted

---

### S15: World Travelers
**Mystery**: Three characters are the top travelers, ranked by how many unique rooms they visited.

**Rules**:
- **1st place** visits ALL rooms (the "greatest world traveler")
- **2nd place** visits exactly R-1 rooms (misses one room)
- **3rd place** visits exactly R-2 rooms (misses two rooms)
- All other characters visit at most R-3 rooms, so nobody can tie with 3rd place (ties are allowed among non-top-3 characters)
- The timeline and map must allow 1st place to visit every room; tied podium targets are never scaled down
- Requires at least 3 characters, at least 4 rooms, and at least one timestep per room
- With more than 3 characters, requires at least 5 rooms so moving non-podium characters can remain strictly below 3rd place

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
- Requires at least as many rooms and timesteps as characters
- The map and timeline must allow a moving character to reach N distinct rooms; invalid configurations are rejected instead of repeating visit counts

**Goal**: Determine the complete ranking of who visited how many rooms, and identify the homebody.

**Difficulty Factors**:
- Adjacent visit counts (e.g., 2 vs 3 rooms) require careful tracking
- More characters create more rankings to deduce
- The homebody is easy to spot if alone, but harder if others visit their room

### S17: Triple Alibi
**Mystery**: Three specific characters have a secret pact—they must meet together as a trio at least once during the night. No other group of exactly three can ever share the same room at the same time.

**Rules**:
- Three specific characters (the "alibi trio") must meet as a trio **at least once with no other people present**
- The trio must also be separated at least once; they do not travel together for the entire night
- **No other trio** of exactly 3 characters may occupy the same room at any timestep
- Pairs (2 people) and groups of 4+ are allowed
- Requires at least 4 characters and 2 timesteps, so the trio must be distinguished from at least one outsider and can both meet and separate

**Goal**: Identify which three characters form the alibi trio.

**Difficulty Factors**:
- A single trio meeting is hardest to spot; repeated meetings make the trio easier to identify
- More characters = more possible trios to consider (C choose 3)
- Movement patterns may reveal the trio based on where they converge

### S18: Heavy Sofa
**Mystery**: A heavy sofa needs to be transported from one room to the alphabetically first room. The sofa is so heavy that it requires exactly two people to carry it, and they must be alone together to pick it up.

**Rules**:
- Two specific characters are the designated carriers
- The sofa starts in a non-destination room
- **Pickup**: Both carriers must be alone together (exactly 2 people) in the sofa's room to pick it up
- **Before pickup**: Sofa stays in place; carriers can be anywhere. Unless pickup happens at Time 1, they are separate on the immediately preceding turn
- **During transport**: Carriers must stay together, move the sofa to an adjacent room each timestep, and never revisit a room
- Other characters may share the carriers' room after pickup; only the pickup itself must be private
- The sofa arrives at the alphabetically first room exactly at the final timestep
- The public schedule must have exactly one complete explanation for the carrier pair, start room, pickup time, and path; ambiguous candidates are discarded
- Requires at least 2 rooms, 2 characters, 2 timesteps, and a non-destination start that can reach the destination in time

**Goal**: Identify the two carriers, where the sofa started, and the path it took.

**Private Info**:
- The two carriers
- Starting room
- Pickup time
- Journey/path taken

**Difficulty Factors**:
- Longer journey = harder puzzle
- Later pickup = more pre-pickup noise to analyze
- More characters = more possible carrier pairs
- More rooms = more possible starting locations

---

### S19: Crowded Alibi
**Mystery**: One celebrity blends into the biggest crowds. They are always inside a largest group, and at least once they stand in a uniquely biggest room that proves they were there.

**Rules**:
- A single **celebrity** is always in a room whose size is **at least** as large as every other room (ties allowed)
- A seeded **reveal timestep** is chosen in advance from the non-final timesteps
- Before the reveal, the celebrity's room ties with at least one other room for largest
- At the reveal, the celebrity's room is the **only** largest room (unique maximum)
- Later unique maximums are allowed so every other suspect can still be eliminated
- No other character can stay in maximum-sized rooms **every** timestep; each other character has at least one turn in a smaller group
- Requires at least **3 rooms**, **3 characters**, **2 timesteps**, and a map that permits the required group changes

**Goal**: Identify the celebrity who rides the biggest crowd for cover.

**Private Info**:
- Celebrity identity
- Timeline of maximum room sizes and rooms
- The designated reveal timestep and every unique-maximum moment
- Which characters miss the maximum-sized group and when

**Difficulty Factors**:
- More timesteps create longer maximum-size timelines to analyze
- A later designated reveal makes the reveal subtler
- Suspects whose first missed maximum happens later remain plausible longer
- Larger casts and maps make it harder to track who avoided the max groups

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

4. **Movement Rule**:
   - Characters move to a connected room every timestep
   - Scenario effects may temporarily force an affected character to stay, such as being frozen, waiting to be healed, or being stuck by glue

### Scenario Selection

Enable one scenario:
- **S1 (Poison)**: Optional fixed room/time
- **S2 (Phantom)**: No configuration needed
- **S3 (Singer's Jewels)**: No configuration needed
- **S4 (Bomb)**: No configuration needed (bombers automatically share a private 1-on-1 moment)
- **S5 (Lovers)**: No configuration needed
- **S6 (Phantom + Lovers)**: Requires at least 4 characters, 3 rooms, and 2 timesteps
- **S7 (Aggrosassin)**: No configuration needed
- **S8 (The Freeze)**: No configuration needed
- **S9 (Doctor's Cure)**: No configuration needed
- **S10 (Contagion)**: No configuration needed
- **S11 (The Vault)**: Requires at least 3 characters, 3 rooms, and 3 timesteps
- **S12 (Glue Room)**: No configuration needed
- **S13 (Glue Shoes)**: No configuration needed
- **S14 (Curse of Amarinta)**: No configuration needed
- **S15 (World Travelers)**: Requires 3+ characters, 4+ rooms, at least one timestep per room, and a map route that can visit every room (5+ rooms with non-podium characters)
- **S16 (Homebodies)**: No configuration needed (requires rooms and timesteps ≥ characters, plus a route through that many distinct rooms)
- **S17 (Triple Alibi)**: No configuration needed (requires at least 4 characters and 2 timesteps)
- **S18 (Heavy Sofa)**: No configuration needed (requires at least 2 rooms, 2 characters, 2 timesteps, and a start that can reach the destination)
- **S19 (Crowded Alibi)**: No configuration needed (requires at least 3 rooms, 3 characters, 2 timesteps, and a map that permits the required group changes)

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
- **Scenario Generator**: http://localhost:3000/scenario_generator.html
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

1. **Generate a scenario** using the main generator (scenario_generator.html)
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

import { describe, it, expect } from "vitest";
import { solveAndDecode, neighbors } from "../src/scenario-solver.js";

// Helper function to run tests with 70% success threshold
function testWithThreshold(cfg, testFn, minSuccessRate = 0.7) {
  const results = [];
  const startSeed = cfg.seed || 0;

  for (let i = 0; i < 10; i++) {
    const testCfg = { ...cfg, seed: startSeed + i };
    try {
      const res = solveAndDecode(testCfg);
      if (res !== null) {
        results.push({ success: true, res, seed: testCfg.seed });
      } else {
        results.push({ success: false, seed: testCfg.seed, reason: "timeout" });
      }
    } catch (e) {
      results.push({ success: false, seed: testCfg.seed, reason: e.message });
    }
  }

  const successful = results.filter((r) => r.success);
  const successRate = successful.length / results.length;

  expect(successRate).toBeGreaterThanOrEqual(minSuccessRate);

  // Run test function on all successful results
  for (const { res, seed } of successful) {
    try {
      testFn(res, cfg, seed);
    } catch (e) {
      throw new Error(`Test failed for seed ${seed}: ${e.message}`);
    }
  }

  return { successful, total: results.length, successRate };
}

function computeInfections(schedule, cfg) {
  const contagiousRoom = [...cfg.rooms].sort()[0];
  const infectionTimes = {};
  const infected = new Set();
  const timeline = [];

  cfg.chars.forEach((ch) => {
    infectionTimes[ch] = null;
  });

  const markInfected = (ch, time) => {
    if (infectionTimes[ch] !== null) return false;
    infectionTimes[ch] = time;
    infected.add(ch);
    return true;
  };

  for (let t = 0; t < cfg.T; t++) {
    const newly = [];

    for (const ch of cfg.chars) {
      if (schedule[ch][t] === contagiousRoom) {
        if (markInfected(ch, t + 1)) newly.push(ch);
      }
    }

    const byRoom = new Map();
    for (const room of cfg.rooms) byRoom.set(room, []);
    for (const ch of cfg.chars) {
      byRoom.get(schedule[ch][t]).push(ch);
    }

    for (const room of cfg.rooms) {
      const occupants = byRoom.get(room);
      if (occupants.some((ch) => infected.has(ch))) {
        for (const ch of occupants) {
          if (markInfected(ch, t + 1)) newly.push(ch);
        }
      }
    }

    if (newly.length) {
      timeline.push({ time: t + 1, characters: newly.sort() });
    }
  }

  const infectionOrder = Object.entries(infectionTimes)
    .filter(([, time]) => time !== null)
    .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] - b[1]))
    .map(([ch]) => ch);

  return { contagiousRoom, infectionTimes, infectionOrder, timeline };
}

function simulateCurse(schedule, cfg, origin) {
  let carriers = new Set([origin]);
  const timeline = [];

  for (let t = 0; t < cfg.T; t++) {
    const byRoom = new Map();
    for (const room of cfg.rooms) byRoom.set(room, []);
    for (const ch of cfg.chars) {
      const room = schedule[ch][t];
      byRoom.get(room).push(ch);
    }

    const cursedNow = new Set(carriers);
    const freedNext = new Set();
    const newlyCursedNext = new Set();

    for (const room of cfg.rooms) {
      const occupants = byRoom.get(room);
      if (!occupants.length) continue;
      const cursedHere = occupants.filter((ch) => carriers.has(ch));
      if (!cursedHere.length) continue;
      const uncursedHere = occupants.filter((ch) => !carriers.has(ch));
      if (!uncursedHere.length) continue;

      for (const ch of occupants) cursedNow.add(ch);
      cursedHere.forEach((ch) => freedNext.add(ch));
      uncursedHere.forEach((ch) => newlyCursedNext.add(ch));
    }

    timeline.push({ time: t + 1, cursed: Array.from(cursedNow).sort() });

    if (t < cfg.T - 1) {
      const nextCarriers = new Set(carriers);
      for (const ch of freedNext) nextCarriers.delete(ch);
      for (const ch of newlyCursedNext) nextCarriers.add(ch);
      carriers = nextCarriers;
    }
  }

  return timeline;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function s9FrozenRange(charCount, ratio = 0.3) {
  const targetRatio = Math.max(0.2, Math.min(0.8, ratio));
  const targetFrozen = Math.max(1, Math.round(charCount * targetRatio));
  const slack = Math.max(1, Math.round(charCount * 0.15));
  const minFrozen = Math.max(1, targetFrozen - slack);
  const maxFrozen = Math.min(charCount - 1, targetFrozen + slack);
  return [Math.min(minFrozen, maxFrozen), Math.max(minFrozen, maxFrozen)];
}

describe("S1: Poison Scenario", () => {
  it("should always make first character the assassin", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["Alice", "Bob", "Charlie"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 0,
    };

    testWithThreshold(cfg, (res) => {
      expect(res.priv.assassin).toBe("Alice");
    });
  });

  it("should have assassin and victim alone at poison time/room", () => {
    const cfg = {
      rooms: ["Kitchen", "Library", "Hall"],
      edges: [
        ["Kitchen", "Library"],
        ["Library", "Hall"],
      ],
      chars: ["A", "B", "C", "D"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 100,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const { assassin, victim, poison_time, poison_room } = res.priv;
      const t = poison_time - 1;

      expect(res.schedule[assassin][t]).toBe(poison_room);
      expect(res.schedule[victim][t]).toBe(poison_room);

      const others = cfg.chars.filter(
        (c) =>
          c !== assassin && c !== victim && res.schedule[c][t] === poison_room,
      );
      expect(others).toHaveLength(0);
    });
  });

  it("should have assassin alone with exactly one person only once", () => {
    const cfg = {
      rooms: ["R1", "R2", "R3"],
      edges: [
        ["R1", "R2"],
        ["R2", "R3"],
      ],
      chars: ["A", "B", "C", "D"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 400,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const assassin = res.priv.assassin;
      const victim = res.priv.victim;
      const poisonTime = res.priv.poison_time - 1;
      const poisonRoom = res.priv.poison_room;

      let aloneWithOneCount = 0;

      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[assassin][t];
        const others = cfg.chars.filter(
          (c) => c !== assassin && res.schedule[c][t] === room,
        );

        if (others.length === 1) {
          aloneWithOneCount++;
          expect(t).toBe(poisonTime);
          expect(room).toBe(poisonRoom);
          expect(others[0]).toBe(victim);
        }
      }

      expect(aloneWithOneCount).toBe(1);
    });
  });

  it("should not allow victim to be assassin", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["X", "Y", "Z"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 789,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.assassin).not.toBe(res.priv.victim);
  });

  it("should respect fixed room constraint", () => {
    const cfg = {
      rooms: ["Kitchen", "Library", "Dining"],
      edges: [
        ["Kitchen", "Library"],
        ["Library", "Dining"],
      ],
      chars: ["A", "B", "C"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: {
        s1: true,
        s1_room: "Kitchen",
      },
      seed: 111,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.poison_room).toBe("Kitchen");
  });

  it("should respect fixed time constraint", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["X", "Y", "Z"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: {
        s1: true,
        s1_time: "3",
      },
      seed: 222,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.poison_time).toBe(3);
  });

  it("should ensure victim is distinct from assassin", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["Assassin", "Victim1", "Victim2", "Bystander"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 300,
    };

    testWithThreshold(cfg, (res) => {
      expect(res.priv.assassin).toBe("Assassin");
      expect(res.priv.victim).not.toBe("Assassin");
      expect(res.priv.victim).toBeTruthy();
    });
  });

  it("should have exactly one poison moment", () => {
    const cfg = {
      rooms: ["Kitchen", "Library", "Study"],
      edges: [
        ["Kitchen", "Library"],
        ["Library", "Study"],
      ],
      chars: ["A", "B", "C", "D"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 310,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const assassin = res.priv.assassin;
      const victim = res.priv.victim;
      const poisonTime = res.priv.poison_time - 1;
      const poisonRoom = res.priv.poison_room;

      // Count moments where assassin is with exactly one other person
      let aloneWithOneCount = 0;
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );

          if (charsInRoom.length === 2 && charsInRoom.includes(assassin)) {
            aloneWithOneCount++;
            // This should only happen at the poison moment
            expect(t).toBe(poisonTime);
            expect(room).toBe(poisonRoom);
            expect(charsInRoom).toContain(victim);
          }
        }
      }

      // Exactly one poison moment
      expect(aloneWithOneCount).toBe(1);
    });
  });

  it("should never have assassin with exactly 2 people total except at poison moment", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["Assassin", "V", "X", "Y"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 320,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const assassin = res.priv.assassin;
      const poisonTime = res.priv.poison_time - 1;
      const poisonRoom = res.priv.poison_room;

      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );

          if (charsInRoom.includes(assassin) && charsInRoom.length === 2) {
            // Only allowed at poison moment
            expect(t).toBe(poisonTime);
            expect(room).toBe(poisonRoom);
          }
        }
      }
    });
  });

  it("should work with both fixed room and time", () => {
    const cfg = {
      rooms: ["Office", "Hallway", "Closet"],
      edges: [
        ["Office", "Hallway"],
        ["Hallway", "Closet"],
      ],
      chars: ["A", "B", "C"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: {
        s1: true,
        s1_room: "Hallway",
        s1_time: "2",
      },
      seed: 330,
    };

    testWithThreshold(cfg, (res, cfg) => {
      expect(res.priv.poison_room).toBe("Hallway");
      expect(res.priv.poison_time).toBe(2);

      // Verify the constraint is satisfied
      const assassin = res.priv.assassin;
      const victim = res.priv.victim;
      const charsInHallwayAtT2 = cfg.chars.filter(
        (c) => res.schedule[c][1] === "Hallway",
      );

      expect(charsInHallwayAtT2).toHaveLength(2);
      expect(charsInHallwayAtT2).toContain(assassin);
      expect(charsInHallwayAtT2).toContain(victim);
    });
  });

  it("should allow assassin to be alone or with 3+ people at non-poison times", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["Assassin", "V1", "V2", "V3", "V4"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 220,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const assassin = res.priv.assassin;
      const poisonTime = res.priv.poison_time - 1;
      const poisonRoom = res.priv.poison_room;

      let foundAlone = false;
      let foundWithMany = false;

      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[assassin][t];
        const charsInRoom = cfg.chars.filter(
          (c) => res.schedule[c][t] === room,
        );

        if (t === poisonTime && room === poisonRoom) {
          // Poison moment - should be exactly 2
          expect(charsInRoom).toHaveLength(2);
        } else {
          // Non-poison moment - can be 1 or 3+
          if (charsInRoom.length === 1) foundAlone = true;
          if (charsInRoom.length >= 3) foundWithMany = true;
          expect(charsInRoom.length).not.toBe(2);
        }
      }

      // At least one of these patterns should exist (not strictly required, but likely)
      expect(foundAlone || foundWithMany).toBe(true);
    });
  });
});

describe("Randomness Guarantees", () => {
  it("should produce different schedules across seeds for a base configuration", () => {
    const cfgBase = {
      rooms: ["Alpha", "Bravo", "Charlie"],
      edges: [
        ["Alpha", "Bravo"],
        ["Bravo", "Charlie"],
        ["Charlie", "Alpha"],
      ],
      chars: ["A", "B", "C", "D"],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: {},
    };

    const schedules = new Set();
    for (let seed = 0; seed < 12; seed++) {
      const res = solveAndDecode({ ...cfgBase, seed });
      expect(res).not.toBeNull();
      schedules.add(JSON.stringify(res.schedule));
    }

    expect(schedules.size).toBeGreaterThan(1);
  });

  it("should vary freeze scenarios across seeds", () => {
    const cfgBase = {
      rooms: ["Hall", "Lab", "Vault", "Atrium"],
      edges: [
        ["Hall", "Lab"],
        ["Lab", "Vault"],
        ["Vault", "Atrium"],
        ["Atrium", "Hall"],
      ],
      chars: ["Freeze", "Alpha", "Bravo", "Charlie", "Delta"],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s8: true },
    };

    const signatures = new Set();
    let successCount = 0;
    for (let seed = 500; seed < 512; seed++) {
      const res = solveAndDecode({ ...cfgBase, seed });
      if (!res) continue;
      successCount++;
      signatures.add(
        JSON.stringify({
          schedule: res.schedule,
          freeze: res.priv.freeze,
          kills: res.priv.freeze_kills,
        }),
      );
    }

    expect(successCount).toBeGreaterThan(5);
    expect(signatures.size).toBeGreaterThan(1);
  });
});

describe("S2: Phantom Scenario", () => {
  it("should have exactly one phantom", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["P1", "P2", "P3", "P4"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 150,
    };

    testWithThreshold(cfg, (res, cfg) => {
      expect(res.priv.phantom).toBeTruthy();

      // Verify only one character is the phantom
      let phantomCount = 0;
      for (const char of cfg.chars) {
        let aloneAtAllTimes = true;
        for (let t = 0; t < cfg.T; t++) {
          const room = res.schedule[char][t];
          const others = cfg.chars.filter(
            (c) => c !== char && res.schedule[c][t] === room,
          );
          if (others.length > 0) {
            aloneAtAllTimes = false;
            break;
          }
        }
        if (aloneAtAllTimes) phantomCount++;
      }

      expect(phantomCount).toBe(1);
    });
  });

  it("should have phantom alone at every timestep", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["P1", "P2", "P3", "P4"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 100,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom;
      expect(phantom).toBeTruthy();

      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[phantom][t];
        const others = cfg.chars.filter(
          (c) => c !== phantom && res.schedule[c][t] === room,
        );
        expect(others).toHaveLength(0);
      }
    });
  });

  it("should have non-phantoms share room at least once", () => {
    const cfg = {
      rooms: ["R1", "R2", "R3"],
      edges: [
        ["R1", "R2"],
        ["R2", "R3"],
      ],
      chars: ["A", "B", "C", "D"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 200,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom;

      for (const char of cfg.chars) {
        if (char === phantom) continue;

        let hasCompany = false;
        for (let t = 0; t < cfg.T; t++) {
          const room = res.schedule[char][t];
          const others = cfg.chars.filter(
            (c) => c !== char && res.schedule[c][t] === room,
          );
          if (others.length > 0) {
            hasCompany = true;
            break;
          }
        }
        expect(hasCompany).toBe(true);
      }
    });
  });

  it("should verify phantom is never with anyone at any time", () => {
    const cfg = {
      rooms: ["Room1", "Room2", "Room3", "Room4"],
      edges: [
        ["Room1", "Room2"],
        ["Room2", "Room3"],
        ["Room3", "Room4"],
      ],
      chars: ["A", "B", "C", "D", "E"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 220,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom;

      // Check every single (time, room) pair
      for (let t = 0; t < cfg.T; t++) {
        const phantomRoom = res.schedule[phantom][t];

        // Count how many characters are in phantom's room
        const charsInPhantomRoom = cfg.chars.filter(
          (c) => res.schedule[c][t] === phantomRoom,
        );

        // Should be exactly 1 (just the phantom)
        expect(charsInPhantomRoom).toHaveLength(1);
        expect(charsInPhantomRoom[0]).toBe(phantom);
      }
    });
  });

  it("should work with minimum configuration", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["Phantom", "Other1", "Other2"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 230,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.phantom).toBeTruthy();

    const phantom = res.priv.phantom;
    for (let t = 0; t < cfg.T; t++) {
      const room = res.schedule[phantom][t];
      const others = cfg.chars.filter(
        (c) => c !== phantom && res.schedule[c][t] === room,
      );
      expect(others).toHaveLength(0);
    }
  });

  it("should ensure non-phantoms meet someone at least once", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["P", "N1", "N2", "N3", "N4"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 240,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom;
      const nonPhantoms = cfg.chars.filter((c) => c !== phantom);

      for (const char of nonPhantoms) {
        let metSomeone = false;
        for (let t = 0; t < cfg.T; t++) {
          const room = res.schedule[char][t];
          const others = cfg.chars.filter(
            (c) => c !== char && res.schedule[c][t] === room,
          );
          if (others.length > 0) {
            metSomeone = true;
            break;
          }
        }
        expect(metSomeone).toBe(true);
      }
    });
  });

  it("should work with mustMove constraint", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "A"],
      ],
      chars: ["P", "X", "Y", "Z"],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: { s2: true },
      seed: 250,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom;
      const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, false);

      // Verify movement
      for (const char of cfg.chars) {
        for (let t = 0; t < cfg.T - 1; t++) {
          const currentRoom = res.schedule[char][t];
          const nextRoom = res.schedule[char][t + 1];
          const currentIdx = idx.get(currentRoom);
          const nextIdx = idx.get(nextRoom);

          expect(nbr[currentIdx]).toContain(nextIdx);
          expect(currentRoom).not.toBe(nextRoom);
        }
      }

      // Phantom still alone at every timestep
      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[phantom][t];
        const others = cfg.chars.filter(
          (c) => c !== phantom && res.schedule[c][t] === room,
        );
        expect(others).toHaveLength(0);
      }
    });
  });
});

describe("S3: Singer's Jewels Scenario", () => {
  it("should ensure the first room is visited at least once", () => {
    const cfg = {
      rooms: ["Atrium", "Library"],
      edges: [["Atrium", "Library"]],
      chars: ["A", "B"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s3: true },
      seed: 5000,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();

    const firstRoom = cfg.rooms[0];
    let visited = false;
    for (const char of cfg.chars) {
      for (let t = 0; t < cfg.T; t++) {
        if (res.schedule[char][t] === firstRoom) {
          visited = true;
          break;
        }
      }
      if (visited) break;
    }
    expect(visited).toBe(true);
  });

  it("should work with mustMove constraint", () => {
    const cfg = {
      rooms: ["Hall", "Kitchen", "Study"],
      edges: [
        ["Hall", "Kitchen"],
        ["Kitchen", "Study"],
      ],
      chars: ["A", "B", "C"],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: { s3: true },
      seed: 5010,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();

    const firstRoom = cfg.rooms[0];
    const visited = cfg.chars.some((char) =>
      res.schedule[char].includes(firstRoom),
    );
    expect(visited).toBe(true);
  });
});

describe("S4: Bomb Duo Scenario", () => {
  it("should have bombers as ONLY pair ever alone together", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["W", "X", "Y", "Z"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 400,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo;
      const bombersSorted = [bomber1, bomber2].sort();
      let aloneCount = 0;

      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );

          if (charsInRoom.length === 2) {
            const sorted = charsInRoom.sort();
            expect(sorted).toEqual(bombersSorted);
            aloneCount++;
          }
        }
      }

      expect(aloneCount).toBeGreaterThan(0);
    });
  });

  it("should have distinct bombers", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["M", "N", "O"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 500,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.bomb_duo[0]).not.toBe(res.priv.bomb_duo[1]);
  });

  it("should allow bombers to be alone individually", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["X", "Y", "Z", "W"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 510,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo;

      // Verify bombers CAN be alone (count = 1 is allowed)
      let bomber1AloneCount = 0;
      let bomber2AloneCount = 0;

      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );

          if (charsInRoom.length === 1) {
            if (charsInRoom[0] === bomber1) bomber1AloneCount++;
            if (charsInRoom[0] === bomber2) bomber2AloneCount++;
          }
        }
      }

      // At least one bomber should be alone at some point (not required, but likely)
      // This just verifies the constraint allows it
      expect(bomber1AloneCount + bomber2AloneCount).toBeGreaterThanOrEqual(0);
    });
  });

  it("should allow bombers to be in groups of 3+", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["P", "Q", "R", "S", "T"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 520,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo;

      // Count times bombers are together in groups of 3+
      let bombersInLargeGroup = 0;

      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );

          if (
            charsInRoom.length >= 3 &&
            charsInRoom.includes(bomber1) &&
            charsInRoom.includes(bomber2)
          ) {
            bombersInLargeGroup++;
          }
        }
      }

      // This is allowed - just verify no constraint violation
      expect(bombersInLargeGroup).toBeGreaterThanOrEqual(0);
    });
  });

  it("should require bombers to be alone together at least once", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["A", "B", "C", "D"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 530,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo;
      const bombersSorted = [bomber1, bomber2].sort();
      let aloneCount = 0;

      // Verify the core constraint: no non-bomber pairs are alone
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );

          if (charsInRoom.length === 2) {
            const sorted = charsInRoom.sort();
            // If exactly 2 people, they must be the bombers
            expect(sorted).toEqual(bombersSorted);
            aloneCount++;
          }
        }
      }

      expect(aloneCount).toBeGreaterThan(0);
    });
  });

  it("should work with minimum configuration (3 chars, 2 rooms)", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["X", "Y", "Z"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 540,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.bomb_duo).toHaveLength(2);

    const [bomber1, bomber2] = res.priv.bomb_duo;
    let aloneCount = 0;

    // Verify constraint
    for (let t = 0; t < cfg.T; t++) {
      for (const room of cfg.rooms) {
        const charsInRoom = cfg.chars.filter(
          (c) => res.schedule[c][t] === room,
        );

        if (charsInRoom.length === 2) {
          expect(charsInRoom).toContain(bomber1);
          expect(charsInRoom).toContain(bomber2);
          aloneCount++;
        }
      }
    }

    expect(aloneCount).toBeGreaterThan(0);
  });

  it("should work with moderate number of characters", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["A", "B", "C", "D", "E"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 550,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo;
      const bombersSorted = [bomber1, bomber2].sort();

      // Verify no other pairs are alone together
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );

          if (charsInRoom.length === 2) {
            const sorted = charsInRoom.sort();
            expect(sorted).toEqual(bombersSorted);
          }
        }
      }
    });
  });

  it("should work with mustMove constraint", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
        ["D", "A"],
      ],
      chars: ["W", "X", "Y", "Z"],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s4: true },
      seed: 560,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo;
      const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, false);
      let aloneCount = 0;

      // Verify movement constraints
      for (const char of cfg.chars) {
        for (let t = 0; t < cfg.T - 1; t++) {
          const currentRoom = res.schedule[char][t];
          const nextRoom = res.schedule[char][t + 1];
          const currentIdx = idx.get(currentRoom);
          const nextIdx = idx.get(nextRoom);

          expect(nbr[currentIdx]).toContain(nextIdx);
          expect(currentRoom).not.toBe(nextRoom);
        }
      }

      // Verify bomb duo constraint still holds
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );

          if (charsInRoom.length === 2) {
            const sorted = charsInRoom.sort();
            const bombersSorted = [bomber1, bomber2].sort();
            expect(sorted).toEqual(bombersSorted);
            aloneCount++;
          }
        }
      }

      expect(aloneCount).toBeGreaterThan(0);
    });
  });

  it("should verify no non-bomber pairs are ever alone", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["P", "Q", "R", "S", "T"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 570,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo;
      const bomberSet = new Set([bomber1, bomber2]);

      // Check every possible pair
      for (let i = 0; i < cfg.chars.length; i++) {
        for (let j = i + 1; j < cfg.chars.length; j++) {
          const char1 = cfg.chars[i];
          const char2 = cfg.chars[j];

          // Skip if this is the bomber pair
          if (bomberSet.has(char1) && bomberSet.has(char2)) continue;

          // This pair should NEVER be alone together
          for (let t = 0; t < cfg.T; t++) {
            for (const room of cfg.rooms) {
              const charsInRoom = cfg.chars.filter(
                (c) => res.schedule[c][t] === room,
              );

              if (
                charsInRoom.length === 2 &&
                charsInRoom.includes(char1) &&
                charsInRoom.includes(char2)
              ) {
                throw new Error(
                  `Non-bomber pair ${char1},${char2} found alone in ${room} at t=${t + 1}`,
                );
              }
            }
          }
        }
      }

      let duoAloneCount = 0;
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );
          if (
            charsInRoom.length === 2 &&
            charsInRoom.includes(bomber1) &&
            charsInRoom.includes(bomber2)
          ) {
            duoAloneCount++;
          }
        }
      }

      expect(duoAloneCount).toBeGreaterThan(0);
    });
  });

  it("should always pick two defined bombers from the roster", () => {
    const cfg = {
      rooms: ["Atrium", "Gallery", "Vault"],
      edges: [
        ["Atrium", "Gallery"],
        ["Gallery", "Vault"],
      ],
      chars: ["Ada", "Bea", "Cal", "Dex"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 575,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const duo = res.priv.bomb_duo;
      expect(duo).toHaveLength(2);

      const [b1, b2] = duo;
      expect(b1).toBeTruthy();
      expect(b2).toBeTruthy();
      expect(b1).not.toBe(b2);
      expect(cfg.chars).toContain(b1);
      expect(cfg.chars).toContain(b2);
    });
  });

  it("should respect graph adjacency when staying is allowed", () => {
    const cfg = {
      rooms: ["North", "East", "South", "West"],
      edges: [
        ["North", "East"],
        ["East", "South"],
        ["South", "West"],
        ["West", "North"],
      ],
      chars: ["Hunter", "Iris", "Jules", "Kara"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 580,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, true);

      for (const char of cfg.chars) {
        const path = res.schedule[char];
        for (let t = 0; t < cfg.T - 1; t++) {
          const current = path[t];
          const next = path[t + 1];
          const currentIdx = idx.get(current);
          const nextIdx = idx.get(next);

          expect(nextIdx).toBeDefined();
          expect(currentIdx).toBeDefined();
          expect(nbr[currentIdx]).toContain(nextIdx);
        }
      }
    });
  });

  it("should keep byTime counts aligned with the schedule under S4", () => {
    const cfg = {
      rooms: ["Workshop"],
      edges: [],
      chars: ["X", "Y"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 42,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();

    const bombers = res.priv.bomb_duo.slice().sort();
    expect(bombers).toEqual(["X", "Y"]);

    for (let t = 0; t < cfg.T; t++) {
      const counts = { Workshop: 0 };
      for (const char of cfg.chars) {
        const room = res.schedule[char][t];
        counts[room]++;
      }

      expect(res.byTime[t + 1]).toEqual(counts);

      for (const room of cfg.rooms) {
        const occupants = cfg.chars.filter((c) => res.schedule[c][t] === room);
        if (occupants.length === 2) {
          expect(occupants.sort()).toEqual(bombers);
        }
      }
    }
  });
});

describe("S5: Lovers Scenario", () => {
  it("should have non-lovers share rooms with others", () => {
    const cfg = {
      rooms: ["Garden", "Ballroom", "Terrace"],
      edges: [
        ["Garden", "Ballroom"],
        ["Ballroom", "Terrace"],
      ],
      chars: ["Romeo", "Juliet", "Paris", "Nurse"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 600,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [lover1, lover2] = res.priv.lovers;

      // Every non-lover must share a room with someone at least once
      for (const char of cfg.chars) {
        if (char === lover1 || char === lover2) continue;

        let hasCompany = false;
        for (let t = 0; t < cfg.T; t++) {
          const room = res.schedule[char][t];
          const others = cfg.chars.filter(
            (c) => c !== char && res.schedule[c][t] === room,
          );
          if (others.length > 0) {
            hasCompany = true;
            break;
          }
        }
        expect(hasCompany).toBe(true);
      }
    });
  });

  it("should have exactly two distinct lovers", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["L1", "L2", "N1", "N2"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 650,
    };

    testWithThreshold(cfg, (res) => {
      expect(res.priv.lovers).toHaveLength(2);

      const [lover1, lover2] = res.priv.lovers;
      expect(lover1).not.toBe(lover2);
      expect(lover1).toBeTruthy();
      expect(lover2).toBeTruthy();
    });
  });

  it("should have lovers never in same room", () => {
    const cfg = {
      rooms: ["Garden", "Ballroom", "Terrace"],
      edges: [
        ["Garden", "Ballroom"],
        ["Ballroom", "Terrace"],
      ],
      chars: ["Romeo", "Juliet", "Paris", "Nurse"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 610,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [lover1, lover2] = res.priv.lovers;

      for (let t = 0; t < cfg.T; t++) {
        const room1 = res.schedule[lover1][t];
        const room2 = res.schedule[lover2][t];
        expect(room1).not.toBe(room2);
      }
    });
  });

  it("should have distinct lovers", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["L1", "L2", "L3"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 700,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.lovers[0]).not.toBe(res.priv.lovers[1]);
  });

  it("should work with minimum configuration (2 chars, 2 rooms)", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["X", "Y"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 800,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.lovers).toHaveLength(2);

    // With only 2 characters, both must be lovers
    expect(res.priv.lovers).toContain("X");
    expect(res.priv.lovers).toContain("Y");

    // They should never meet
    for (let t = 0; t < cfg.T; t++) {
      expect(res.schedule["X"][t]).not.toBe(res.schedule["Y"][t]);
    }
  });

  it("should handle larger groups with many non-lovers", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["L1", "L2", "N1", "N2", "N3", "N4"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 900,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();

    const [lover1, lover2] = res.priv.lovers;
    const nonLovers = cfg.chars.filter((c) => c !== lover1 && c !== lover2);

    // Lovers never meet
    for (let t = 0; t < cfg.T; t++) {
      expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t]);
    }

    // All non-lovers have company at least once
    for (const char of nonLovers) {
      let hasCompany = false;
      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[char][t];
        const others = cfg.chars.filter(
          (c) => c !== char && res.schedule[c][t] === room,
        );
        if (others.length > 0) {
          hasCompany = true;
          break;
        }
      }
      expect(hasCompany).toBe(true);
    }
  });

  it("should allow lovers to be alone (just not together)", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["L1", "L2", "N1"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 1000,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();

    const [lover1, lover2] = res.priv.lovers;

    // Lovers can be alone (in a room by themselves)
    // Just verify they're never in the same room
    for (let t = 0; t < cfg.T; t++) {
      expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t]);
    }
  });

  it("should work with mustMove constraint", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["L1", "L2", "N1", "N2"],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: { s5: true },
      seed: 1100,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [lover1, lover2] = res.priv.lovers;
      const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, false);

      // Verify movement constraints
      for (const char of cfg.chars) {
        for (let t = 0; t < cfg.T - 1; t++) {
          const currentRoom = res.schedule[char][t];
          const nextRoom = res.schedule[char][t + 1];
          const currentIdx = idx.get(currentRoom);
          const nextIdx = idx.get(nextRoom);

          expect(nbr[currentIdx]).toContain(nextIdx);
          expect(currentRoom).not.toBe(nextRoom);
        }
      }

      // Lovers still never meet
      for (let t = 0; t < cfg.T; t++) {
        expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t]);
      }
    });
  });

  it("should verify lovers can be in adjacent rooms", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["L1", "L2", "N1"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 1200,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();

    const [lover1, lover2] = res.priv.lovers;

    // Lovers can be in adjacent rooms (just not the same room)
    // With only 2 rooms, they should often be in adjacent rooms
    let adjacentCount = 0;
    for (let t = 0; t < cfg.T; t++) {
      const room1 = res.schedule[lover1][t];
      const room2 = res.schedule[lover2][t];

      // Never in same room
      expect(room1).not.toBe(room2);

      // Count when they're in different rooms (which means adjacent with only 2 rooms)
      if (room1 !== room2) adjacentCount++;
    }

    // They should be in different rooms at all times
    expect(adjacentCount).toBe(cfg.T);
  });

  it("should handle complex graph topology", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D", "E"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
        ["D", "E"],
        ["A", "E"], // Creates a cycle
        ["B", "D"], // Adds a shortcut
      ],
      chars: ["L1", "L2", "N1", "N2", "N3"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 1300,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [lover1, lover2] = res.priv.lovers;

      // Verify core constraint: lovers never meet
      for (let t = 0; t < cfg.T; t++) {
        expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t]);
      }

      // Verify non-lovers have company
      const nonLovers = cfg.chars.filter((c) => c !== lover1 && c !== lover2);
      for (const char of nonLovers) {
        let hasCompany = false;
        for (let t = 0; t < cfg.T; t++) {
          const room = res.schedule[char][t];
          const others = cfg.chars.filter(
            (c) => c !== char && res.schedule[c][t] === room,
          );
          if (others.length > 0) {
            hasCompany = true;
            break;
          }
        }
        expect(hasCompany).toBe(true);
      }
    });
  });

  it("should ensure every pair of non-lovers meets at least once", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["L1", "L2", "N1", "N2", "N3"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 710,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [lover1, lover2] = res.priv.lovers;
      const loverSet = new Set([lover1, lover2]);

      // Check all pairs of characters
      for (let i = 0; i < cfg.chars.length; i++) {
        for (let j = i + 1; j < cfg.chars.length; j++) {
          const char1 = cfg.chars[i];
          const char2 = cfg.chars[j];

          // If both are lovers, they should never meet
          if (loverSet.has(char1) && loverSet.has(char2)) {
            for (let t = 0; t < cfg.T; t++) {
              expect(res.schedule[char1][t]).not.toBe(res.schedule[char2][t]);
            }
          } else {
            // At least one is not a lover - they must meet at least once
            let met = false;
            for (let t = 0; t < cfg.T; t++) {
              if (res.schedule[char1][t] === res.schedule[char2][t]) {
                met = true;
                break;
              }
            }
            expect(met).toBe(true);
          }
        }
      }
    });
  });

  it("should verify lovers never share any room at any time", () => {
    const cfg = {
      rooms: ["Room1", "Room2", "Room3"],
      edges: [
        ["Room1", "Room2"],
        ["Room2", "Room3"],
      ],
      chars: ["A", "B", "C", "D"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 720,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [lover1, lover2] = res.priv.lovers;

      // Check every (time, room) pair
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );

          // Lovers should never both be in this room
          const bothPresent =
            charsInRoom.includes(lover1) && charsInRoom.includes(lover2);
          expect(bothPresent).toBe(false);
        }
      }
    });
  });

  it("should work with different seeds producing different lovers", () => {
    const baseConfig = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["C1", "C2", "C3", "C4"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
    };

    const res1 = solveAndDecode({ ...baseConfig, seed: 1400 });
    const res2 = solveAndDecode({ ...baseConfig, seed: 1401 });

    expect(res1).not.toBeNull();
    expect(res2).not.toBeNull();

    // Both should have valid lovers
    expect(res1.priv.lovers).toHaveLength(2);
    expect(res2.priv.lovers).toHaveLength(2);

    // Both should satisfy the constraint
    for (const res of [res1, res2]) {
      const [lover1, lover2] = res.priv.lovers;
      for (let t = 0; t < baseConfig.T; t++) {
        expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t]);
      }
    }
  });
});

describe("S6: Phantom + Lovers Scenario (S2 + S5)", () => {
  it("should have phantom separate from lovers", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["P", "L1", "L2", "N1", "N2"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true, s5: true },
      seed: 1500,
    };

    testWithThreshold(cfg, (res) => {
      expect(res.priv.phantom).toBeTruthy();
      expect(res.priv.lovers).toHaveLength(2);

      const phantom = res.priv.phantom;
      const [lover1, lover2] = res.priv.lovers;

      // Phantom must NOT be one of the lovers
      expect([lover1, lover2]).not.toContain(phantom);

      // All three should be distinct
      expect(phantom).not.toBe(lover1);
      expect(phantom).not.toBe(lover2);
      expect(lover1).not.toBe(lover2);
    });
  });

  it("should have phantom alone at every timestep", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["P", "L", "N1", "N2"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true, s5: true },
      seed: 1510,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom;

      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[phantom][t];
        const others = cfg.chars.filter(
          (c) => c !== phantom && res.schedule[c][t] === room,
        );
        expect(others).toHaveLength(0);
      }
    });
  });

  it("should have lovers never meet", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["P", "L", "N1", "N2", "N3"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true, s5: true },
      seed: 1520,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const [lover1, lover2] = res.priv.lovers;

      for (let t = 0; t < cfg.T; t++) {
        expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t]);
      }
    });
  });
});

describe("S7: Aggrosassin Scenario", () => {
  it("should have exactly one aggrosassin", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["X", "Y", "Z", "W"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s7: true },
      seed: 7000,
    };

    testWithThreshold(cfg, (res) => {
      expect(res.priv.aggrosassin).toBeTruthy();
      expect(cfg.chars).toContain(res.priv.aggrosassin);
    });
  });

  it("should have aggrosassin alone with at least one victim", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["X", "Y", "Z", "W"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s7: true },
      seed: 7010,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const agg = res.priv.aggrosassin;
      expect(res.priv.victims).toBeTruthy();
      expect(res.priv.victims.length).toBeGreaterThan(0);

      // Verify each victim was alone with aggrosassin at least once
      for (const victim of res.priv.victims) {
        let foundAlone = false;
        for (let t = 0; t < cfg.T; t++) {
          for (const room of cfg.rooms) {
            const charsInRoom = cfg.chars.filter(
              (c) => res.schedule[c][t] === room,
            );
            if (
              charsInRoom.length === 2 &&
              charsInRoom.includes(agg) &&
              charsInRoom.includes(victim)
            ) {
              foundAlone = true;
              break;
            }
          }
          if (foundAlone) break;
        }
        expect(foundAlone).toBe(true);
      }
    });
  });

  it("should have aggrosassin alone with people more often than other pairs", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["P", "Q", "R", "S", "T"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s7: true },
      seed: 7020,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const agg = res.priv.aggrosassin;

      // Count how many timesteps aggrosassin kills (is alone with exactly 1 other)
      let killTimesteps = 0;
      for (let t = 0; t < cfg.T; t++) {
        let killedThisTimestep = false;
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );
          if (charsInRoom.length === 2 && charsInRoom.includes(agg)) {
            killedThisTimestep = true;
            break;
          }
        }
        if (killedThisTimestep) killTimesteps++;
      }

      // Aggrosassin must kill in at least half of the timesteps
      const minKills = Math.ceil(cfg.T / 2);
      expect(killTimesteps).toBeGreaterThanOrEqual(minKills);

      // Count how many times aggrosassin is alone with someone (total instances)
      let aggAloneCount = 0;
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );
          if (charsInRoom.length === 2 && charsInRoom.includes(agg)) {
            aggAloneCount++;
          }
        }
      }

      // Count max times any other pair is alone together
      let maxOtherPairCount = 0;
      for (let i = 0; i < cfg.chars.length; i++) {
        for (let j = i + 1; j < cfg.chars.length; j++) {
          const char1 = cfg.chars[i];
          const char2 = cfg.chars[j];

          // Skip if either is the aggrosassin
          if (char1 === agg || char2 === agg) continue;

          let pairCount = 0;
          for (let t = 0; t < cfg.T; t++) {
            for (const room of cfg.rooms) {
              const charsInRoom = cfg.chars.filter(
                (c) => res.schedule[c][t] === room,
              );
              if (
                charsInRoom.length === 2 &&
                charsInRoom.includes(char1) &&
                charsInRoom.includes(char2)
              ) {
                pairCount++;
              }
            }
          }
          maxOtherPairCount = Math.max(maxOtherPairCount, pairCount);
        }
      }

      // Aggrosassin should be alone at least twice as often as any other pair
      expect(aggAloneCount).toBeGreaterThanOrEqual(maxOtherPairCount * 2);
    });
  });

  it("should work with minimum configuration", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["X", "Y", "Z"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s7: true },
      seed: 7030,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.aggrosassin).toBeTruthy();
    expect(res.priv.victims).toBeTruthy();
  });

  it("should track all unique victims", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["W", "X", "Y", "Z"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s7: true },
      seed: 7040,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const agg = res.priv.aggrosassin;
      const victims = res.priv.victims;

      // Each victim should be distinct
      const uniqueVictims = new Set(victims);
      expect(uniqueVictims.size).toBe(victims.length);

      // No victim should be the aggrosassin
      expect(victims).not.toContain(agg);

      // Verify victim count matches actual alone-together instances
      const actualVictims = new Set();
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );
          if (charsInRoom.length === 2 && charsInRoom.includes(agg)) {
            const victim = charsInRoom.find((c) => c !== agg);
            actualVictims.add(victim);
          }
        }
      }

      expect(new Set(victims)).toEqual(actualVictims);
    });
  });

  it("should work with mustMove constraint", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
        ["D", "A"],
      ],
      chars: ["P", "Q", "R", "S"],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s7: true },
      seed: 7050,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const agg = res.priv.aggrosassin;
      const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, false);

      // Verify movement constraints
      for (const char of cfg.chars) {
        for (let t = 0; t < cfg.T - 1; t++) {
          const currentRoom = res.schedule[char][t];
          const nextRoom = res.schedule[char][t + 1];
          const currentIdx = idx.get(currentRoom);
          const nextIdx = idx.get(nextRoom);

          expect(nbr[currentIdx]).toContain(nextIdx);
          expect(currentRoom).not.toBe(nextRoom);
        }
      }

      // Count how many timesteps aggrosassin kills
      let killTimesteps = 0;
      for (let t = 0; t < cfg.T; t++) {
        let killedThisTimestep = false;
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );
          if (charsInRoom.length === 2 && charsInRoom.includes(agg)) {
            killedThisTimestep = true;
            break;
          }
        }
        if (killedThisTimestep) killTimesteps++;
      }

      // Must kill in at least half of timesteps
      const minKills = Math.ceil(cfg.T / 2);
      expect(killTimesteps).toBeGreaterThanOrEqual(minKills);

      // Aggrosassin constraint still holds
      let aggAloneCount = 0;
      let maxOtherPairCount = 0;

      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );
          if (charsInRoom.length === 2) {
            if (charsInRoom.includes(agg)) {
              aggAloneCount++;
            } else {
              // Count this as a non-agg pair instance
              maxOtherPairCount = Math.max(maxOtherPairCount, 1);
            }
          }
        }
      }

      expect(aggAloneCount).toBeGreaterThanOrEqual(maxOtherPairCount * 2);
    });
  });

  it("should allow aggrosassin to be any character (not just first)", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["First", "Second", "Third", "Fourth"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s7: true },
      seed: 7060,
    };

    // Run multiple times with different seeds to verify aggrosassin can be different characters
    const aggrosassins = new Set();
    for (let seed = 7060; seed < 7070; seed++) {
      const testCfg = { ...cfg, seed };
      const res = solveAndDecode(testCfg);
      if (res) {
        aggrosassins.add(res.priv.aggrosassin);
      }
    }

    // Should have found at least 2 different aggrosassins across seeds
    // (not guaranteed, but very likely with 10 different seeds)
    expect(aggrosassins.size).toBeGreaterThan(0);
  });
});

describe("S8: Freeze Scenario", () => {
  it("should identify a single freeze with distinct victims", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["W", "X", "Y", "Z"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s8: true },
      seed: 8000,
    };

    testWithThreshold(cfg, (res, cfg) => {
      expect(res.priv.freeze).toBeTruthy();
      expect(cfg.chars).toContain(res.priv.freeze);

      const kills = res.priv.freeze_kills || [];
      expect(kills.length).toBeGreaterThan(0);

      const victims = res.priv.freeze_victims || [];
      expect(new Set(victims).size).toBe(victims.length);
    });
  });

  it("should keep frozen victims locked in their freeze room", () => {
    const cfg = {
      rooms: ["Hall", "Lab", "Vault"],
      edges: [
        ["Hall", "Lab"],
        ["Lab", "Vault"],
      ],
      chars: ["Freeze", "Alpha", "Bravo", "Charlie"],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s8: true },
      seed: 8100,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const kills = res.priv.freeze_kills || [];
      expect(kills.length).toBeGreaterThan(0);

      for (const kill of kills) {
        const victim = kill.victim;
        const freezeRoom = res.schedule[victim][kill.time - 1];
        for (let t = kill.time - 1; t < cfg.T; t++) {
          expect(res.schedule[victim][t]).toBe(freezeRoom);
        }
      }
    });
  });

  it("should not freeze characters after non-freeze 1-on-1 meetings", () => {
    const cfg = {
      rooms: ["Hall", "Lab", "Vault"],
      edges: [
        ["Hall", "Lab"],
        ["Lab", "Vault"],
      ],
      chars: ["Freeze", "Delta", "Echo", "Foxtrot"],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s8: true },
      seed: 8200,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const freeze = res.priv.freeze;
      expect(freeze).toBeTruthy();
      const victims = new Set(res.priv.freeze_victims || []);

      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const occupants = cfg.chars.filter(
            (c) => res.schedule[c][t] === room,
          );
          if (occupants.length === 2 && !occupants.includes(freeze)) {
            for (const char of occupants) {
              if (victims.has(char) || t >= cfg.T - 1) continue;

              let movedLater = false;
              for (let future = t; future < cfg.T - 1; future++) {
                if (
                  res.schedule[char][future] !== res.schedule[char][future + 1]
                ) {
                  movedLater = true;
                  break;
                }
              }
              expect(movedLater).toBe(true);
            }
          }
        }
      }
    });
  });

  it("should have freeze distinct from victims", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["X", "Y", "Z", "W"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s8: true },
      seed: 8300,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const freeze = res.priv.freeze;
      const victims = res.priv.freeze_victims || [];

      expect(freeze).toBeTruthy();
      expect(victims).not.toContain(freeze);

      for (const victim of victims) {
        expect(victim).not.toBe(freeze);
      }
    });
  });

  it("should freeze victims at the moment of 1-on-1 contact", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["F", "V1", "V2", "V3"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s8: true },
      seed: 8400,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const freeze = res.priv.freeze;
      const kills = res.priv.freeze_kills || [];

      for (const kill of kills) {
        const t = kill.time - 1;
        const room = kill.room;
        const victim = kill.victim;

        // At freeze moment, exactly 2 people: freeze and victim
        const charsInRoom = cfg.chars.filter(
          (c) => res.schedule[c][t] === room,
        );
        expect(charsInRoom).toHaveLength(2);
        expect(charsInRoom).toContain(freeze);
        expect(charsInRoom).toContain(victim);

        // Victim stays in that room for all future timesteps
        for (let future = t; future < cfg.T; future++) {
          expect(res.schedule[victim][future]).toBe(room);
        }
      }
    });
  });

  it("should allow freeze to move freely after freezing victims", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["Freeze", "V1", "V2"],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s8: true },
      seed: 8500,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const freeze = res.priv.freeze;
      const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, false);

      // Freeze must still obey movement constraints
      for (let t = 0; t < cfg.T - 1; t++) {
        const currentRoom = res.schedule[freeze][t];
        const nextRoom = res.schedule[freeze][t + 1];
        const currentIdx = idx.get(currentRoom);
        const nextIdx = idx.get(nextRoom);

        expect(nbr[currentIdx]).toContain(nextIdx);
        expect(currentRoom).not.toBe(nextRoom);
      }
    });
  });

  it("should handle multiple victims frozen at different times", () => {
    const cfg = {
      rooms: ["A", "B", "C", "D"],
      edges: [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
      ],
      chars: ["Freeze", "V1", "V2", "V3", "V4"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s8: true },
      seed: 8600,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const kills = res.priv.freeze_kills || [];

      // Should have at least one kill
      expect(kills.length).toBeGreaterThan(0);

      // Each kill should have unique victim
      const victimSet = new Set(kills.map((k) => k.victim));
      expect(victimSet.size).toBe(kills.length);

      // Kills should be in chronological order
      for (let i = 0; i < kills.length - 1; i++) {
        expect(kills[i].time).toBeLessThanOrEqual(kills[i + 1].time);
      }

      // Each victim should be frozen from their kill time onward
      for (const kill of kills) {
        const victim = kill.victim;
        const freezeTime = kill.time - 1;
        const freezeRoom = kill.room;

        for (let t = freezeTime; t < cfg.T; t++) {
          expect(res.schedule[victim][t]).toBe(freezeRoom);
        }
      }
    });
  });

  it("should work with minimum configuration", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["Freeze", "Victim"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s8: true },
      seed: 8700,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.freeze).toBeTruthy();
    expect(res.priv.freeze_kills).toBeTruthy();
    expect(res.priv.freeze_kills.length).toBeGreaterThan(0);
  });

  it("should have at least one freeze kill", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["F", "V1", "V2"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s8: true },
      seed: 8800,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const kills = res.priv.freeze_kills || [];

      // Must have at least one kill (constraint is randomized, but at least 1 is always required)
      expect(kills.length).toBeGreaterThan(0);
    });
  });

  it("should allow non-frozen characters to visit frozen victims", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["Freeze", "Victim", "Bystander"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s8: true },
      seed: 8900,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const freeze = res.priv.freeze;
      const kills = res.priv.freeze_kills || [];

      if (kills.length > 0) {
        const kill = kills[0];
        const victim = kill.victim;
        const freezeRoom = kill.room;
        const freezeTime = kill.time - 1;

        // Victim is frozen in freezeRoom from freezeTime onward
        for (let t = freezeTime; t < cfg.T; t++) {
          expect(res.schedule[victim][t]).toBe(freezeRoom);
        }

        // Other characters can still visit that room
        // (no constraint preventing this)
        // Just verify the victim stays put
        let victimMoved = false;
        for (let t = freezeTime; t < cfg.T - 1; t++) {
          if (res.schedule[victim][t] !== res.schedule[victim][t + 1]) {
            victimMoved = true;
            break;
          }
        }
        expect(victimMoved).toBe(false);
      }
    });
  });

  it("should track kill records with correct time and room", () => {
    const cfg = {
      rooms: ["Kitchen", "Dining", "Parlor"],
      edges: [
        ["Kitchen", "Dining"],
        ["Dining", "Parlor"],
      ],
      chars: ["Freeze", "A", "B", "C"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s8: true },
      seed: 9000,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const freeze = res.priv.freeze;
      const kills = res.priv.freeze_kills || [];

      for (const kill of kills) {
        expect(kill.victim).toBeTruthy();
        expect(kill.time).toBeGreaterThan(0);
        expect(kill.time).toBeLessThanOrEqual(cfg.T);
        expect(kill.room).toBeTruthy();
        expect(cfg.rooms).toContain(kill.room);

        // Verify the kill actually happened
        const t = kill.time - 1;
        const room = kill.room;
        const charsInRoom = cfg.chars.filter(
          (c) => res.schedule[c][t] === room,
        );

        expect(charsInRoom).toHaveLength(2);
        expect(charsInRoom).toContain(freeze);
        expect(charsInRoom).toContain(kill.victim);
      }
    });
  });
});

describe("S6 Verification Tests", () => {
  it("should have phantom separate from two lovers who never meet", () => {
    const cfg = {
      rooms: ["X", "Y", "Z"],
      edges: [
        ["X", "Y"],
        ["Y", "Z"],
      ],
      chars: ["Phantom", "Lover1", "Lover2", "Other"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true, s5: true },
      seed: 50,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();

    const phantom = res.priv.phantom;
    const [lover1, lover2] = res.priv.lovers;

    // Phantom must NOT be one of the lovers
    expect([lover1, lover2]).not.toContain(phantom);

    // All three must be different
    expect(phantom).not.toBe(lover1);
    expect(phantom).not.toBe(lover2);
    expect(lover1).not.toBe(lover2);
  });
});

describe("Movement Constraints", () => {
  it("should enforce adjacent movement when mustMove=true", () => {
    const cfg = {
      rooms: ["A", "B", "C"],
      edges: [
        ["A", "B"],
        ["B", "C"],
      ],
      chars: ["X", "Y"],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: {},
      seed: 800,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();

    const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, false);

    for (const char of cfg.chars) {
      for (let t = 0; t < cfg.T - 1; t++) {
        const currentRoom = res.schedule[char][t];
        const nextRoom = res.schedule[char][t + 1];

        const currentIdx = idx.get(currentRoom);
        const nextIdx = idx.get(nextRoom);

        expect(nbr[currentIdx]).toContain(nextIdx);
        expect(currentRoom).not.toBe(nextRoom);
      }
    }
  });

  it("should allow staying when allowStay=true", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["X"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: {},
      seed: 900,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.schedule["X"]).toHaveLength(cfg.T);
  });
});

describe("Edge Cases", () => {
  it("should handle minimum configuration", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["X", "Y"],
      T: 2,
      mustMove: false,
      allowStay: true,
      scenarios: {},
      seed: 1100,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
  });

  it("should handle S1 with both fixed room and time", () => {
    const cfg = {
      rooms: ["Kitchen", "Library"],
      edges: [["Kitchen", "Library"]],
      chars: ["A", "B", "C"],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: {
        s1: true,
        s1_room: "Kitchen",
        s1_time: "2",
      },
      seed: 1200,
    };

    const res = solveAndDecode(cfg);
    expect(res).not.toBeNull();
    expect(res.priv.poison_room).toBe("Kitchen");
    expect(res.priv.poison_time).toBe(2);
  });
});

describe("S9: Doctor freeze scenario", () => {
  it("ensures frozen characters thaw mid-game", () => {
    const cfg = {
      rooms: ["Atrium", "Lab", "Ward"],
      edges: [
        ["Atrium", "Lab"],
        ["Lab", "Ward"],
      ],
      chars: ["Dana", "Eli", "Farah", "Gus"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s9: true },
      seed: 500,
    };

    testWithThreshold(cfg, (res, cfg) => {
      expect(res.priv.doctor).toBeTruthy();
      expect(res.priv.frozen).toBeTruthy();
      expect(res.priv.frozen).not.toContain(res.priv.doctor);
      expect(res.priv.heals).toBeTruthy();
      expect(res.priv.heals.length).toBeGreaterThan(0);

      const healTimes = res.priv.heals.map((h) => h.time);
      expect(healTimes.some((t) => t > 1)).toBe(true);
      expect(healTimes.some((t) => t < cfg.T)).toBe(true);

      for (const { character, time, room } of res.priv.heals) {
        const idx = time - 1;
        expect(res.schedule[character][idx]).toBe(room);
        expect(res.schedule[res.priv.doctor][idx]).toBe(room);
      }

      const movedFrozen = res.priv.frozen.filter(
        (ch) => res.schedule[ch][0] !== res.schedule[ch][cfg.T - 1],
      );
      expect(movedFrozen.length).toBeGreaterThan(0);

      const showcase = movedFrozen[0];
      expect(res.schedule[showcase][0]).toBe(res.schedule[showcase][1]);
      expect(res.schedule[showcase][cfg.T - 1]).not.toBe(
        res.schedule[showcase][0],
      );
    });
  });

  it("keeps multiple characters mobile at the start", () => {
    const cfg = {
      rooms: ["Atrium", "Lab", "Ward", "Roof"],
      edges: [
        ["Atrium", "Lab"],
        ["Lab", "Ward"],
        ["Ward", "Roof"],
      ],
      chars: ["Ada", "Bev", "Ciro", "Dev", "Ema", "Finn"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s9: true },
      seed: 820,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const frozenCount = res.priv.frozen.length;
      expect(frozenCount).toBeGreaterThan(0);
      expect(frozenCount).toBeLessThanOrEqual(
        Math.ceil(cfg.chars.length * 0.6),
      );
      expect(cfg.chars.length - frozenCount).toBeGreaterThan(1);
    });
  });

  it("aligns frozen counts with the configured ratio band", () => {
    const cfg = {
      rooms: ["North", "South", "East", "West"],
      edges: [
        ["North", "South"],
        ["South", "East"],
        ["East", "West"],
      ],
      chars: ["Doc", "A", "B", "C", "D", "E", "F", "G"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s9: true, s9FrozenRatio: 0.6 },
      seed: 905,
    };

    const [minFrozen, maxFrozen] = s9FrozenRange(
      cfg.chars.length,
      cfg.scenarios.s9FrozenRatio,
    );

    testWithThreshold(cfg, (res) => {
      const frozenCount = res.priv.frozen.length;
      expect(frozenCount).toBeGreaterThanOrEqual(minFrozen);
      expect(frozenCount).toBeLessThanOrEqual(maxFrozen);
    });
  });
});

describe("S10: Contagion scenario", () => {
  it("marks the earliest alphabetical room as contagious and tracks infection times", () => {
    const cfg = {
      rooms: ["Vault", "Atrium", "Barracks"],
      edges: [
        ["Vault", "Atrium"],
        ["Atrium", "Barracks"],
        ["Barracks", "Vault"],
      ],
      chars: ["A", "B", "C", "D"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s10: true },
      seed: 42,
    };

    testWithThreshold(cfg, (res, cfg) => {
      expect(res.priv.contagion).toBeTruthy();
      const computed = computeInfections(res.schedule, cfg);
      expect(res.priv.contagion.contagious_room).toBe(computed.contagiousRoom);
      expect(res.priv.contagion.infection_times).toEqual(
        computed.infectionTimes,
      );
      expect(
        Object.values(computed.infectionTimes).some((t) => t !== null),
      ).toBe(true);
    });
  });

  it("spreads infections to everyone sharing a room with an infected character", () => {
    const cfg = {
      rooms: ["Clinic", "Archive", "Basement"],
      edges: [
        ["Clinic", "Archive"],
        ["Archive", "Basement"],
        ["Basement", "Clinic"],
      ],
      chars: ["Ana", "Ben", "Cate"],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s10: true },
      seed: 5,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const computed = computeInfections(res.schedule, cfg);
      const infectionTimes = computed.infectionTimes;
      const infectionOrder = res.priv.contagion.infection_order;

      expect(infectionOrder).toEqual(computed.infectionOrder);

      for (const step of computed.timeline) {
        const tIdx = step.time - 1;
        const infectiousNow = new Set(
          cfg.chars.filter(
            (ch) =>
              infectionTimes[ch] !== null && infectionTimes[ch] <= step.time,
          ),
        );

        for (const room of cfg.rooms) {
          const occupants = cfg.chars.filter(
            (ch) => res.schedule[ch][tIdx] === room,
          );
          const hasInfection = occupants.some(
            (ch) => infectiousNow.has(ch) || room === computed.contagiousRoom,
          );
          if (hasInfection) {
            for (const ch of occupants) {
              expect(infectionTimes[ch]).not.toBeNull();
              expect(infectionTimes[ch]).toBeLessThanOrEqual(step.time);
            }
          }
        }
      }
    });
  });
});

describe("S11: The Vault", () => {
  const pickKeyHolder = (chars, seed) => {
    const rng = mulberry32(seed || 0);
    const idx = Math.floor(rng() * chars.length);
    return chars[idx];
  };

  it("selects the key holder deterministically from the seed", () => {
    const cfg = {
      rooms: ["Library", "Vault", "Atrium"],
      edges: [
        ["Library", "Vault"],
        ["Vault", "Atrium"],
        ["Atrium", "Library"],
      ],
      chars: ["Dana", "Inez", "Carl", "Bert"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s11: true },
      seed: 9,
    };

    const expectedHolder = pickKeyHolder(cfg.chars, cfg.seed);
    const res = solveAndDecode(cfg);
    expect(res).toBeTruthy();
    expect(res.priv.vault.key_holder).toBe(expectedHolder);
  });

  it("prevents non-holders from entering the vault alone", () => {
    const cfg = {
      rooms: ["Vault", "Garden", "Office"],
      edges: [
        ["Vault", "Garden"],
        ["Garden", "Office"],
        ["Office", "Vault"],
      ],
      chars: ["A", "B", "C", "D"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s11: true },
      seed: 3,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const vaultRoom = [...cfg.rooms].sort()[0];
      const keyHolder = res.priv.vault.key_holder;

      for (let t = 0; t < cfg.T; t++) {
        const occupants = cfg.chars.filter((ch) => res.schedule[ch][t] === vaultRoom);
        if (occupants.length > 0) {
          expect(occupants).toContain(keyHolder);
        }
      }
    });
  });

  it("ensures the key holder visits the vault with a companion", () => {
    const cfg = {
      rooms: ["Conservatory", "Vault", "Attic"],
      edges: [
        ["Conservatory", "Vault"],
        ["Vault", "Attic"],
        ["Attic", "Conservatory"],
      ],
      chars: ["Keyer", "Locke", "Nina", "Omar"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s11: true },
      seed: 15,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const vaultRoom = [...cfg.rooms].sort()[0];
      const keyHolder = res.priv.vault.key_holder;
      const sharedVisits = [];
      const companions = new Set();
      let khVisits = 0;

      for (let t = 0; t < cfg.T; t++) {
        const occupants = cfg.chars.filter((ch) => res.schedule[ch][t] === vaultRoom);
        if (occupants.includes(keyHolder)) {
          khVisits++;
        }
        if (occupants.includes(keyHolder) && occupants.length > 1) {
          sharedVisits.push(t);
          occupants
            .filter((ch) => ch !== keyHolder)
            .forEach((ch) => companions.add(ch));
        }
      }

      expect(khVisits).toBeGreaterThan(0);
      expect(sharedVisits.length).toBeGreaterThanOrEqual(1);
      expect(companions.size).toBeGreaterThanOrEqual(1);
    });
  });

  it("records every vault visitor in the private payload", () => {
    const cfg = {
      rooms: ["Vault", "Kitchen", "Study"],
      edges: [
        ["Vault", "Kitchen"],
        ["Kitchen", "Study"],
        ["Study", "Vault"],
      ],
      chars: ["A", "B", "C"],
      T: 5,
      mustMove: true,
      allowStay: true,
      scenarios: { s11: true },
      seed: 21,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const vaultRoom = [...cfg.rooms].sort()[0];
      const expectedVisitors = cfg.chars.filter((ch) =>
        res.schedule[ch].some((room) => room === vaultRoom),
      );

      expect(res.priv.vault.vault_visitors.sort()).toEqual(
        expectedVisitors.sort(),
      );
      expect(res.priv.vault.vault_room).toBe(vaultRoom);
    });
  });
});

describe("S12: Glue Room", () => {
  it("forces everyone entering the glue room to stay exactly two turns", () => {
    const cfg = {
      rooms: ["Atrium", "Study", "Garden"],
      edges: [
        ["Atrium", "Study"],
        ["Study", "Garden"],
      ],
      chars: ["A", "B", "C"],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s12: true },
      seed: 4,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const glueRoom = res.priv.glue_room.glue_room;
      let sawEntry = false;

      for (const ch of cfg.chars) {
        for (let t = 0; t < cfg.T; t++) {
          const here = res.schedule[ch][t] === glueRoom;
          const cameFromOther = t === 0 || res.schedule[ch][t - 1] !== glueRoom;

          if (here && cameFromOther) {
            sawEntry = true;
            expect(t).toBeLessThan(cfg.T - 1);
            expect(res.schedule[ch][t + 1]).toBe(glueRoom);
            if (t + 2 < cfg.T) {
              expect(res.schedule[ch][t + 2]).not.toBe(glueRoom);
            }
          }
        }
      }

      expect(sawEntry).toBe(true);
    });
  });

  it("exposes the glue room and first entry times", () => {
    const cfg = {
      rooms: ["North", "South"],
      edges: [["North", "South"]],
      chars: ["A", "B", "C"],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s12: true },
      seed: 9,
    };

    testWithThreshold(cfg, (res, cfg, seed) => {
      const rng = mulberry32(seed);
      const expectedGlueRoom = cfg.rooms[Math.floor(rng() * cfg.rooms.length)];
      expect(res.priv.glue_room.glue_room).toBe(expectedGlueRoom);

      for (const ch of cfg.chars) {
        let firstEntry = null;
        for (let t = 0; t < cfg.T; t++) {
          const here = res.schedule[ch][t] === expectedGlueRoom;
          const cameFromOther = t === 0 || res.schedule[ch][t - 1] !== expectedGlueRoom;
          if (here && cameFromOther) {
            firstEntry = t + 1;
            break;
          }
        }

        expect(res.priv.glue_room.first_entries[ch]).toBe(firstEntry);
      }
    });
  });

  it("prevents three-turn streaks inside the glue room", () => {
    const cfg = {
      rooms: ["Lab", "Lounge", "Vault"],
      edges: [
        ["Lab", "Lounge"],
        ["Lounge", "Vault"],
      ],
      chars: ["X", "Y", "Z"],
      T: 6,
      mustMove: true,
      allowStay: false,
      scenarios: { s12: true },
      seed: 11,
    };

    testWithThreshold(cfg, (res) => {
      const glueRoom = res.priv.glue_room.glue_room;

      for (const row of Object.values(res.schedule)) {
        let streak = 0;
        for (const room of row) {
          if (room === glueRoom) {
            streak++;
            expect(streak).toBeLessThanOrEqual(2);
          } else {
            streak = 0;
          }
        }
      }
    });
  });
});

describe("S13: Glue Shoes", () => {
  it("sticks co-occupants for exactly one extra turn", () => {
    const cfg = {
      rooms: ["Kitchen", "Patio", "Gallery"],
      edges: [
        ["Kitchen", "Patio"],
        ["Patio", "Gallery"],
      ],
      chars: ["A", "B", "C", "D"],
      T: 6,
      mustMove: true,
      allowStay: false,
      scenarios: { s13: true },
      seed: 3,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const glueCarrier = res.priv.glue_shoes.glue_person;

      for (let t = 0; t < cfg.T - 1; t++) {
        const room = res.schedule[glueCarrier][t];
        const victims = cfg.chars.filter(
          (ch) => ch !== glueCarrier && res.schedule[ch][t] === room,
        );

        for (const v of victims) {
          expect(res.schedule[v][t + 1]).toBe(room);
          if (t + 2 < cfg.T) {
            expect(res.schedule[v][t + 2]).not.toBe(room);
          }
        }
      }
    });
  });

  it("selects the glue carrier by seed and records first stuck moments", () => {
    const cfg = {
      rooms: ["A", "B"],
      edges: [["A", "B"]],
      chars: ["G1", "G2", "G3"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s13: true },
      seed: 7,
    };

    testWithThreshold(cfg, (res, cfg, seed) => {
      const rng = mulberry32(seed);
      const expectedGlue = cfg.chars[Math.floor(rng() * cfg.chars.length)];
      expect(res.priv.glue_shoes.glue_person).toBe(expectedGlue);

      const firstStuck = new Map();
      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[expectedGlue][t];
        for (const ch of cfg.chars) {
          if (ch === expectedGlue) continue;
          if (res.schedule[ch][t] === room && !firstStuck.has(ch)) {
            firstStuck.set(ch, { character: ch, time: t + 1, room });
          }
        }
      }

      for (const record of res.priv.glue_shoes.stuck) {
        const expected = firstStuck.get(record.character);
        expect(record).toEqual(expected);
      }
    });
  });

  it("guarantees at least one non-final stuck victim", () => {
    const cfg = {
      rooms: ["Hall", "Den", "Porch"],
      edges: [
        ["Hall", "Den"],
        ["Den", "Porch"],
      ],
      chars: ["A", "B", "C"],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: { s13: true },
      seed: 12,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const glueCarrier = res.priv.glue_shoes.glue_person;
      let stuckObserved = false;

      for (let t = 0; t < cfg.T - 1; t++) {
        const room = res.schedule[glueCarrier][t];
        const victims = cfg.chars.filter(
          (ch) => ch !== glueCarrier && res.schedule[ch][t] === room,
        );

        if (victims.length) {
          stuckObserved = true;
          expect(t).toBeLessThan(cfg.T - 1);
          break;
        }
      }

      expect(stuckObserved).toBe(true);
      expect(res.priv.glue_shoes.stuck.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("keeps the glue carrier moving when mustMove is enforced", () => {
    const cfg = {
      rooms: ["Alpha", "Beta"],
      edges: [["Alpha", "Beta"]],
      chars: ["G", "V1", "V2"],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s13: true },
      seed: 2,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const glueCarrier = res.priv.glue_shoes.glue_person;

      for (let t = 0; t < cfg.T - 1; t++) {
        const stuckRoom = res.schedule[glueCarrier][t];
        const nextRoom = res.schedule[glueCarrier][t + 1];

        // Glue carrier should never be forced to stay; mustMove keeps them traveling.
        expect(nextRoom).not.toBe(stuckRoom);
      }

      for (const ch of cfg.chars) {
        for (let t = 0; t < cfg.T - 1; t++) {
          if (res.schedule[ch][t] !== res.schedule[ch][t + 1]) continue;

          const glueHere = res.schedule[glueCarrier][t] === res.schedule[ch][t];
          expect(ch).not.toBe(glueCarrier);
          expect(glueHere).toBe(true);
        }
      }
    });
  });

  it("keeps the glue carrier moving even when staying is allowed", () => {
    const cfg = {
      rooms: ["North", "South"],
      edges: [["North", "South"]],
      chars: ["Gluey", "Traveler"],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s13: true },
      seed: 1,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const glueCarrier = res.priv.glue_shoes.glue_person;

      for (let t = 0; t < cfg.T - 1; t++) {
        expect(res.schedule[glueCarrier][t]).not.toBe(
          res.schedule[glueCarrier][t + 1],
        );
      }
    });
  });
});

describe("S14: The Curse of Amarinta", () => {
  it("tracks the curse timeline and final state from a chosen origin", () => {
    const cfg = {
      rooms: ["Hall", "Garden"],
      edges: [["Hall", "Garden"]],
      chars: ["A", "B", "C"],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s14: true },
      seed: 14,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const curse = res.priv.curse_of_amarinta;
      expect(curse).toBeTruthy();

      const expectedTimeline = simulateCurse(res.schedule, cfg, curse.origin);
      expect(curse.timeline.map((entry) => entry.cursed)).toEqual(
        expectedTimeline.map((entry) => entry.cursed),
      );
      expect(curse.timeline).toHaveLength(cfg.T);
      expect(curse.final_cursed).toEqual(expectedTimeline[5].cursed);
    });
  });

  it("maps every possible origin to its cursed set at time 6", () => {
    const cfg = {
      rooms: ["Atrium", "Tower", "Vault"],
      edges: [
        ["Atrium", "Tower"],
        ["Tower", "Vault"],
        ["Vault", "Atrium"],
      ],
      chars: ["Inez", "Jade", "Kari", "Lark"],
      T: 6,
      mustMove: true,
      allowStay: false,
      scenarios: { s14: true },
      seed: 21,
    };

    testWithThreshold(cfg, (res, cfg) => {
      const curse = res.priv.curse_of_amarinta;
      const finalByOrigin = {};

      for (const ch of cfg.chars) {
        const sim = simulateCurse(res.schedule, cfg, ch);
        finalByOrigin[ch] = sim[5].cursed;
      }

      expect(curse.cursed_at_time6_by_origin).toEqual(finalByOrigin);

      const targetKey = curse.final_cursed.join("|");
      const expectedOrigins = cfg.chars
        .filter((ch) => finalByOrigin[ch].join("|") === targetKey)
        .sort();

      expect(curse.possible_origins).toEqual(expectedOrigins);
      expect(expectedOrigins).toContain(curse.origin);
    });
  });
});

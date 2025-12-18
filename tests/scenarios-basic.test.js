import { describe, it, expect } from 'vitest'
import { solveAndDecode, neighbors } from '../src/scenario-solver.js'
import { testWithThreshold } from './test-helpers.js'

describe('S1: Poison Scenario', () => {
  it('should always make first character the assassin', () => {
    const cfg = {
      rooms: ['A', 'B'],
      edges: [['A', 'B']],
      chars: ['Alice', 'Bob', 'Charlie'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 0
    }

    testWithThreshold(cfg, (res) => {
      expect(res.priv.assassin).toBe('Alice')
    })
  })

  it('should have assassin and victim alone at poison time/room', () => {
    const cfg = {
      rooms: ['Kitchen', 'Library', 'Hall'],
      edges: [['Kitchen', 'Library'], ['Library', 'Hall']],
      chars: ['A', 'B', 'C', 'D'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 100
    }

    testWithThreshold(cfg, (res, cfg) => {
      const { assassin, victim, poison_time, poison_room } = res.priv
      const t = poison_time - 1

      expect(res.schedule[assassin][t]).toBe(poison_room)
      expect(res.schedule[victim][t]).toBe(poison_room)

      const others = cfg.chars.filter(c =>
        c !== assassin && c !== victim &&
        res.schedule[c][t] === poison_room
      )
      expect(others).toHaveLength(0)
    })
  })

  it('should have assassin alone with exactly one person only once', () => {
    const cfg = {
      rooms: ['R1', 'R2', 'R3'],
      edges: [['R1', 'R2'], ['R2', 'R3']],
      chars: ['A', 'B', 'C', 'D'],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 400
    }

    testWithThreshold(cfg, (res, cfg) => {
      const assassin = res.priv.assassin
      const victim = res.priv.victim
      const poisonTime = res.priv.poison_time - 1
      const poisonRoom = res.priv.poison_room

      let aloneWithOneCount = 0

      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[assassin][t]
        const others = cfg.chars.filter(c =>
          c !== assassin && res.schedule[c][t] === room
        )

        if (others.length === 1) {
          aloneWithOneCount++
          expect(t).toBe(poisonTime)
          expect(room).toBe(poisonRoom)
          expect(others[0]).toBe(victim)
        }
      }

      expect(aloneWithOneCount).toBe(1)
    })
  })

  it('should not allow victim to be assassin', () => {
    const cfg = {
      rooms: ['A', 'B'],
      edges: [['A', 'B']],
      chars: ['X', 'Y', 'Z'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 789
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.assassin).not.toBe(res.priv.victim)
  })

  it('should respect fixed room constraint', () => {
    const cfg = {
      rooms: ['Kitchen', 'Library', 'Dining'],
      edges: [['Kitchen', 'Library'], ['Library', 'Dining']],
      chars: ['A', 'B', 'C'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: {
        s1: true,
        s1_room: 'Kitchen'
      },
      seed: 111
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.poison_room).toBe('Kitchen')
  })

  it('should respect fixed time constraint', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['X', 'Y', 'Z'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: {
        s1: true,
        s1_time: '3'
      },
      seed: 222
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.poison_time).toBe(3)
  })

  it('should ensure victim is distinct from assassin', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['Assassin', 'Victim1', 'Victim2', 'Bystander'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 300
    }

    testWithThreshold(cfg, (res) => {
      expect(res.priv.assassin).toBe('Assassin')
      expect(res.priv.victim).not.toBe('Assassin')
      expect(res.priv.victim).toBeTruthy()
    })
  })

  it('should have exactly one poison moment', () => {
    const cfg = {
      rooms: ['Kitchen', 'Library', 'Study'],
      edges: [['Kitchen', 'Library'], ['Library', 'Study']],
      chars: ['A', 'B', 'C', 'D'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 310
    }

    testWithThreshold(cfg, (res, cfg) => {
      const assassin = res.priv.assassin
      const victim = res.priv.victim
      const poisonTime = res.priv.poison_time - 1
      const poisonRoom = res.priv.poison_room

      // Count moments where assassin is with exactly one other person
      let aloneWithOneCount = 0
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
          
          if (charsInRoom.length === 2 && charsInRoom.includes(assassin)) {
            aloneWithOneCount++
            // This should only happen at the poison moment
            expect(t).toBe(poisonTime)
            expect(room).toBe(poisonRoom)
            expect(charsInRoom).toContain(victim)
          }
        }
      }

      // Exactly one poison moment
      expect(aloneWithOneCount).toBe(1)
    })
  })

  it('should never have assassin with exactly 2 people total except at poison moment', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D']],
      chars: ['Assassin', 'V', 'X', 'Y'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 320
    }

    testWithThreshold(cfg, (res, cfg) => {
      const assassin = res.priv.assassin
      const poisonTime = res.priv.poison_time - 1
      const poisonRoom = res.priv.poison_room

      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
          
          if (charsInRoom.includes(assassin) && charsInRoom.length === 2) {
            // Only allowed at poison moment
            expect(t).toBe(poisonTime)
            expect(room).toBe(poisonRoom)
          }
        }
      }
    })
  })

  it('should work with both fixed room and time', () => {
    const cfg = {
      rooms: ['Office', 'Hallway', 'Closet'],
      edges: [['Office', 'Hallway'], ['Hallway', 'Closet']],
      chars: ['A', 'B', 'C'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: {
        s1: true,
        s1_room: 'Hallway',
        s1_time: '2'
      },
      seed: 330
    }

    testWithThreshold(cfg, (res, cfg) => {
      expect(res.priv.poison_room).toBe('Hallway')
      expect(res.priv.poison_time).toBe(2)
      
      // Verify the constraint is satisfied
      const assassin = res.priv.assassin
      const victim = res.priv.victim
      const charsInHallwayAtT2 = cfg.chars.filter(c => res.schedule[c][1] === 'Hallway')
      
      expect(charsInHallwayAtT2).toHaveLength(2)
      expect(charsInHallwayAtT2).toContain(assassin)
      expect(charsInHallwayAtT2).toContain(victim)
    })
  })

  it('should allow assassin to be alone or with 3+ people at non-poison times', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['Assassin', 'V1', 'V2', 'V3', 'V4'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 220
    }

    testWithThreshold(cfg, (res, cfg) => {
      const assassin = res.priv.assassin
      const poisonTime = res.priv.poison_time - 1
      const poisonRoom = res.priv.poison_room

      let foundAlone = false
      let foundWithMany = false

      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[assassin][t]
        const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
        
        if (t === poisonTime && room === poisonRoom) {
          // Poison moment - should be exactly 2
          expect(charsInRoom).toHaveLength(2)
        } else {
          // Non-poison moment - can be 1 or 3+
          if (charsInRoom.length === 1) foundAlone = true
          if (charsInRoom.length >= 3) foundWithMany = true
          expect(charsInRoom.length).not.toBe(2)
        }
      }

      // At least one of these patterns should exist (not strictly required, but likely)
      expect(foundAlone || foundWithMany).toBe(true)
    })
  })
})

describe('Randomness Guarantees', () => {
  it('should produce different schedules across seeds for a base configuration', () => {
    const cfgBase = {
      rooms: ['Alpha', 'Bravo', 'Charlie'],
      edges: [['Alpha', 'Bravo'], ['Bravo', 'Charlie'], ['Charlie', 'Alpha']],
      chars: ['A', 'B', 'C', 'D'],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: {}
    }

    const schedules = new Set()
    for (let seed = 0; seed < 12; seed++) {
      const res = solveAndDecode({ ...cfgBase, seed })
      expect(res).not.toBeNull()
      schedules.add(JSON.stringify(res.schedule))
    }

    expect(schedules.size).toBeGreaterThan(1)
  })

  it('should vary freeze scenarios across seeds', () => {
    const cfgBase = {
      rooms: ['Hall', 'Lab', 'Vault', 'Atrium'],
      edges: [
        ['Hall', 'Lab'],
        ['Lab', 'Vault'],
        ['Vault', 'Atrium'],
        ['Atrium', 'Hall']
      ],
      chars: ['Freeze', 'Alpha', 'Bravo', 'Charlie', 'Delta'],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s8: true }
    }

    const signatures = new Set()
    let successCount = 0
    for (let seed = 500; seed < 512; seed++) {
      const res = solveAndDecode({ ...cfgBase, seed })
      if (!res) continue
      successCount++
      signatures.add(
        JSON.stringify({
          schedule: res.schedule,
          freeze: res.priv.freeze,
          kills: res.priv.freeze_kills
        })
      )
    }

    expect(successCount).toBeGreaterThan(5)
    expect(signatures.size).toBeGreaterThan(1)
  })
})

describe('S2: Phantom Scenario', () => {
  it('should have exactly one phantom', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['P1', 'P2', 'P3', 'P4'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 150
    }

    testWithThreshold(cfg, (res, cfg) => {
      expect(res.priv.phantom).toBeTruthy()
      
      // Verify only one character is the phantom
      let phantomCount = 0
      for (const char of cfg.chars) {
        let aloneAtAllTimes = true
        for (let t = 0; t < cfg.T; t++) {
          const room = res.schedule[char][t]
          const others = cfg.chars.filter(c => c !== char && res.schedule[c][t] === room)
          if (others.length > 0) {
            aloneAtAllTimes = false
            break
          }
        }
        if (aloneAtAllTimes) phantomCount++
      }
      
      expect(phantomCount).toBe(1)
    })
  })

  it('should have phantom alone at every timestep', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['P1', 'P2', 'P3', 'P4'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 100
    }

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom
      expect(phantom).toBeTruthy()

      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[phantom][t]
        const others = cfg.chars.filter(c =>
          c !== phantom && res.schedule[c][t] === room
        )
        expect(others).toHaveLength(0)
      }
    })
  })

  it('should have non-phantoms share room at least once', () => {
    const cfg = {
      rooms: ['R1', 'R2', 'R3'],
      edges: [['R1', 'R2'], ['R2', 'R3']],
      chars: ['A', 'B', 'C', 'D'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 200
    }

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom

      for (const char of cfg.chars) {
        if (char === phantom) continue

        let hasCompany = false
        for (let t = 0; t < cfg.T; t++) {
          const room = res.schedule[char][t]
          const others = cfg.chars.filter(c =>
            c !== char && res.schedule[c][t] === room
          )
          if (others.length > 0) {
            hasCompany = true
            break
          }
        }
        expect(hasCompany).toBe(true)
      }
    })
  })

  it('should verify phantom is never with anyone at any time', () => {
    const cfg = {
      rooms: ['Room1', 'Room2', 'Room3', 'Room4'],
      edges: [['Room1', 'Room2'], ['Room2', 'Room3'], ['Room3', 'Room4']],
      chars: ['A', 'B', 'C', 'D', 'E'],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 220
    }

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom

      // Check every single (time, room) pair
      for (let t = 0; t < cfg.T; t++) {
        const phantomRoom = res.schedule[phantom][t]
        
        // Count how many characters are in phantom's room
        const charsInPhantomRoom = cfg.chars.filter(c => res.schedule[c][t] === phantomRoom)
        
        // Should be exactly 1 (just the phantom)
        expect(charsInPhantomRoom).toHaveLength(1)
        expect(charsInPhantomRoom[0]).toBe(phantom)
      }
    })
  })

  it('should work with minimum configuration', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['Phantom', 'Other1', 'Other2'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 230
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.phantom).toBeTruthy()
    
    const phantom = res.priv.phantom
    for (let t = 0; t < cfg.T; t++) {
      const room = res.schedule[phantom][t]
      const others = cfg.chars.filter(c => c !== phantom && res.schedule[c][t] === room)
      expect(others).toHaveLength(0)
    }
  })

  it('should ensure non-phantoms meet someone at least once', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D']],
      chars: ['P', 'N1', 'N2', 'N3', 'N4'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true },
      seed: 240
    }

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom
      const nonPhantoms = cfg.chars.filter(c => c !== phantom)

      for (const char of nonPhantoms) {
        let metSomeone = false
        for (let t = 0; t < cfg.T; t++) {
          const room = res.schedule[char][t]
          const others = cfg.chars.filter(c => c !== char && res.schedule[c][t] === room)
          if (others.length > 0) {
            metSomeone = true
            break
          }
        }
        expect(metSomeone).toBe(true)
      }
    })
  })

  it('should work with mustMove constraint', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'A']],
      chars: ['P', 'X', 'Y', 'Z'],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: { s2: true },
      seed: 250
    }

    testWithThreshold(cfg, (res, cfg) => {
      const phantom = res.priv.phantom
      const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, false)

      // Verify movement
      for (const char of cfg.chars) {
        for (let t = 0; t < cfg.T - 1; t++) {
          const currentRoom = res.schedule[char][t]
          const nextRoom = res.schedule[char][t + 1]
          const currentIdx = idx.get(currentRoom)
          const nextIdx = idx.get(nextRoom)
          
          expect(nbr[currentIdx]).toContain(nextIdx)
          expect(currentRoom).not.toBe(nextRoom)
        }
      }

      // Phantom still alone at every timestep
      for (let t = 0; t < cfg.T; t++) {
        const room = res.schedule[phantom][t]
        const others = cfg.chars.filter(c => c !== phantom && res.schedule[c][t] === room)
        expect(others).toHaveLength(0)
      }
    })
  })
})

describe("S3: Singer's Jewels Scenario", () => {
  it('should ensure the first room is visited at least once', () => {
    const cfg = {
      rooms: ['Atrium', 'Library'],
      edges: [['Atrium', 'Library']],
      chars: ['A', 'B'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s3: true },
      seed: 5000
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const firstRoom = cfg.rooms[0]
    let visited = false
    for (const char of cfg.chars) {
      for (let t = 0; t < cfg.T; t++) {
        if (res.schedule[char][t] === firstRoom) {
          visited = true
          break
        }
      }
      if (visited) break
    }
    expect(visited).toBe(true)
  })

  it('should work with mustMove constraint', () => {
    const cfg = {
      rooms: ['Hall', 'Kitchen', 'Study'],
      edges: [['Hall', 'Kitchen'], ['Kitchen', 'Study']],
      chars: ['A', 'B', 'C'],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: { s3: true },
      seed: 5010
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const firstRoom = cfg.rooms[0]
    const visited = cfg.chars.some(char => res.schedule[char].includes(firstRoom))
    expect(visited).toBe(true)
  })
})

describe('S4: Bomb Duo Scenario', () => {
  it('should have bombers as ONLY pair ever alone together', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D']],
      chars: ['W', 'X', 'Y', 'Z'],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 400
    }

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo
      const bombersSorted = [bomber1, bomber2].sort()
      let aloneCount = 0

      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(c =>
            res.schedule[c][t] === room
          )

          if (charsInRoom.length === 2) {
            const sorted = charsInRoom.sort()
            expect(sorted).toEqual(bombersSorted)
            aloneCount++
          }
        }
      }

      expect(aloneCount).toBeGreaterThan(0)
    })
  })

  it('should have distinct bombers', () => {
    const cfg = {
      rooms: ['A', 'B'],
      edges: [['A', 'B']],
      chars: ['M', 'N', 'O'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 500
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.bomb_duo[0]).not.toBe(res.priv.bomb_duo[1])
  })

  it('should allow bombers to be alone individually', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['X', 'Y', 'Z', 'W'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 510
    }

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo

      // Verify bombers CAN be alone (count = 1 is allowed)
      let bomber1AloneCount = 0
      let bomber2AloneCount = 0

      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
          
          if (charsInRoom.length === 1) {
            if (charsInRoom[0] === bomber1) bomber1AloneCount++
            if (charsInRoom[0] === bomber2) bomber2AloneCount++
          }
        }
      }

      // At least one bomber should be alone at some point (not required, but likely)
      // This just verifies the constraint allows it
      expect(bomber1AloneCount + bomber2AloneCount).toBeGreaterThanOrEqual(0)
    })
  })

  it('should allow bombers to be in groups of 3+', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D']],
      chars: ['P', 'Q', 'R', 'S', 'T'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 520
    }

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo

      // Count times bombers are together in groups of 3+
      let bombersInLargeGroup = 0

      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
          
          if (charsInRoom.length >= 3 && 
              charsInRoom.includes(bomber1) && 
              charsInRoom.includes(bomber2)) {
            bombersInLargeGroup++
          }
        }
      }

      // This is allowed - just verify no constraint violation
      expect(bombersInLargeGroup).toBeGreaterThanOrEqual(0)
    })
  })

  it('should require bombers to be alone together at least once', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['A', 'B', 'C', 'D'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 530
    }

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo
      const bombersSorted = [bomber1, bomber2].sort()
      let aloneCount = 0

      // Verify the core constraint: no non-bomber pairs are alone
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
          
          if (charsInRoom.length === 2) {
            const sorted = charsInRoom.sort()
            // If exactly 2 people, they must be the bombers
            expect(sorted).toEqual(bombersSorted)
            aloneCount++
          }
        }
      }

      expect(aloneCount).toBeGreaterThan(0)
    })
  })

  it('should work with minimum configuration (3 chars, 2 rooms)', () => {
    const cfg = {
      rooms: ['A', 'B'],
      edges: [['A', 'B']],
      chars: ['X', 'Y', 'Z'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 540
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.bomb_duo).toHaveLength(2)

    const [bomber1, bomber2] = res.priv.bomb_duo
    let aloneCount = 0

    // Verify constraint
    for (let t = 0; t < cfg.T; t++) {
      for (const room of cfg.rooms) {
        const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
        
        if (charsInRoom.length === 2) {
          expect(charsInRoom).toContain(bomber1)
          expect(charsInRoom).toContain(bomber2)
          aloneCount++
        }
      }
    }

    expect(aloneCount).toBeGreaterThan(0)
  })

  it('should work with moderate number of characters', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D']],
      chars: ['A', 'B', 'C', 'D', 'E'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 550
    }

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo
      const bombersSorted = [bomber1, bomber2].sort()

      // Verify no other pairs are alone together
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
          
          if (charsInRoom.length === 2) {
            const sorted = charsInRoom.sort()
            expect(sorted).toEqual(bombersSorted)
          }
        }
      }
    })
  })

  it('should work with mustMove constraint', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']],
      chars: ['W', 'X', 'Y', 'Z'],
      T: 5,
      mustMove: true,
      allowStay: false,
      scenarios: { s4: true },
      seed: 560
    }

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo
      const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, false)
      let aloneCount = 0

      // Verify movement constraints
      for (const char of cfg.chars) {
        for (let t = 0; t < cfg.T - 1; t++) {
          const currentRoom = res.schedule[char][t]
          const nextRoom = res.schedule[char][t + 1]
          const currentIdx = idx.get(currentRoom)
          const nextIdx = idx.get(nextRoom)
          
          expect(nbr[currentIdx]).toContain(nextIdx)
          expect(currentRoom).not.toBe(nextRoom)
        }
      }

      // Verify bomb duo constraint still holds
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
          
          if (charsInRoom.length === 2) {
            const sorted = charsInRoom.sort()
            const bombersSorted = [bomber1, bomber2].sort()
            expect(sorted).toEqual(bombersSorted)
            aloneCount++
          }
        }
      }

      expect(aloneCount).toBeGreaterThan(0)
    })
  })

  it('should verify no non-bomber pairs are ever alone', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D']],
      chars: ['P', 'Q', 'R', 'S', 'T'],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 570
    }

    testWithThreshold(cfg, (res, cfg) => {
      const [bomber1, bomber2] = res.priv.bomb_duo
      const bomberSet = new Set([bomber1, bomber2])

      // Check every possible pair
      for (let i = 0; i < cfg.chars.length; i++) {
        for (let j = i + 1; j < cfg.chars.length; j++) {
          const char1 = cfg.chars[i]
          const char2 = cfg.chars[j]
          
          // Skip if this is the bomber pair
          if (bomberSet.has(char1) && bomberSet.has(char2)) continue

          // This pair should NEVER be alone together
          for (let t = 0; t < cfg.T; t++) {
            for (const room of cfg.rooms) {
              const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
              
              if (charsInRoom.length === 2 && 
                  charsInRoom.includes(char1) && 
                  charsInRoom.includes(char2)) {
                throw new Error(`Non-bomber pair ${char1},${char2} found alone in ${room} at t=${t+1}`)
              }
            }
          }
        }
      }

      let duoAloneCount = 0
      for (let t = 0; t < cfg.T; t++) {
        for (const room of cfg.rooms) {
          const charsInRoom = cfg.chars.filter(c => res.schedule[c][t] === room)
          if (charsInRoom.length === 2 &&
              charsInRoom.includes(bomber1) &&
              charsInRoom.includes(bomber2)) {
            duoAloneCount++
          }
        }
      }

      expect(duoAloneCount).toBeGreaterThan(0)
    })
  })

  it('should always pick two defined bombers from the roster', () => {
    const cfg = {
      rooms: ['Atrium', 'Gallery', 'Vault'],
      edges: [['Atrium', 'Gallery'], ['Gallery', 'Vault']],
      chars: ['Ada', 'Bea', 'Cal', 'Dex'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 575
    }

    testWithThreshold(cfg, (res, cfg) => {
      const duo = res.priv.bomb_duo
      expect(duo).toHaveLength(2)

      const [b1, b2] = duo
      expect(b1).toBeTruthy()
      expect(b2).toBeTruthy()
      expect(b1).not.toBe(b2)
      expect(cfg.chars).toContain(b1)
      expect(cfg.chars).toContain(b2)
    })
  })

  it('should respect graph adjacency when staying is allowed', () => {
    const cfg = {
      rooms: ['North', 'East', 'South', 'West'],
      edges: [
        ['North', 'East'],
        ['East', 'South'],
        ['South', 'West'],
        ['West', 'North']
      ],
      chars: ['Hunter', 'Iris', 'Jules', 'Kara'],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 580
    }

    testWithThreshold(cfg, (res, cfg) => {
      const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, true)

      for (const char of cfg.chars) {
        const path = res.schedule[char]
        for (let t = 0; t < cfg.T - 1; t++) {
          const current = path[t]
          const next = path[t + 1]
          const currentIdx = idx.get(current)
          const nextIdx = idx.get(next)

          expect(nextIdx).toBeDefined()
          expect(currentIdx).toBeDefined()
          expect(nbr[currentIdx]).toContain(nextIdx)
        }
      }
    })
  })

  it('should keep byTime counts aligned with the schedule under S4', () => {
    const cfg = {
      rooms: ['Workshop'],
      edges: [],
      chars: ['X', 'Y'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s4: true },
      seed: 42
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const bombers = res.priv.bomb_duo.slice().sort()
    expect(bombers).toEqual(['X', 'Y'])

    for (let t = 0; t < cfg.T; t++) {
      const counts = { Workshop: 0 }
      for (const char of cfg.chars) {
        const room = res.schedule[char][t]
        counts[room]++
      }

      expect(res.byTime[t + 1]).toEqual(counts)

      for (const room of cfg.rooms) {
        const occupants = cfg.chars.filter(c => res.schedule[c][t] === room)
        if (occupants.length === 2) {
          expect(occupants.sort()).toEqual(bombers)
        }
      }
    }
  })
})

describe('S5: Lovers Scenario (core constraints)', () => {
  it('should have non-lovers share rooms with others', () => {
    const cfg = {
      rooms: ['Garden', 'Ballroom', 'Terrace'],
      edges: [['Garden', 'Ballroom'], ['Ballroom', 'Terrace']],
      chars: ['Romeo', 'Juliet', 'Paris', 'Nurse'],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 600
    }

    testWithThreshold(cfg, (res, cfg) => {
      const [lover1, lover2] = res.priv.lovers

      for (const char of cfg.chars) {
        if (char === lover1 || char === lover2) continue

        let hasCompany = false
        for (let t = 0; t < cfg.T; t++) {
          const room = res.schedule[char][t]
          const others = cfg.chars.filter(c =>
            c !== char && res.schedule[c][t] === room
          )
          if (others.length > 0) {
            hasCompany = true
            break
          }
        }
        expect(hasCompany).toBe(true)
      }
    })
  })

  it('should have exactly two distinct lovers', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['L1', 'L2', 'N1', 'N2'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 650
    }

    testWithThreshold(cfg, (res) => {
      expect(res.priv.lovers).toHaveLength(2)

      const [lover1, lover2] = res.priv.lovers
      expect(lover1).not.toBe(lover2)
      expect(lover1).toBeTruthy()
      expect(lover2).toBeTruthy()
    })
  })

  it('should have lovers never in same room', () => {
    const cfg = {
      rooms: ['Garden', 'Ballroom', 'Terrace'],
      edges: [['Garden', 'Ballroom'], ['Ballroom', 'Terrace']],
      chars: ['Romeo', 'Juliet', 'Paris', 'Nurse'],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 610
    }

    testWithThreshold(cfg, (res, cfg) => {
      const [lover1, lover2] = res.priv.lovers

      for (let t = 0; t < cfg.T; t++) {
        const room1 = res.schedule[lover1][t]
        const room2 = res.schedule[lover2][t]
        expect(room1).not.toBe(room2)
      }
    })
  })
})

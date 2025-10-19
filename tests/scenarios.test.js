import { describe, it, expect } from 'vitest'
import { solveAndDecode, neighbors } from '../src/scenario-solver.js'

describe('S1: Poison Scenario', () => {
  it('should make first character the assassin', () => {
    const cfg = {
      rooms: ['A', 'B'],
      edges: [['A', 'B']],
      chars: ['Alice', 'Bob', 'Charlie'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 42
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.assassin).toBe('Alice')
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
      seed: 123
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

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

  it('should have assassin alone with exactly one person only once', () => {
    const cfg = {
      rooms: ['R1', 'R2', 'R3'],
      edges: [['R1', 'R2'], ['R2', 'R3']],
      chars: ['A', 'B', 'C', 'D'],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s1: true },
      seed: 456
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

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
})

describe('S2: Phantom Scenario', () => {
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

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

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

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

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

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const [bomber1, bomber2] = res.priv.bomb_duo
    const bombersSorted = [bomber1, bomber2].sort()

    for (let t = 0; t < cfg.T; t++) {
      for (const room of cfg.rooms) {
        const charsInRoom = cfg.chars.filter(c =>
          res.schedule[c][t] === room
        )

        if (charsInRoom.length === 2) {
          const sorted = charsInRoom.sort()
          expect(sorted).toEqual(bombersSorted)
        }
      }
    }
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

})

describe('S5: Lovers Scenario', () => {
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

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const [lover1, lover2] = res.priv.lovers

    // Every non-lover must share a room with someone at least once
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

  it('should have lovers never in same room', () => {
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

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const [lover1, lover2] = res.priv.lovers

    for (let t = 0; t < cfg.T; t++) {
      const room1 = res.schedule[lover1][t]
      const room2 = res.schedule[lover2][t]
      expect(room1).not.toBe(room2)
    }
  })

  it('should have distinct lovers', () => {
    const cfg = {
      rooms: ['A', 'B'],
      edges: [['A', 'B']],
      chars: ['L1', 'L2', 'L3'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 700
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.lovers[0]).not.toBe(res.priv.lovers[1])
  })

  it('should work with minimum configuration (2 chars, 2 rooms)', () => {
    const cfg = {
      rooms: ['A', 'B'],
      edges: [['A', 'B']],
      chars: ['X', 'Y'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 800
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.lovers).toHaveLength(2)
    
    // With only 2 characters, both must be lovers
    expect(res.priv.lovers).toContain('X')
    expect(res.priv.lovers).toContain('Y')
    
    // They should never meet
    for (let t = 0; t < cfg.T; t++) {
      expect(res.schedule['X'][t]).not.toBe(res.schedule['Y'][t])
    }
  })

  it('should handle larger groups with many non-lovers', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D']],
      chars: ['L1', 'L2', 'N1', 'N2', 'N3', 'N4'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 900
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const [lover1, lover2] = res.priv.lovers
    const nonLovers = cfg.chars.filter(c => c !== lover1 && c !== lover2)

    // Lovers never meet
    for (let t = 0; t < cfg.T; t++) {
      expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t])
    }

    // All non-lovers have company at least once
    for (const char of nonLovers) {
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

  it('should allow lovers to be alone (just not together)', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['L1', 'L2', 'N1'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 1000
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const [lover1, lover2] = res.priv.lovers

    // Lovers can be alone (in a room by themselves)
    // Just verify they're never in the same room
    for (let t = 0; t < cfg.T; t++) {
      expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t])
    }
  })

  it('should work with mustMove constraint', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['L1', 'L2', 'N1', 'N2'],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: { s5: true },
      seed: 1100
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const [lover1, lover2] = res.priv.lovers
    const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, false)

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

    // Lovers still never meet
    for (let t = 0; t < cfg.T; t++) {
      expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t])
    }
  })

  it('should verify lovers can be in adjacent rooms', () => {
    const cfg = {
      rooms: ['A', 'B'],
      edges: [['A', 'B']],
      chars: ['L1', 'L2', 'N1'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 1200
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const [lover1, lover2] = res.priv.lovers

    // Lovers can be in adjacent rooms (just not the same room)
    // With only 2 rooms, they should often be in adjacent rooms
    let adjacentCount = 0
    for (let t = 0; t < cfg.T; t++) {
      const room1 = res.schedule[lover1][t]
      const room2 = res.schedule[lover2][t]
      
      // Never in same room
      expect(room1).not.toBe(room2)
      
      // Count when they're in different rooms (which means adjacent with only 2 rooms)
      if (room1 !== room2) adjacentCount++
    }
    
    // They should be in different rooms at all times
    expect(adjacentCount).toBe(cfg.T)
  })

  it('should handle complex graph topology', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D', 'E'],
      edges: [
        ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'],
        ['A', 'E'], // Creates a cycle
        ['B', 'D']  // Adds a shortcut
      ],
      chars: ['L1', 'L2', 'N1', 'N2', 'N3'],
      T: 6,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true },
      seed: 1300
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const [lover1, lover2] = res.priv.lovers

    // Verify core constraint: lovers never meet
    for (let t = 0; t < cfg.T; t++) {
      expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t])
    }

    // Verify non-lovers have company
    const nonLovers = cfg.chars.filter(c => c !== lover1 && c !== lover2)
    for (const char of nonLovers) {
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

  it('should work with different seeds producing different lovers', () => {
    const baseConfig = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['C1', 'C2', 'C3', 'C4'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s5: true }
    }

    const res1 = solveAndDecode({ ...baseConfig, seed: 1400 })
    const res2 = solveAndDecode({ ...baseConfig, seed: 1401 })

    expect(res1).not.toBeNull()
    expect(res2).not.toBeNull()

    // Both should have valid lovers
    expect(res1.priv.lovers).toHaveLength(2)
    expect(res2.priv.lovers).toHaveLength(2)

    // Both should satisfy the constraint
    for (const res of [res1, res2]) {
      const [lover1, lover2] = res.priv.lovers
      for (let t = 0; t < baseConfig.T; t++) {
        expect(res.schedule[lover1][t]).not.toBe(res.schedule[lover2][t])
      }
    }
  })
})

describe('Combined Scenarios', () => {
  it('should handle S2 + S5 together with phantom NOT a lover', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D']],
      chars: ['P', 'L1', 'L2', 'N1', 'N2'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true, s5: true },
      seed: 999
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.phantom).toBeTruthy()
    expect(res.priv.lovers).toBeTruthy()

    const phantom = res.priv.phantom
    const [lover1, lover2] = res.priv.lovers

    // Phantom must NOT be a lover
    expect(phantom).not.toBe(lover1)
    expect(phantom).not.toBe(lover2)

    // Verify phantom is alone at every timestep
    for (let t = 0; t < cfg.T; t++) {
      const phantomRoom = res.schedule[phantom][t]
      const othersInRoom = cfg.chars.filter(c =>
        c !== phantom && res.schedule[c][t] === phantomRoom
      )
      expect(othersInRoom).toHaveLength(0)
    }

    // Verify lovers never meet
    for (let t = 0; t < cfg.T; t++) {
      const room1 = res.schedule[lover1][t]
      const room2 = res.schedule[lover2][t]
      expect(room1).not.toBe(room2)
    }

    // Verify non-phantom non-lovers have company at least once
    for (const char of cfg.chars) {
      if (char === phantom || char === lover1 || char === lover2) continue

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

  it('should have distinct phantom and lovers in S2+S5', () => {
    const cfg = {
      rooms: ['X', 'Y', 'Z'],
      edges: [['X', 'Y'], ['Y', 'Z']],
      chars: ['A', 'B', 'C', 'D'],
      T: 4,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true, s5: true },
      seed: 50
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const phantom = res.priv.phantom
    const [lover1, lover2] = res.priv.lovers

    // All three should be different characters
    expect(phantom).not.toBe(lover1)
    expect(phantom).not.toBe(lover2)
    expect(lover1).not.toBe(lover2)
  })
})

describe('Movement Constraints', () => {
  it('should enforce adjacent movement when mustMove=true', () => {
    const cfg = {
      rooms: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      chars: ['X', 'Y'],
      T: 4,
      mustMove: true,
      allowStay: false,
      scenarios: {},
      seed: 800
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()

    const { idx, nbr } = neighbors(cfg.rooms, cfg.edges, false)

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
  })

  it('should allow staying when allowStay=true', () => {
    const cfg = {
      rooms: ['A', 'B'],
      edges: [['A', 'B']],
      chars: ['X'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: {},
      seed: 900
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.schedule['X']).toHaveLength(cfg.T)
  })
})

describe('Edge Cases', () => {
  it('should handle minimum configuration', () => {
    const cfg = {
      rooms: ['A', 'B'],
      edges: [['A', 'B']],
      chars: ['X', 'Y'],
      T: 2,
      mustMove: false,
      allowStay: true,
      scenarios: {},
      seed: 1100
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
  })

  it('should handle S1 with both fixed room and time', () => {
    const cfg = {
      rooms: ['Kitchen', 'Library'],
      edges: [['Kitchen', 'Library']],
      chars: ['A', 'B', 'C'],
      T: 3,
      mustMove: false,
      allowStay: true,
      scenarios: {
        s1: true,
        s1_room: 'Kitchen',
        s1_time: '2'
      },
      seed: 1200
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.poison_room).toBe('Kitchen')
    expect(res.priv.poison_time).toBe(2)
  })
})

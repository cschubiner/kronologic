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
  it('should have non-bombers share rooms with others', () => {
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

    // Every non-bomber must share a room with someone at least once
    for (const char of cfg.chars) {
      if (char === bomber1 || char === bomber2) continue

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

describe('Combined Scenarios', () => {
  it('should handle S2 + S5 together with phantom as a lover', () => {
    const cfg = {
      rooms: ['A', 'B', 'C', 'D'],
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D']],
      chars: ['P', 'L1', 'L2', 'N1', 'N2'],
      T: 5,
      mustMove: false,
      allowStay: true,
      scenarios: { s2: true, s5: true },
      seed: 1000
    }

    const res = solveAndDecode(cfg)
    expect(res).not.toBeNull()
    expect(res.priv.phantom).toBeTruthy()
    expect(res.priv.lovers).toBeTruthy()

    const phantom = res.priv.phantom
    const [lover1, lover2] = res.priv.lovers
    
    // Phantom MUST be one of the lovers
    expect([lover1, lover2]).toContain(phantom)
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

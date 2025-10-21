import { expect } from 'vitest'
import { solveAndDecode } from '../src/scenario-solver.js'

export function testWithThreshold(cfg, testFn, minSuccessRate = 0.7) {
  const results = []
  const startSeed = cfg.seed || 0

  for (let i = 0; i < 10; i++) {
    const testCfg = { ...cfg, seed: startSeed + i }
    try {
      const res = solveAndDecode(testCfg)
      if (res !== null) {
        results.push({ success: true, res, seed: testCfg.seed })
      } else {
        results.push({ success: false, seed: testCfg.seed, reason: 'timeout' })
      }
    } catch (e) {
      results.push({ success: false, seed: testCfg.seed, reason: e.message })
    }
  }

  const successful = results.filter(r => r.success)
  const successRate = successful.length / results.length

  expect(successRate).toBeGreaterThanOrEqual(minSuccessRate)

  for (const { res, seed } of successful) {
    try {
      testFn(res, cfg)
    } catch (e) {
      throw new Error(`Test failed for seed ${seed}: ${e.message}`)
    }
  }

  return { successful, total: results.length, successRate }
}

/* ===========================
   Minimal SAT (DPLL + Unit)
   =========================== */
function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function resolveSeed(seed) {
  if (seed == null) {
    return Math.floor(Math.random() * 0xffffffff);
  }

  const resolved = Number(seed);
  return Number.isFinite(resolved)
    ? resolved
    : Math.floor(Math.random() * 0xffffffff);
}

function shuffleWithSeed(list, seed) {
  const out = [...list];
  const rng = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function satSolve(clauses, numVars, randSeed = 0, timeoutMs = 12000) {
  // Clauses: array of arrays of ints, var IDs are 1..numVars, negative = negated
  // Returns: assignment array with 1..numVars: true/false, or null if UNSAT/timeout
  const rng = mulberry32(randSeed);
  const startTime = Date.now();
  const assigns = new Array(numVars + 1).fill(0); // 0=unassigned, 1=true, -1=false
  const watchPos = Array.from({ length: numVars + 1 }, () => []);
  const watchNeg = Array.from({ length: numVars + 1 }, () => []);
  const watchers = new Array(clauses.length);
  const activity = new Array(numVars + 1).fill(0);
  const clauseUnassigned = new Array(clauses.length);
  const clauseSatisfied = new Array(clauses.length).fill(false);
  const varClauses = Array.from({ length: numVars + 1 }, () => []);
  let activityInc = 1;
  const activityDecay = 0.95;
  let unresolvedCount = clauses.length;

  function literalIsTrue(lit) {
    const val = assigns[Math.abs(lit)];
    return (val === 1 && lit > 0) || (val === -1 && lit < 0);
  }

  function literalIsFalse(lit) {
    const val = assigns[Math.abs(lit)];
    return (val === 1 && lit < 0) || (val === -1 && lit > 0);
  }

  function addWatch(lit, clauseIndex) {
    const v = Math.abs(lit);
    if (lit > 0) watchPos[v].push(clauseIndex);
    else watchNeg[v].push(clauseIndex);
  }

  function getWatchList(lit) {
    const v = Math.abs(lit);
    return lit > 0 ? watchPos[v] : watchNeg[v];
  }

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];
    if (clause.length === 0) return null;
    const first = clause[0];
    const second = clause.length > 1 ? clause[1] : clause[0];
    watchers[i] = [first, second];
    addWatch(first, i);
    addWatch(second, i);
    clauseUnassigned[i] = clause.length;
    for (const lit of clause) {
      varClauses[Math.abs(lit)].push({ clauseIndex: i, sign: lit });
    }
  }

  function bumpClauseActivity(clause) {
    for (const lit of clause) {
      activity[Math.abs(lit)] += activityInc;
    }
    activityInc /= activityDecay;
    if (activityInc > 1e50) {
      for (let i = 1; i <= numVars; i++) activity[i] *= 1e-50;
      activityInc *= 1e-50;
    }
  }

  function applyAssignment(v, val, changes) {
    for (const { clauseIndex: ci, sign } of varClauses[v]) {
      const prevSat = clauseSatisfied[ci];
      const prevUnassigned = clauseUnassigned[ci];
      let sat = prevSat;
      let unassigned = prevUnassigned - 1;

      if (
        !sat &&
        ((val === 1 && sign > 0) || (val === -1 && sign < 0))
      ) {
        sat = true;
        unresolvedCount--;
      }

      clauseSatisfied[ci] = sat;
      clauseUnassigned[ci] = unassigned;

      if (prevSat !== sat || prevUnassigned !== unassigned) {
        changes.push({ clauseIndex: ci, prevSat, prevUnassigned });
      }
    }
  }

  function revertAssignment(entry) {
    assigns[entry.var] = 0;
    for (let i = entry.changes.length - 1; i >= 0; i--) {
      const change = entry.changes[i];
      const ci = change.clauseIndex;
      if (clauseSatisfied[ci] && !change.prevSat) {
        unresolvedCount++;
      }
      clauseSatisfied[ci] = change.prevSat;
      clauseUnassigned[ci] = change.prevUnassigned;
    }
  }

  function assignLiteral(lit, trail) {
    const v = Math.abs(lit);
    const val = lit > 0 ? 1 : -1;
    const current = assigns[v];
    if (current !== 0) {
      return current === val;
    }
    const entry = { var: v, changes: [] };
    applyAssignment(v, val, entry.changes);
    assigns[v] = val;
    trail.push(entry);
    return true;
  }

  function unitProp(queue, trail) {
    while (queue.length) {
      const lit = queue.pop();
      if (!assignLiteral(lit, trail)) return false;
      const falseLit = -lit;
      const watchList = getWatchList(falseLit);
      for (let i = 0; i < watchList.length; ) {
        const ci = watchList[i];
        const clause = clauses[ci];
        const pair = watchers[ci];
        const firstWatch = pair[0];
        const secondWatch = pair[1];
        const other = firstWatch === falseLit ? secondWatch : firstWatch;
        if (literalIsTrue(other)) {
          i++;
          continue;
        }

        let moved = false;
        for (const candidate of clause) {
          if (candidate === other || candidate === falseLit) continue;
          if (!literalIsFalse(candidate)) {
            if (firstWatch === falseLit) pair[0] = candidate;
            else pair[1] = candidate;
            addWatch(candidate, ci);
            watchList[i] = watchList[watchList.length - 1];
            watchList.pop();
            moved = true;
            break;
          }
        }

        if (moved) continue;

        const otherAssign = assigns[Math.abs(other)];
        if (otherAssign === 0) {
          bumpClauseActivity(clause);
          if (!assignLiteral(other, trail)) return false;
          queue.push(other);
          i++;
        } else if (literalIsFalse(other)) {
          bumpClauseActivity(clause);
          return false;
        } else {
          i++;
        }
      }
    }
    return true;
  }

  function chooseLiteral() {
    let bestVar = 0;
    let bestScore = -Infinity;
    for (let v = 1; v <= numVars; v++) {
      if (assigns[v] !== 0) continue;
      const score = activity[v];
      if (
        score > bestScore ||
        (Math.abs(score - bestScore) <= 1e-12 && rng() < 0.5)
      ) {
        bestScore = score;
        bestVar = v;
      }
    }
    if (bestVar === 0) return 0;
    return rng() < 0.5 ? bestVar : -bestVar;
  }

  // initial unit clauses
  let initQ = [];
  for (const c of clauses) {
    if (c.length === 1 && c[0] !== 0) initQ.push(c[0]);
  }
  const trail = [];
  if (!unitProp(initQ, trail)) return null;

  function dfs() {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error("SAT_TIMEOUT");
    }

    if (unresolvedCount === 0) return true;

    const lit = chooseLiteral();
    if (lit === 0) return false;
    // branch with suggested literal first, then opposite
    for (const tryLit of [lit, -lit]) {
      const trailSize = trail.length;
      const v = Math.abs(tryLit);
      if (assigns[v] !== 0 && assigns[v] !== (tryLit > 0 ? 1 : -1)) continue;
      const stack = [tryLit];
      if (unitProp(stack, trail)) {
        if (dfs()) return true;
      }
      while (trail.length > trailSize) {
        const reverted = trail.pop();
        revertAssignment(reverted);
      }
    }
    return false;
  }

  try {
    if (!dfs()) return null;
  } catch (e) {
    if (e.message === "SAT_TIMEOUT") return null;
    throw e;
  }

  for (const clause of clauses) {
    let clauseSat = false;
    for (const lit of clause) {
      if (literalIsTrue(lit)) {
        clauseSat = true;
        break;
      }
    }
    if (!clauseSat) return null;
  }

  // build boolean array
  const out = new Array(numVars + 1);
  for (let v = 1; v <= numVars; v++) {
    out[v] = assigns[v] === 1;
    if (assigns[v] === 0) out[v] = false; // default
  }
  return out;
}

/* ===========================
   CNF Builder Helpers
   =========================== */
export function varPool() {
  let next = 1;
  const id = new Map();
  const rev = new Map();
  return {
    get(name) {
      if (!id.has(name)) {
        id.set(name, next);
        rev.set(next, name);
        next++;
      }
      return id.get(name);
    },
    count() {
      return next - 1;
    },
    rev,
  };
}

export function atLeastOne(cl) {
  // OR over literals (already in int form)
  return [cl];
}

export function atMostOne(vars) {
  // pairwise
  const out = [];
  for (let i = 0; i < vars.length; i++)
    for (let j = i + 1; j < vars.length; j++) {
      out.push([-vars[i], -vars[j]]);
    }
  return out;
}

export function exactlyOne(vars) {
  return [...atLeastOne(vars), ...atMostOne(vars)];
}

export function atLeastK(vars, k) {
  if (k <= 0) return [[]];
  const n = vars.length;
  if (k > n) return [];
  const targetSize = n - k + 1;
  const combos = [];
  function backtrack(start, chosen) {
    if (chosen.length === targetSize) {
      combos.push(chosen.slice());
      return;
    }
    for (let i = start; i < n; i++) {
      chosen.push(vars[i]);
      backtrack(i + 1, chosen);
      chosen.pop();
    }
  }
  backtrack(0, []);
  return combos;
}

export function buildTotalizer(vars, vp, clauses, prefix) {
  let nodeCounter = 0;

  function helper(list, tag) {
    if (!list.length) return [];
    if (list.length === 1) return [list[0]];

    const mid = Math.floor(list.length / 2);
    const left = helper(list.slice(0, mid), `${tag}L`);
    const right = helper(list.slice(mid), `${tag}R`);

    const id = `${tag}_${nodeCounter++}`;
    const outLen = left.length + right.length;
    const out = new Array(outLen);

    for (let i = 0; i < outLen; i++) {
      out[i] = vp.get(`${prefix}_${id}_${i + 1}`);
    }

    for (let i = 1; i < out.length; i++) {
      clauses.push([-out[i], out[i - 1]]);
    }
    for (let i = 0; i < left.length; i++) {
      clauses.push([-left[i], out[i]]);
    }
    for (let j = 0; j < right.length; j++) {
      clauses.push([-right[j], out[j]]);
    }
    for (let i = 0; i < left.length; i++) {
      for (let j = 0; j < right.length; j++) {
        const idx = i + j + 1;
        if (idx < out.length) {
          clauses.push([-left[i], -right[j], out[idx]]);
        }
      }
    }

    for (let i = 0; i < out.length; i++) {
      const support = [];
      if (i < left.length) support.push(left[i]);
      if (i < right.length) support.push(right[i]);

      for (let a = 0; a < left.length; a++) {
        for (let b = 0; b < right.length; b++) {
          if (a + b + 1 !== i) continue;
          const comb = vp.get(`${prefix}_${id}_comb_${i}_${a}_${b}`);
          clauses.push([-comb, left[a]]);
          clauses.push([-comb, right[b]]);
          clauses.push([comb, -left[a], -right[b]]);
          support.push(comb);
        }
      }

      if (support.length === 0) {
        clauses.push([-out[i]]);
      } else {
        clauses.push([-out[i], ...support]);
      }
    }
    return out;
  }

  return helper(vars, prefix);
}

/* ===========================
   Mermaid-ish Parser
   =========================== */
export function parseMermaid(txt) {
  // Parse Mermaid-like graph: handle quoted and unquoted room names
  const rooms = new Set();
  const edges = [];
  // Match: optional quote, capture content, optional quote, ---, repeat
  const re = /"([^"]+)"|(\S+)/g;
  const lines = txt.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("graph")) continue;
    if (!line.includes("---")) continue;

    // Extract all quoted or unquoted tokens
    re.lastIndex = 0;
    const tokens = [];
    let match;
    while ((match = re.exec(line)) !== null) {
      tokens.push(match[1] || match[2]); // quoted or unquoted
    }

    // Find --- separator position in original line
    const parts = line.split("---");
    if (parts.length === 2) {
      // Re-parse each side
      const leftTokens = [];
      const rightTokens = [];
      re.lastIndex = 0;
      while ((match = re.exec(parts[0])) !== null) {
        leftTokens.push(match[1] || match[2]);
      }
      re.lastIndex = 0;
      while ((match = re.exec(parts[1])) !== null) {
        rightTokens.push(match[1] || match[2]);
      }

      if (leftTokens.length > 0 && rightTokens.length > 0) {
        const a = leftTokens[leftTokens.length - 1]; // last token on left
        const b = rightTokens[0]; // first token on right
        rooms.add(a);
        rooms.add(b);
        edges.push([a, b]);
      }
    }
  }
  return { rooms: Array.from(rooms), edges };
}

export function neighbors(rooms, edges, includeSelf) {
  const idx = new Map();
  rooms.forEach((r, i) => idx.set(r, i));
  const nbr = Array.from({ length: rooms.length }, () => new Set());
  for (const [a, b] of edges) {
    if (!idx.has(a) || !idx.has(b)) continue;
    const i = idx.get(a),
      j = idx.get(b);
    nbr[i].add(j);
    nbr[j].add(i);
  }
  if (includeSelf) {
    for (let i = 0; i < rooms.length; i++) nbr[i].add(i);
  }
  return { idx, nbr: nbr.map((s) => Array.from(s)) };
}

/* ===========================
   Problem Encoding
   =========================== */
export function buildCNF(config) {
  // config: {rooms[], edges[], chars[], T, mustMove, allowStay, scenarios: {s1:{room?,time?}, s2, s4:{room?}, s5}, seed}
  const resolvedSeed = resolveSeed(config.seed);
  const shuffledRooms = Array.isArray(config.rooms)
    ? shuffleWithSeed(config.rooms, resolvedSeed)
    : [];
  const vp = varPool();
  const clauses = [];

  const R = shuffledRooms,
    C = config.chars,
    T = config.T;
  const baseStay = config.allowStay && !config.mustMove;
  const stickyStay = !!(
    config.scenarios &&
    (config.scenarios.s8 ||
      config.scenarios.s9 ||
      config.scenarios.s12 ||
      config.scenarios.s13)
  );

  let s16Setup = null;
  if (config.scenarios && config.scenarios.s16) {
    if (C.length < 2) {
      throw new Error("S16 requires at least 2 characters");
    }

    const maxDistinctVisits = Math.min(R.length, T);
    const rng = mulberry32(resolvedSeed);

    const shuffled = [...C];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const visitCountAssignments = {};
    const visitCountTargets = [];
    const minReachableCount = Math.max(1, Math.min(maxDistinctVisits, 1));
    for (
      let count = maxDistinctVisits;
      visitCountTargets.length < shuffled.length && count >= minReachableCount;
      count--
    ) {
      visitCountTargets.push(count);
    }
    if (!visitCountTargets.includes(minReachableCount)) {
      visitCountTargets[visitCountTargets.length - 1] = minReachableCount;
    }
    while (visitCountTargets.length < shuffled.length) {
      visitCountTargets.push(minReachableCount);
    }

    for (let i = 0; i < shuffled.length; i++) {
      const cappedTarget = Math.min(visitCountTargets[i], maxDistinctVisits);
      visitCountAssignments[shuffled[i]] = cappedTarget;
      visitCountTargets[i] = cappedTarget;
    }

    const homebodyIndex = visitCountTargets.indexOf(minReachableCount);
    const homebody = shuffled[Math.max(0, homebodyIndex)];
    const minVisitCount = Math.min(...visitCountTargets);

    s16Setup = {
      visitCountAssignments,
      visitCountTargets,
      minVisitCount,
      homebody,
    };
  }

  const { idx: Ridx, nbr } = neighbors(R, config.edges, baseStay || stickyStay);

  // Helper to get variable IDs
  const X = (ci, t, ri) => vp.get(`X_${C[ci]}_${t}_${R[ri]}`);

  // Exactly one room per (c,t)
  for (let ci = 0; ci < C.length; ci++) {
    for (let t = 0; t < T; t++) {
      const vars = [];
      for (let ri = 0; ri < R.length; ri++) vars.push(X(ci, t, ri));
      clauses.push(...exactlyOne(vars));
    }
  }

  // Movement constraints
  for (let ci = 0; ci < C.length; ci++) {
    for (let t = 0; t < T - 1; t++) {
      for (let ri = 0; ri < R.length; ri++) {
        let allowed = nbr[ri];
        const targetCount = s16Setup?.visitCountAssignments?.[C[ci]];
        if (
          s16Setup &&
          targetCount === s16Setup.minVisitCount &&
          !allowed.includes(ri)
        ) {
          allowed = [...allowed, ri];
        }
        const rhs = allowed.map((r2) => X(ci, t + 1, r2));
        clauses.push([-X(ci, t, ri), ...rhs]);
      }
    }
  }

  // =========== Scenarios ===========
  const privKeys = {};

  if (config.scenarios && config.scenarios.s14) {
    if (!R.length) throw new Error("S14 requires at least one room");
    if (C.length < 2) throw new Error("S14 requires at least two characters");
    if (T < 6) throw new Error("S14 requires at least six timesteps");
    privKeys.S14 = true;
  }

  // S15: World Travelers — rank top 3 travelers by unique rooms visited
  if (config.scenarios && config.scenarios.s15) {
    if (R.length < 4) throw new Error("S15 requires at least 4 rooms");
    if (C.length < 3) throw new Error("S15 requires at least 3 characters");

    const rng = mulberry32(resolvedSeed);

    // Randomly assign top 3 travelers by shuffling chars
    const shuffled = [...C];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const first = shuffled[0]; // visits the most rooms
    const second = shuffled[1];
    const third = shuffled[2];

    const maxUniqueVisits = Math.min(R.length, T);
    const podiumTargets = [
      maxUniqueVisits,
      Math.max(1, maxUniqueVisits - 1),
      Math.max(1, maxUniqueVisits - 2),
    ];

    // Create "visited" helper variables: V_{char}_{room} = true if char visits room at any time
    const S15V = (ci, ri) => vp.get(`S15_V_${C[ci]}_${R[ri]}`);

    for (let ci = 0; ci < C.length; ci++) {
      for (let ri = 0; ri < R.length; ri++) {
        // V[ci][ri] = OR over all timesteps of X[ci][t][ri]
        const anyTime = [];
        for (let t = 0; t < T; t++) {
          anyTime.push(X(ci, t, ri));
        }
        // V => at least one X is true: (-V OR X[0] OR X[1] OR ...)
        clauses.push([-S15V(ci, ri), ...anyTime]);
        // Each X => V: for each t, X[ci][t][ri] => V[ci][ri]
        for (let t = 0; t < T; t++) {
          clauses.push([-X(ci, t, ri), S15V(ci, ri)]);
        }
      }
    }

    // Helper to enforce exact visit counts using totalizer output
    function enforceExactVisits(totalizer, targetCount) {
      if (targetCount > 0 && totalizer.length >= targetCount) {
        clauses.push([totalizer[targetCount - 1]]);
      }
      if (targetCount < totalizer.length) {
        clauses.push([-totalizer[targetCount]]);
      }
    }

    // 1st place: visits the maximum feasible distinct rooms
    const firstIdx = C.indexOf(first);
    const firstVars = R.map((_, ri) => S15V(firstIdx, ri));
    const firstTotalizer = buildTotalizer(
      firstVars,
      vp,
      clauses,
      `S15_1st_${C[firstIdx]}`,
    );
    enforceExactVisits(firstTotalizer, podiumTargets[0]);

    // 2nd place: visits the next highest feasible count
    const secondIdx = C.indexOf(second);
    const secondVars = R.map((_, ri) => S15V(secondIdx, ri));
    const secondTotalizer = buildTotalizer(
      secondVars,
      vp,
      clauses,
      `S15_2nd_${C[secondIdx]}`,
    );
    enforceExactVisits(secondTotalizer, podiumTargets[1]);

    // 3rd place: visits the third highest feasible count
    const thirdIdx = C.indexOf(third);
    const thirdVars = R.map((_, ri) => S15V(thirdIdx, ri));
    const thirdTotalizer = buildTotalizer(
      thirdVars,
      vp,
      clauses,
      `S15_3rd_${C[thirdIdx]}`,
    );
    enforceExactVisits(thirdTotalizer, podiumTargets[2]);

    // Others (4th+): visit fewer rooms than third place where possible
    const othersMax = Math.max(1, podiumTargets[2] - 1);
    for (let ci = 0; ci < C.length; ci++) {
      if (C[ci] === first || C[ci] === second || C[ci] === third) continue;
      const otherVars = R.map((_, ri) => S15V(ci, ri));
      const otherTotalizer = buildTotalizer(
        otherVars,
        vp,
        clauses,
        `S15_other_${C[ci]}`,
      );
      if (othersMax < otherTotalizer.length) {
        clauses.push([-otherTotalizer[othersMax]]);
      }
    }

    privKeys.S15 = {
      first,
      second,
      third,
      targets: {
        first: podiumTargets[0],
        second: podiumTargets[1],
        third: podiumTargets[2],
      },
    };
  }

  // S16: Homebodies — each character visits a unique number of rooms (1, 2, 3, ...)
  // Only the character visiting exactly 1 room may stay in place; all others must move
  if (config.scenarios && config.scenarios.s16) {
    const { visitCountAssignments, visitCountTargets, minVisitCount, homebody } =
      s16Setup || {};
    if (!visitCountAssignments || !homebody || !visitCountTargets) {
      throw new Error("S16 setup missing visit assignments");
    }

    // Create "visited" helper variables: V_{char}_{room} = true if char visits room at any time
    const S16V = (ci, ri) => vp.get(`S16_V_${C[ci]}_${R[ri]}`);

    for (let ci = 0; ci < C.length; ci++) {
      for (let ri = 0; ri < R.length; ri++) {
        const anyTime = [];
        for (let t = 0; t < T; t++) {
          anyTime.push(X(ci, t, ri));
        }
        // V => at least one X is true
        clauses.push([-S16V(ci, ri), ...anyTime]);
        // Each X => V
        for (let t = 0; t < T; t++) {
          clauses.push([-X(ci, t, ri), S16V(ci, ri)]);
        }
      }
    }

    // Enforce exact visit counts using totalizer
    for (let ci = 0; ci < C.length; ci++) {
      const ch = C[ci];
      const targetCount = visitCountAssignments[ch];
      const visitVars = R.map((_, ri) => S16V(ci, ri));
      const totalizer = buildTotalizer(visitVars, vp, clauses, `S16_${ch}`);

      // Exactly targetCount rooms: at least targetCount AND at most targetCount
      if (targetCount > 0 && totalizer.length >= targetCount) {
        clauses.push([totalizer[targetCount - 1]]); // At least targetCount (0-indexed)
      }
      if (targetCount < R.length && totalizer.length > targetCount) {
        clauses.push([-totalizer[targetCount]]); // At most targetCount
      }
    }

    // Movement constraints: characters at the minimum count can stay, others must move
    for (let ci = 0; ci < C.length; ci++) {
      const ch = C[ci];
      const targetCount = visitCountAssignments[ch];
      if (targetCount <= minVisitCount) {
        // Minimum-count visitors may stay put to meet their quota
        continue;
      }
      // Others must move: X[ci][t][ri] => NOT X[ci][t+1][ri] for all t, ri
      for (let t = 0; t < T - 1; t++) {
        for (let ri = 0; ri < R.length; ri++) {
          clauses.push([-X(ci, t, ri), -X(ci, t + 1, ri)]);
        }
      }
    }

    privKeys.S16 = { visitCountAssignments, visitCountTargets, minVisitCount, homebody };
  }

  // S11: The Vault — earliest alphabetical room is locked, only the key holder may enter
  if (config.scenarios && config.scenarios.s11) {
    if (!R.length) throw new Error("S11 requires at least one room");
    if (C.length < 3) throw new Error("S11 requires at least three characters");
    if (T < 2) throw new Error("S11 requires at least two timesteps");
    if (config.mustMove && !config.allowStay && T < 3) {
      throw new Error("S11 requires at least three timesteps when movement is forced");
    }

    const vaultRoom = [...R].sort()[0];
    const vr = Ridx.get(vaultRoom);
    if (vr == null) throw new Error("S11 vault room missing from map");

    const rng = mulberry32(resolvedSeed);
    const keyHolderIdx = Math.floor(rng() * C.length);

    const KH = C.map((_, ci) => vp.get(`S11_KH_${C[ci]}`));
    clauses.push(...exactlyOne(KH));
    clauses.push([KH[keyHolderIdx]]);

    // Only the key holder may be in the vault (others require the key holder present)
    for (let ci = 0; ci < C.length; ci++) {
      for (let cj = 0; cj < C.length; cj++) {
        if (ci === cj) continue;
        for (let t = 0; t < T; t++) {
          clauses.push([-KH[ci], -X(cj, t, vr), X(ci, t, vr)]);
        }
      }
    }

    // Track vault co-visits to enforce two distinct companions across two timesteps
    const withOther = Array.from({ length: C.length }, () => []);
    const khVaultVisits = Array.from({ length: C.length }, () => []);
    const khWithoutCompanion = Array.from({ length: C.length }, () =>
      Array.from({ length: C.length }, () => []),
    );
    const compVars = Array.from({ length: C.length }, () =>
      Array.from({ length: C.length }, () => null),
    );
    const compDetails = Array.from({ length: C.length }, () =>
      Array.from({ length: C.length }, () => []),
    );

    for (let ci = 0; ci < C.length; ci++) {
      for (let t = 0; t < T; t++) {
        const khVisit = vp.get(`S11_khVisit_${C[ci]}_${t}`);
        khVaultVisits[ci].push(khVisit);
        clauses.push([-khVisit, KH[ci]]);
        clauses.push([-khVisit, X(ci, t, vr)]);
        clauses.push([-KH[ci], -X(ci, t, vr), khVisit]);

        const otherVars = [];
        for (let cj = 0; cj < C.length; cj++) {
          if (ci === cj) continue;
          otherVars.push(X(cj, t, vr));
        }

        const someOther = vp.get(`S11_someOther_${C[ci]}_${t}`);
        if (otherVars.length) {
          clauses.push([-someOther, ...otherVars]);
          for (const ov of otherVars) clauses.push([-ov, someOther]);
        } else {
          clauses.push([-someOther]);
        }

        const withO = vp.get(`S11_withOther_${C[ci]}_${t}`);
        withOther[ci].push(withO);
        clauses.push([-withO, KH[ci]]);
        clauses.push([-withO, X(ci, t, vr)]);
        clauses.push([-withO, someOther]);
        clauses.push([-KH[ci], -X(ci, t, vr), -someOther, withO]);

        for (let cj = 0; cj < C.length; cj++) {
          if (ci === cj) continue;
          const pair = vp.get(`S11_pair_${C[ci]}_${C[cj]}_${t}`);
          compDetails[ci][cj].push(pair);
          clauses.push([-pair, KH[ci]]);
          clauses.push([-pair, X(ci, t, vr)]);
          clauses.push([-pair, X(cj, t, vr)]);
          clauses.push([-KH[ci], -X(ci, t, vr), -X(cj, t, vr), pair]);

          const khOnly = vp.get(`S11_without_${C[ci]}_${C[cj]}_${t}`);
          khWithoutCompanion[ci][cj].push(khOnly);
          clauses.push([-khOnly, KH[ci]]);
          clauses.push([-khOnly, X(ci, t, vr)]);
          clauses.push([-khOnly, -X(cj, t, vr)]);
          clauses.push([-KH[ci], -X(ci, t, vr), X(cj, t, vr), khOnly]);
        }
      }
    }

    for (let ci = 0; ci < C.length; ci++) {
      for (let cj = 0; cj < C.length; cj++) {
        if (ci === cj) continue;
        const comp = vp.get(`S11_comp_${C[ci]}_${C[cj]}`);
        compVars[ci][cj] = comp;
        const details = compDetails[ci][cj];
        clauses.push([-comp, KH[ci]]);
        if (details.length) {
          clauses.push([-comp, ...details]);
          for (const d of details) clauses.push([-d, comp]);
        } else {
          clauses.push([-comp]);
        }
      }

      if (withOther[ci].length === 0) {
        clauses.push([-KH[ci]]);
      } else {
        clauses.push([-KH[ci], ...withOther[ci]]);
      }

      const companions = compVars[ci].filter((v, idx) => idx !== ci && v !== null);
      if (companions.length === 0) {
        clauses.push([-KH[ci]]);
      } else {
        clauses.push([-KH[ci], ...companions]);
      }

      const visitCount = buildTotalizer(
        khVaultVisits[ci],
        vp,
        clauses,
        `S11_${C[ci]}_VisitTotal`,
      );
      if (visitCount.length >= 2) {
        clauses.push([-KH[ci], visitCount[1]]);
      } else {
        clauses.push([-KH[ci]]);
      }

      for (let cj = 0; cj < C.length; cj++) {
        if (ci === cj) continue;
        const khOnlyGaps = khWithoutCompanion[ci][cj];
        if (khOnlyGaps.length === 0) {
          clauses.push([-KH[ci]]);
        } else {
          clauses.push([-KH[ci], ...khOnlyGaps]);
        }
      }
    }

    privKeys.S11 = { KH, vaultRoom };
  }

  // S10: Contagion — alphabetically first room infects entrants
  let contagionRoom = null;
  if (config.scenarios && config.scenarios.s10) {
    if (!R.length) throw new Error("S10 requires at least one room");
    contagionRoom = [...R].sort()[0];
    const ri = Ridx.get(contagionRoom);
    if (ri == null) throw new Error("S10 contagious room missing");
    const mustVisitContagious = [];
    for (let ci = 0; ci < C.length; ci++) {
      for (let t = 0; t < T; t++) {
        mustVisitContagious.push(X(ci, t, ri));
      }
    }
    clauses.push(mustVisitContagious);
    privKeys.S10 = contagionRoom;
  }

  // S12: Glue Room — randomly chosen room forces entrants to stay one extra turn
  if (config.scenarios && config.scenarios.s12) {
    if (!R.length) throw new Error("S12 requires at least one room");
    if (T < 2) throw new Error("S12 requires at least two timesteps");

    const rng = mulberry32(resolvedSeed);
    const glueRoom = R[Math.floor(rng() * R.length)];
    const gr = Ridx.get(glueRoom);
    if (gr == null) throw new Error("S12 glue room missing from map");

    const entriesBeforeFinal = [];

    for (let ci = 0; ci < C.length; ci++) {
      for (let t = 0; t < T; t++) {
        const entry = vp.get(`S12Entry_${C[ci]}_${t}`);

        clauses.push([-entry, X(ci, t, gr)]);
        if (t === 0) {
          clauses.push([-X(ci, t, gr), entry]);
        } else {
          clauses.push([-entry, -X(ci, t - 1, gr)]);
          clauses.push([-X(ci, t, gr), X(ci, t - 1, gr), entry]);
        }

        if (t < T - 1) {
          clauses.push([-entry, X(ci, t + 1, gr)]);
          entriesBeforeFinal.push(entry);
        } else {
          clauses.push([-entry]);
        }
        if (t < T - 2) {
          clauses.push([-entry, -X(ci, t + 2, gr)]);
        }
      }
    }

    if (entriesBeforeFinal.length === 0) {
      throw new Error("S12 requires at least one possible glue entry before final timestep");
    }
    clauses.push(...atLeastOne(entriesBeforeFinal));

    privKeys.S12 = { glueRoom };
  }

  // S13: Glue Shoes — one character causes others in the room to stay an extra turn
  if (config.scenarios && config.scenarios.s13) {
    if (T < 2) throw new Error("S13 requires at least two timesteps");
    if (C.length < 2)
      throw new Error("S13 requires at least two characters (glue + victim)");

    const rng = mulberry32(resolvedSeed);
    const glueIdx = Math.floor(rng() * C.length);

    const GS = C.map((_, ci) => vp.get(`S13_GLUE_${C[ci]}`));
    clauses.push(...exactlyOne(GS));
    clauses.push([GS[glueIdx]]);

    const meetVarsByGlue = Array.from({ length: C.length }, () => []);
    const stuckSupports = Array.from({ length: C.length }, () =>
      Array.from({ length: T }, () => Array.from({ length: R.length }, () => [])),
    );

    // Glue carrier must always move; they are immune to sticking effects.
    for (let ci = 0; ci < C.length; ci++) {
      for (let t = 0; t < T - 1; t++) {
        for (let ri = 0; ri < R.length; ri++) {
          clauses.push([-GS[ci], -X(ci, t, ri), -X(ci, t + 1, ri)]);
        }
      }
    }

    for (let gp = 0; gp < C.length; gp++) {
      for (let vi = 0; vi < C.length; vi++) {
        if (vi === gp) continue;
        for (let t = 0; t < T - 1; t++) {
          for (let ri = 0; ri < R.length; ri++) {
            const meet = vp.get(
              `S13Meet_${C[gp]}_${C[vi]}_${t}_${R[ri]}`
            );
            meetVarsByGlue[gp].push(meet);
            stuckSupports[vi][t + 1][ri].push(meet);

            clauses.push([-meet, GS[gp]]);
            clauses.push([-meet, X(gp, t, ri)]);
            clauses.push([-meet, X(vi, t, ri)]);
            clauses.push([-GS[gp], -X(gp, t, ri), -X(vi, t, ri), meet]);

            clauses.push([-meet, X(vi, t + 1, ri)]);

            if (t < T - 2) {
              clauses.push([-meet, -X(vi, t + 2, ri)]);
            }
          }
        }
      }
    }

    if (config.mustMove && !config.allowStay) {
      for (let ci = 0; ci < C.length; ci++) {
        for (let t = 0; t < T - 1; t++) {
          for (let ri = 0; ri < R.length; ri++) {
            const clause = [-X(ci, t, ri), -X(ci, t + 1, ri)];
            const support = stuckSupports[ci][t + 1][ri];
            if (support.length) clause.push(...support);
            clauses.push(clause);
          }
        }
      }
    }

    for (let gp = 0; gp < C.length; gp++) {
      const meets = meetVarsByGlue[gp];
      if (!meets.length) {
        clauses.push([-GS[gp]]);
      } else {
        clauses.push([-GS[gp], ...meets]);
      }
    }

    privKeys.S13 = { GS };
  }

  // S3: Ensure alphabetically first room is visited at least once
  if (config.scenarios.s3) {
    if (!R.length) throw new Error("S3 requires at least one room");
    const alphabeticRoom = [...R].sort()[0];
    const ri = Ridx.get(alphabeticRoom);
    if (ri == null) throw new Error("S3 alphabetic room missing");
    const firstRoomVar = [];
    for (let ci = 0; ci < C.length; ci++) {
      for (let t = 0; t < T; t++) {
        firstRoomVar.push(X(ci, t, ri));
      }
    }

    // At least one visit
    clauses.push(firstRoomVar);

    // Ensure someone visits the room alone at least once (well-defined first thief)
    const aloneAtRoom = [];
    for (let ci = 0; ci < C.length; ci++) {
      for (let t = 0; t < T; t++) {
        const alone = vp.get(`S3Alone_${C[ci]}_${t}`);
        aloneAtRoom.push(alone);

        // If alone is true, ci is in the alphabetic room and nobody else is
        clauses.push([-alone, X(ci, t, ri)]);
        for (let cj = 0; cj < C.length; cj++) {
          if (cj === ci) continue;
          clauses.push([-alone, -X(cj, t, ri)]);
        }
      }
    }

    clauses.push(aloneAtRoom);
  }

  // S2: Phantom alone at every time
  let PH = null;
  if (config.scenarios.s2) {
    PH = C.map((_, ci) => vp.get(`PH_${C[ci]}`));
    clauses.push(...exactlyOne(PH));
    for (let t = 0; t < T; t++) {
      for (let ri = 0; ri < R.length; ri++) {
        for (let ci = 0; ci < C.length; ci++) {
          for (let cj = 0; cj < C.length; cj++) {
            if (ci === cj) continue;
            clauses.push([-PH[ci], -X(ci, t, ri), -X(cj, t, ri)]);
          }
        }
      }
    }
    for (let ci = 0; ci < C.length; ci++) {
      const atLeastOnceNotAlone = [];
      for (let t = 0; t < T; t++) {
        for (let ri = 0; ri < R.length; ri++) {
          for (let cj = 0; cj < C.length; cj++) {
            if (ci === cj) continue;
            const bothThere = vp.get(`notAlone_${ci}_${t}_${ri}_${cj}`);
            clauses.push([-bothThere, X(ci, t, ri)]);
            clauses.push([-bothThere, X(cj, t, ri)]);
            clauses.push([-X(ci, t, ri), -X(cj, t, ri), bothThere]);
            atLeastOnceNotAlone.push(bothThere);
          }
        }
      }
      clauses.push([PH[ci], ...atLeastOnceNotAlone]);
    }
    privKeys.PH = PH;
  }

  // S5: Lovers never meet
  let L1 = null,
    L2 = null;
  if (config.scenarios.s5) {
    L1 = C.map((_, ci) => vp.get(`L1_${C[ci]}`));
    L2 = C.map((_, ci) => vp.get(`L2_${C[ci]}`));
    clauses.push(...exactlyOne(L1));
    clauses.push(...exactlyOne(L2));
    for (let ci = 0; ci < C.length; ci++) {
      clauses.push([-L1[ci], -L2[ci]]);
    }

    // If both S2 and S5 are enabled (S6), phantom must NOT be a lover
    // The phantom is in their own category - neither lover nor non-lover
    if (PH) {
      for (let ci = 0; ci < C.length; ci++) {
        // PH[ci] => NOT L1[ci] AND NOT L2[ci]
        // CNF: -PH[ci] OR -L1[ci]  AND  -PH[ci] OR -L2[ci]
        clauses.push([-PH[ci], -L1[ci]]);
        clauses.push([-PH[ci], -L2[ci]]);
      }
    }

    // Lovers never meet
    for (let t = 0; t < T; t++) {
      for (let ri = 0; ri < R.length; ri++) {
        for (let c1 = 0; c1 < C.length; c1++) {
          for (let c2 = 0; c2 < C.length; c2++) {
            if (c1 === c2) continue;
            clauses.push([-L1[c1], -L2[c2], -X(c1, t, ri), -X(c2, t, ri)]);
          }
        }
      }
    }

    // Every pair of non-lovers must meet at least once
    // (Phantom is excluded from this - they're neither lover nor non-lover)
    for (let ci = 0; ci < C.length; ci++) {
      for (let cj = ci + 1; cj < C.length; cj++) {
        // Create variable: ci and cj meet at least once
        const pairMeets = [];
        for (let t = 0; t < T; t++) {
          for (let ri = 0; ri < R.length; ri++) {
            const bothThere = vp.get(`loverPairMeet_${ci}_${cj}_${t}_${ri}`);
            // bothThere ⇔ (X(ci,t,ri) ∧ X(cj,t,ri))
            clauses.push([-bothThere, X(ci, t, ri)]);
            clauses.push([-bothThere, X(cj, t, ri)]);
            clauses.push([-X(ci, t, ri), -X(cj, t, ri), bothThere]);
            pairMeets.push(bothThere);
          }
        }

        // If neither ci nor cj is a lover AND neither is phantom (if S2 enabled), they must meet
        // (L1[ci] ∨ L2[ci] ∨ L1[cj] ∨ L2[cj] ∨ PH[ci] ∨ PH[cj]) ∨ (at least one pairMeets is true)
        const meetLits = [...pairMeets];
        if (config.scenarios.s2 && PH) {
          meetLits.push(PH[ci], PH[cj]);
          // S6 scenario: exclude phantom from meeting requirement
          clauses.push([L1[ci], L2[ci], L1[cj], L2[cj], ...meetLits]);
        } else {
          // S5 only: all non-lovers must meet
          clauses.push([L1[ci], L2[ci], L1[cj], L2[cj], ...meetLits]);
        }

        clauses.push([-L1[ci], L2[cj], ...meetLits]);
        clauses.push([-L2[ci], L1[cj], ...meetLits]);
        clauses.push([-L1[cj], L2[ci], ...meetLits]);
        clauses.push([-L2[cj], L1[ci], ...meetLits]);
      }
    }

    privKeys.L1 = L1;
    privKeys.L2 = L2;
  }

  // S1: Poison — assassin (first character) alone with exactly one victim
  let V = null,
    PT = null,
    PR = null;
  if (config.scenarios.s1) {
    const assassinIdx = 0;

    V = C.map((_, ci) => vp.get(`V_${C[ci]}`));
    PT = Array.from({ length: T }, (_, t) => vp.get(`PT_${t}`));
    PR = R.map((_, ri) => vp.get(`PR_${R[ri]}`));

    clauses.push(...exactlyOne(V));
    clauses.push(...exactlyOne(PT));
    clauses.push(...exactlyOne(PR));

    clauses.push([-V[assassinIdx]]);

    if (config.scenarios.s1_room) {
      const ri = Ridx.get(config.scenarios.s1_room);
      if (ri != null) clauses.push([PR[ri]]);
    }
    if (config.scenarios.s1_time) {
      const t = Number(config.scenarios.s1_time) - 1;
      if (!Number.isNaN(t) && t >= 0 && t < T) clauses.push([PT[t]]);
    }

    for (let t = 0; t < T; t++) {
      for (let ri = 0; ri < R.length; ri++) {
        for (let vi = 0; vi < C.length; vi++) {
          if (vi === assassinIdx) continue;

          clauses.push([-PT[t], -PR[ri], -V[vi], X(assassinIdx, t, ri)]);
          clauses.push([-PT[t], -PR[ri], -V[vi], X(vi, t, ri)]);

          for (let ci = 0; ci < C.length; ci++) {
            if (ci === assassinIdx || ci === vi) continue;
            clauses.push([-PT[t], -PR[ri], -V[vi], -X(ci, t, ri)]);
          }
        }
      }
    }

    for (let t = 0; t < T; t++) {
      for (let ri = 0; ri < R.length; ri++) {
        const isPoisonMoment = vp.get(`isPoisonMoment_${t}_${ri}`);

        const poisonClauses = [];
        for (let vi = 0; vi < C.length; vi++) {
          if (vi === assassinIdx) continue;
          const thisPoison = vp.get(`thisPoison_${t}_${ri}_${vi}`);
          clauses.push([-thisPoison, PT[t]]);
          clauses.push([-thisPoison, PR[ri]]);
          clauses.push([-thisPoison, V[vi]]);
          clauses.push([-PT[t], -PR[ri], -V[vi], thisPoison]);
          poisonClauses.push(thisPoison);
        }
        clauses.push([-isPoisonMoment, ...poisonClauses]);
        for (const tp of poisonClauses) {
          clauses.push([-tp, isPoisonMoment]);
        }

        for (let ci = 0; ci < C.length; ci++) {
          if (ci === assassinIdx) continue;
          for (let cj = ci + 1; cj < C.length; cj++) {
            if (cj === assassinIdx) continue;

            const exactlyTwo = vp.get(`exactlyTwo_${t}_${ri}_${ci}_${cj}`);

            clauses.push([-exactlyTwo, X(assassinIdx, t, ri)]);
            clauses.push([-exactlyTwo, X(ci, t, ri)]);
            clauses.push([-exactlyTwo, X(cj, t, ri)]);
            for (let ck = 0; ck < C.length; ck++) {
              if (ck === assassinIdx || ck === ci || ck === cj) continue;
              clauses.push([-exactlyTwo, -X(ck, t, ri)]);
            }

            const others = [];
            for (let ck = 0; ck < C.length; ck++) {
              if (ck === assassinIdx || ck === ci || ck === cj) continue;
              others.push(X(ck, t, ri));
            }
            clauses.push([
              exactlyTwo,
              -X(assassinIdx, t, ri),
              -X(ci, t, ri),
              -X(cj, t, ri),
              ...others,
            ]);

            clauses.push([-exactlyTwo, isPoisonMoment]);
          }
        }

        for (let ci = 0; ci < C.length; ci++) {
          if (ci === assassinIdx) continue;

          const exactlyOne = vp.get(`exactlyOne_${t}_${ri}_${ci}`);

          clauses.push([-exactlyOne, X(assassinIdx, t, ri)]);
          clauses.push([-exactlyOne, X(ci, t, ri)]);
          for (let ck = 0; ck < C.length; ck++) {
            if (ck === assassinIdx || ck === ci) continue;
            clauses.push([-exactlyOne, -X(ck, t, ri)]);
          }

          const others = [];
          for (let ck = 0; ck < C.length; ck++) {
            if (ck === assassinIdx || ck === ci) continue;
            others.push(X(ck, t, ri));
          }
          clauses.push([
            exactlyOne,
            -X(assassinIdx, t, ri),
            -X(ci, t, ri),
            ...others,
          ]);

          clauses.push([-exactlyOne, isPoisonMoment]);
        }
      }
    }
    privKeys.V = V;
    privKeys.PT = PT;
    privKeys.PR = PR;
  }

  // S7: Aggrosassin
  let AGG = null;
  if (config.scenarios.s7) {
    if (T < 2) throw new Error("S7 requires at least two timesteps");
    if (C.length < 2) throw new Error("S7 requires at least two characters");

    const requiredKills = Math.max(2, Math.ceil(T / 2));
    if (C.length - 1 < requiredKills) {
      throw new Error(
        "S7 requires at least as many potential victims as required kills",
      );
    }

    AGG = C.map((_, ci) => vp.get(`AGG_${C[ci]}`));
    clauses.push(...exactlyOne(AGG));

    const killTimeVars = Array.from({ length: C.length }, () =>
      Array(T).fill(null),
    );
    const killVictimVars = Array.from({ length: C.length }, () =>
      Array.from({ length: C.length }, () => Array(T).fill(null)),
    );

    for (let ci = 0; ci < C.length; ci++) {
      for (let t = 0; t < T; t++) {
        const kt = vp.get(`AGGKillTime_${C[ci]}_${t}`);
        killTimeVars[ci][t] = kt;
        clauses.push([-kt, AGG[ci]]);
      }

      for (let vj = 0; vj < C.length; vj++) {
        if (ci === vj) continue;
        const victimsAtTimes = [];
        for (let t = 0; t < T; t++) {
          const kv = vp.get(`AGGKillVictim_${C[ci]}_${C[vj]}_${t}`);
          killVictimVars[ci][vj][t] = kv;
          victimsAtTimes.push(kv);
          clauses.push([-kv, AGG[ci]]);
          clauses.push([-kv, killTimeVars[ci][t]]);
        }
      }
    }

    for (let ci = 0; ci < C.length; ci++) {
      for (let t = 0; t < T; t++) {
        const choices = [];
        for (let vj = 0; vj < C.length; vj++) {
          if (ci === vj) continue;
          const kv = killVictimVars[ci][vj][t];
          if (kv) choices.push(kv);
        }
        if (choices.length) {
          clauses.push([-killTimeVars[ci][t], ...choices]);
        } else {
          clauses.push([-killTimeVars[ci][t]]);
        }
      }
    }

    for (let ci = 0; ci < C.length; ci++) {
      for (let vj = 0; vj < C.length; vj++) {
        if (ci === vj) continue;
        for (let t = 0; t < T; t++) {
          const kv = killVictimVars[ci][vj][t];
          if (!kv) continue;
          const detailVars = [];
          for (let ri = 0; ri < R.length; ri++) {
            const detail = vp.get(
              `AGGKillDetail_${C[ci]}_${C[vj]}_${t}_${R[ri]}`,
            );
            detailVars.push(detail);
            clauses.push([-detail, AGG[ci]]);
            clauses.push([-detail, kv]);
            clauses.push([-detail, X(ci, t, ri)]);
            clauses.push([-detail, X(vj, t, ri)]);
            for (let ck = 0; ck < C.length; ck++) {
              if (ck === ci || ck === vj) continue;
              clauses.push([-detail, -X(ck, t, ri)]);
            }

            const reverse = [-AGG[ci], -X(ci, t, ri), -X(vj, t, ri)];
            for (let ck = 0; ck < C.length; ck++) {
              if (ck === ci || ck === vj) continue;
              reverse.push(X(ck, t, ri));
            }
            reverse.push(detail);
            clauses.push(reverse);
          }
          if (detailVars.length) {
            clauses.push([-kv, ...detailVars]);
          } else {
            clauses.push([-kv]);
          }
        }
      }
    }

    for (let ci = 0; ci < C.length; ci++) {
      for (let vj = 0; vj < C.length; vj++) {
        if (ci === vj) continue;
        const victimOccurrences = killVictimVars[ci][vj].filter(Boolean);
        if (victimOccurrences.length > 1) {
          const uniqueVictimClauses = atMostOne(victimOccurrences);
          for (const clause of uniqueVictimClauses) {
            clauses.push([-AGG[ci], ...clause]);
          }
        }
      }
    }

    for (let ak = 0; ak < C.length; ak++) {
      for (let ci = 0; ci < C.length; ci++) {
        if (ci === ak) continue;
        for (let cj = ci + 1; cj < C.length; cj++) {
          if (cj === ak) continue;
          for (let t = 0; t < T; t++) {
            for (let ri = 0; ri < R.length; ri++) {
              const clause = [
                -AGG[ak],
                -X(ci, t, ri),
                -X(cj, t, ri),
                X(ak, t, ri),
              ];
              for (let ck = 0; ck < C.length; ck++) {
                if (ck === ak || ck === ci || ck === cj) continue;
                clause.push(X(ck, t, ri));
              }
              clauses.push(clause);
            }
          }
        }
      }
    }

    for (let ci = 0; ci < C.length; ci++) {
      const killTimes = killTimeVars[ci];
      if (requiredKills > killTimes.length) {
        clauses.push([-AGG[ci]]);
      } else if (requiredKills > 0) {
        const combos = atLeastK(killTimes, requiredKills);
        for (const combo of combos) {
          clauses.push([-AGG[ci], ...combo]);
        }
      }
    }

    privKeys.AGG = AGG;
  }

  // S8: Freeze
  let FRZ = null;
  if (config.scenarios && config.scenarios.s8) {
    if (T < 2) throw new Error("S8 requires at least two timesteps");
    if (C.length < 2) throw new Error("S8 requires at least two characters");

    // Randomly choose which character is the freeze based on seed
    const rng = mulberry32(resolvedSeed);
    const freezeIdx = Math.floor(rng() * C.length);

    FRZ = C.map((_, ci) => vp.get(`FRZ_${C[ci]}`));
    clauses.push(...exactlyOne(FRZ));

    // Force the randomly chosen character to be the freeze
    clauses.push([FRZ[freezeIdx]]);

    const freezeDetailByVictim = Array.from({ length: C.length }, () =>
      Array.from({ length: T }, () =>
        Array.from({ length: R.length }, () => []),
      ),
    );

    // Randomize freeze constraints based on seed (reuse RNG from freeze selection)
    // Randomly choose number of required kills (1-3)
    const numRequiredKills = Math.floor(rng() * 3) + 1; // 1, 2, or 3

    // Randomly choose which timesteps must have kills (excluding final timestep)
    const availableTimesteps = Array.from({ length: T - 1 }, (_, i) => i);
    const requiredKillTimesteps = [];
    for (
      let i = 0;
      i < Math.min(numRequiredKills, availableTimesteps.length);
      i++
    ) {
      const idx = Math.floor(rng() * availableTimesteps.length);
      requiredKillTimesteps.push(availableTimesteps[idx]);
      availableTimesteps.splice(idx, 1);
    }

    const freezeKillsByTimestep = Array.from({ length: C.length }, () =>
      Array.from({ length: T }, () => []),
    );

    for (let ci = 0; ci < C.length; ci++) {
      for (let vj = 0; vj < C.length; vj++) {
        if (ci === vj) continue;
        for (let t = 0; t < T; t++) {
          for (let ri = 0; ri < R.length; ri++) {
            const detail = vp.get(`FRZKill_${C[ci]}_${C[vj]}_${t}_${R[ri]}`);
            freezeDetailByVictim[vj][t][ri].push(detail);
            freezeKillsByTimestep[ci][t].push(detail);

            clauses.push([-detail, FRZ[ci]]);
            clauses.push([-detail, X(ci, t, ri)]);
            clauses.push([-detail, X(vj, t, ri)]);
            for (let ck = 0; ck < C.length; ck++) {
              if (ck === ci || ck === vj) continue;
              clauses.push([-detail, -X(ck, t, ri)]);
            }

            const reverse = [-FRZ[ci], -X(ci, t, ri), -X(vj, t, ri)];
            for (let ck = 0; ck < C.length; ck++) {
              if (ck === ci || ck === vj) continue;
              reverse.push(X(ck, t, ri));
            }
            reverse.push(detail);
            clauses.push(reverse);

            for (let u = t; u < T; u++) {
              clauses.push([-detail, X(vj, u, ri)]);
            }
          }
        }
      }
    }

    // Require kills at the randomly chosen timesteps
    for (let ci = 0; ci < C.length; ci++) {
      for (const t of requiredKillTimesteps) {
        const killsAtTime = freezeKillsByTimestep[ci][t];
        if (killsAtTime.length === 0) {
          throw new Error(
            `S8 requires a kill opportunity at timestep ${t + 1}`,
          );
        }
        clauses.push([-FRZ[ci], ...killsAtTime]);
      }
    }

    if (config.mustMove) {
      const freezeSupports = Array.from({ length: C.length }, () =>
        Array.from({ length: T }, () =>
          Array.from({ length: R.length }, () => []),
        ),
      );

      for (let vi = 0; vi < C.length; vi++) {
        for (let ri = 0; ri < R.length; ri++) {
          const seen = new Set();
          for (let t = 0; t < T; t++) {
            for (const detail of freezeDetailByVictim[vi][t][ri]) {
              seen.add(detail);
            }
            freezeSupports[vi][t][ri] = Array.from(seen);
          }
        }
      }

      for (let vi = 0; vi < C.length; vi++) {
        for (let t = 0; t < T - 1; t++) {
          for (let ri = 0; ri < R.length; ri++) {
            const clause = [-X(vi, t, ri), -X(vi, t + 1, ri)];
            const support = freezeSupports[vi][t][ri];
            if (support.length) {
              clause.push(...support);
            }
            clauses.push(clause);
          }
        }
      }
    }

    privKeys.FRZ = FRZ;
  }

  // S9: Doctor heals frozen characters
  if (config.scenarios && config.scenarios.s9) {
    if (T < 3) throw new Error("S9 requires at least three timesteps");
    if (C.length < 2) throw new Error("S9 requires at least two characters");
    if (R.length < 2) throw new Error("S9 requires at least two rooms");

    const limitAtMostK = (vars, k) => {
      if (k >= vars.length) return;
      const combo = (start, chosen) => {
        if (chosen.length === k + 1) {
          clauses.push(chosen.map((v) => -v));
          return;
        }
        for (let i = start; i < vars.length; i++) {
          chosen.push(vars[i]);
          combo(i + 1, chosen);
          chosen.pop();
        }
      };
      combo(0, []);
    };

    const limitAtLeastK = (vars, k) => {
      if (k <= 0) return;
      const maxFalse = Math.max(0, vars.length - k);
      if (maxFalse === 0) {
        for (const v of vars) clauses.push([v]);
        return;
      }
      limitAtMostK(
        vars.map((v) => -v),
        maxFalse,
      );
    };

    const targetFrozenRatio = Math.max(
      0.2,
      Math.min(0.8, Number(config.scenarios.s9FrozenRatio ?? 0.3) || 0.3),
    );
    const targetFrozen = Math.max(
      1,
      Math.round(C.length * targetFrozenRatio),
    );
    const slack = Math.max(1, Math.round(C.length * 0.15));
    const minFrozen = Math.max(1, targetFrozen - slack);
    const maxFrozen = Math.min(C.length - 1, targetFrozen + slack);
    const frozenMin = Math.min(minFrozen, maxFrozen);
    const frozenMax = Math.max(minFrozen, maxFrozen);

    const DOC = C.map((_, ci) => vp.get(`S9Doctor_${C[ci]}`));
    const FROZ = C.map((_, ci) => vp.get(`S9Frozen_${C[ci]}`));
    const Heal = Array.from({ length: C.length }, () => Array(T).fill(null));
    const Freed = Array.from({ length: C.length }, () => Array(T).fill(null));
    const DocAt = Array.from({ length: T }, () => Array(R.length).fill(null));
    const LeftStart = C.map((_, ci) => vp.get(`S9Left_${C[ci]}`));
    const FrozenMoved = C.map((_, ci) => vp.get(`S9FrozenMoved_${C[ci]}`));
    const diffDetails = Array.from({ length: C.length }, () => []);

    clauses.push(...exactlyOne(DOC));

    for (let ci = 0; ci < C.length; ci++) {
      clauses.push([-DOC[ci], -FROZ[ci]]);
    }

    limitAtLeastK(FROZ, frozenMin);
    limitAtMostK(FROZ, frozenMax);

    for (let t = 0; t < T; t++) {
      for (let ri = 0; ri < R.length; ri++) {
        const docAtVar = vp.get(`S9DocAt_${t}_${R[ri]}`);
        DocAt[t][ri] = docAtVar;
        for (let ci = 0; ci < C.length; ci++) {
          clauses.push([-DOC[ci], -X(ci, t, ri), docAtVar]);
          clauses.push([-docAtVar, -DOC[ci], X(ci, t, ri)]);
        }
      }
    }

    const healNotFirst = [];
    const healNotLast = [];

    for (let ci = 0; ci < C.length; ci++) {
      for (let t = 0; t < T; t++) {
        const healName = `S9Heal_${C[ci]}_${t}`;
        const freeName = `S9Freed_${C[ci]}_${t}`;
        const healVar = vp.get(healName);
        const freeVar = vp.get(freeName);
        Heal[ci][t] = healVar;
        Freed[ci][t] = freeVar;

        clauses.push([-healVar, FROZ[ci]]);
        clauses.push([-healVar, freeVar]);

        if (t === 0) {
          clauses.push([FROZ[ci], freeVar]);
          clauses.push([-FROZ[ci], -freeVar, healVar]);
        } else {
          clauses.push([-Freed[ci][t - 1], freeVar]);
          clauses.push([-freeVar, Freed[ci][t - 1], healVar]);
          clauses.push([-healVar, -Freed[ci][t - 1]]);
        }

        if (t > 0) healNotFirst.push(healVar);
        if (t < T - 1) healNotLast.push(healVar);

        for (let ri = 0; ri < R.length; ri++) {
          clauses.push([-healVar, -X(ci, t, ri), DocAt[t][ri]]);
        }

        if (t === 0) {
          for (let ri = 0; ri < R.length; ri++) {
            clauses.push([-FROZ[ci], -X(ci, 0, ri), -DocAt[0][ri], healVar]);
          }
        } else {
          for (let ri = 0; ri < R.length; ri++) {
            clauses.push([
              -FROZ[ci],
              Freed[ci][t - 1],
              -X(ci, t, ri),
              -DocAt[t][ri],
              healVar,
            ]);
          }
        }

        if (t < T - 1) {
          for (let ri = 0; ri < R.length; ri++) {
            clauses.push([freeVar, -X(ci, t, ri), X(ci, t + 1, ri)]);
          }
        }
      }
    }

    clauses.push(healNotFirst);
    clauses.push(healNotLast);

    for (let ci = 0; ci < C.length; ci++) {
      for (let ri = 0; ri < R.length; ri++) {
        for (let rj = 0; rj < R.length; rj++) {
          if (ri === rj) continue;
          const detail = vp.get(`S9LeftDetail_${C[ci]}_${R[ri]}_${R[rj]}`);
          diffDetails[ci].push(detail);
          clauses.push([-detail, X(ci, 0, ri)]);
          clauses.push([-detail, X(ci, T - 1, rj)]);
          clauses.push([-X(ci, 0, ri), -X(ci, T - 1, rj), detail]);
          clauses.push([-detail, LeftStart[ci]]);
        }
      }
      if (diffDetails[ci].length) {
        clauses.push([-LeftStart[ci], ...diffDetails[ci]]);
      } else {
        clauses.push([-LeftStart[ci]]);
      }
      clauses.push([-LeftStart[ci], FROZ[ci]]);
      clauses.push([-FrozenMoved[ci], FROZ[ci]]);
      clauses.push([-FrozenMoved[ci], LeftStart[ci]]);
      clauses.push([-FROZ[ci], -LeftStart[ci], FrozenMoved[ci]]);
      const healsAfterFirst = [];
      for (let t = 1; t < T; t++) healsAfterFirst.push(Heal[ci][t]);
      if (healsAfterFirst.length) {
        clauses.push([-FrozenMoved[ci], ...healsAfterFirst]);
      } else {
        clauses.push([-FrozenMoved[ci]]);
      }
      clauses.push([-Heal[ci][0], -FrozenMoved[ci]]);
    }

    clauses.push(FrozenMoved.slice());

    privKeys.S9 = true;
  }

  // S4: Bomb duo
  // Constraint: A1 and A2 are the ONLY pair ever alone together (exactly 2 people in a room)
  let A1 = null,
    A2 = null;
  if (config.scenarios.s4) {
    A1 = C.map((_, ci) => vp.get(`A1_${C[ci]}`));
    A2 = C.map((_, ci) => vp.get(`A2_${C[ci]}`));
    clauses.push(...exactlyOne(A1));
    clauses.push(...exactlyOne(A2));
    for (let ci = 0; ci < C.length; ci++) {
      clauses.push([-A1[ci], -A2[ci]]);
    }

    // Bombers are the ONLY pair ever alone together
    const bomberAloneChoices = Array.from({ length: C.length }, () =>
      Array.from({ length: C.length }, () => []),
    );

    for (let t = 0; t < T; t++) {
      for (let ri = 0; ri < R.length; ri++) {
        for (let ci = 0; ci < C.length; ci++) {
          for (let cj = ci + 1; cj < C.length; cj++) {
            const exactlyTwo = vp.get(`exactlyTwo_${t}_${ri}_${ci}_${cj}`);

            bomberAloneChoices[ci][cj].push(exactlyTwo);
            bomberAloneChoices[cj][ci].push(exactlyTwo);

            clauses.push([-exactlyTwo, X(ci, t, ri)]);
            clauses.push([-exactlyTwo, X(cj, t, ri)]);

            for (let ck = 0; ck < C.length; ck++) {
              if (ck === ci || ck === cj) continue;
              clauses.push([-exactlyTwo, -X(ck, t, ri)]);
            }

            const someoneElse = [];
            for (let ck = 0; ck < C.length; ck++) {
              if (ck === ci || ck === cj) continue;
              someoneElse.push(X(ck, t, ri));
            }
            clauses.push([
              exactlyTwo,
              -X(ci, t, ri),
              -X(cj, t, ri),
              ...someoneElse,
            ]);

            const pair1 = vp.get(`pair1_${ci}_${cj}`);
            const pair2 = vp.get(`pair2_${ci}_${cj}`);

            clauses.push([-pair1, A1[ci]]);
            clauses.push([-pair1, A2[cj]]);
            clauses.push([-A1[ci], -A2[cj], pair1]);

            clauses.push([-pair2, A1[cj]]);
            clauses.push([-pair2, A2[ci]]);
            clauses.push([-A1[cj], -A2[ci], pair2]);

            clauses.push([-exactlyTwo, pair1, pair2]);
          }
        }
      }
    }

    for (let ci = 0; ci < C.length; ci++) {
      for (let cj = ci + 1; cj < C.length; cj++) {
        const choices = bomberAloneChoices[ci][cj];
        if (!choices.length) continue;
        clauses.push([-A1[ci], -A2[cj], ...choices]);
        clauses.push([-A1[cj], -A2[ci], ...choices]);
      }
    }

    privKeys.A1 = A1;
    privKeys.A2 = A2;
  }

  return { vp, clauses, privKeys };
}

/* ===========================
   Decode & Clues
   =========================== */

export function solveAndDecode(cfg) {
  const seed = resolveSeed(cfg.seed);
  cfg = { ...cfg, seed };

  const { vp, clauses, privKeys } = buildCNF(cfg);
  const numVars = vp.count();
  const solveStartTime = Date.now();
  const sol = satSolve(clauses, numVars, seed);
  const solveTime = Date.now() - solveStartTime;
  if (!sol) return null;

  const val = (name) => sol[vp.get(name)] === true;

  const R = cfg.rooms,
    C = cfg.chars,
    T = cfg.T;
  const schedule = {};
  for (let ci = 0; ci < C.length; ci++) {
    const row = [];
    for (let t = 0; t < T; t++) {
      let found = "(none)";
      for (let ri = 0; ri < R.length; ri++) {
        if (val(`X_${C[ci]}_${t}_${R[ri]}`)) {
          found = R[ri];
          break;
        }
      }
      row.push(found);
    }
    schedule[C[ci]] = row;
  }

  const byTime = {};
  for (let t = 0; t < T; t++) {
    const counts = {};
    R.forEach((r) => (counts[r] = 0));
    for (let ci = 0; ci < C.length; ci++) {
      const r = schedule[C[ci]][t];
      if (counts[r] != null) counts[r]++;
    }
    byTime[t + 1] = counts;
  }

  const visits = {};
  for (let ci = 0; ci < C.length; ci++) {
    const v = {};
    R.forEach((r) => (v[r] = 0));
    for (let t = 0; t < T; t++) {
      v[schedule[C[ci]][t]]++;
    }
    visits[C[ci]] = v;
  }

  const priv = {};
  if (privKeys.PH) {
    for (let ci = 0; ci < C.length; ci++) {
      if (val(`PH_${C[ci]}`)) {
        priv.phantom = C[ci];
        break;
      }
    }
  }
  if (privKeys.L1 && privKeys.L2) {
    let l1 = null,
      l2 = null;
    for (let ci = 0; ci < C.length; ci++) {
      if (val(`L1_${C[ci]}`)) l1 = C[ci];
      if (val(`L2_${C[ci]}`)) l2 = C[ci];
    }
    if (l1 && l2) priv.lovers = [l1, l2];
  }
  if (privKeys.V && privKeys.PT && privKeys.PR) {
    let victim = null,
      pTime = null,
      pRoom = null;
    const assassin = C[0];
    for (let ci = 0; ci < C.length; ci++) if (val(`V_${C[ci]}`)) victim = C[ci];
    for (let t = 0; t < T; t++) if (val(`PT_${t}`)) pTime = t + 1;
    for (let ri = 0; ri < R.length; ri++) if (val(`PR_${R[ri]}`)) pRoom = R[ri];
    priv.assassin = assassin;
    priv.victim = victim;
    priv.poison_time = pTime;
    priv.poison_room = pRoom;
  }
  if (privKeys.A1 && privKeys.A2) {
    let a1 = null,
      a2 = null;
    for (let ci = 0; ci < C.length; ci++) {
      if (val(`A1_${C[ci]}`)) a1 = C[ci];
      if (val(`A2_${C[ci]}`)) a2 = C[ci];
    }
    priv.bomb_duo = [a1, a2];
  }
  if (privKeys.AGG) {
    let agg = null;
    for (let ci = 0; ci < C.length; ci++) if (val(`AGG_${C[ci]}`)) agg = C[ci];

    // Calculate victims (characters alone with aggrosassin)
    const victims = new Set();
    for (let t = 0; t < T; t++) {
      for (const room of R) {
        const charsInRoom = C.filter((c) => schedule[c][t] === room);
        if (charsInRoom.length === 2 && charsInRoom.includes(agg)) {
          const victim = charsInRoom.find((c) => c !== agg);
          victims.add(victim);
        }
      }
    }

    priv.aggrosassin = agg;
    priv.victims = Array.from(victims);
  }
  if (privKeys.FRZ) {
    let freezeChar = null;
    for (let ci = 0; ci < C.length; ci++) {
      if (val(`FRZ_${C[ci]}`)) {
        freezeChar = C[ci];
        break;
      }
    }
    if (freezeChar) {
      const victims = new Set();
      const seenVictims = new Set();
      const killRecords = [];
      for (let t = 0; t < T; t++) {
        const room = schedule[freezeChar][t];
        const charsInRoom = C.filter((c) => schedule[c][t] === room);
        if (charsInRoom.length === 2) {
          const victim = charsInRoom.find((c) => c !== freezeChar);
          if (victim) {
            victims.add(victim);
            if (!seenVictims.has(victim)) {
              seenVictims.add(victim);
              killRecords.push({ victim, time: t + 1, room });
            }
          }
        }
      }
      priv.freeze = freezeChar;
      priv.freeze_victims = Array.from(victims);
      priv.freeze_kills = killRecords;
    }
  }
  if (privKeys.S9) {
    let doctor = null;
    const frozen = [];
    const heals = [];
    for (let ci = 0; ci < C.length; ci++) {
      const ch = C[ci];
      if (val(`S9Doctor_${ch}`)) doctor = ch;
      if (val(`S9Frozen_${ch}`)) frozen.push(ch);
      for (let t = 0; t < T; t++) {
        if (val(`S9Heal_${ch}_${t}`)) {
          heals.push({ character: ch, time: t + 1, room: schedule[ch][t] });
        }
      }
    }
    if (doctor) priv.doctor = doctor;
    if (frozen.length) priv.frozen = frozen;
    if (heals.length) priv.heals = heals;
  }

  if (privKeys.S10) {
    const contagiousRoom =
      typeof privKeys.S10 === "string" ? privKeys.S10 : [...R].sort()[0];
    const infectionTimes = {};
    const infectionTimeline = [];
    const infected = new Set();

    const markInfected = (ch, time) => {
      if (infectionTimes[ch] != null) return false;
      infectionTimes[ch] = time;
      infected.add(ch);
      return true;
    };

    for (const ch of C) {
      infectionTimes[ch] = null;
    }

    for (let t = 0; t < T; t++) {
      const newly = [];

      for (const ch of C) {
        if (schedule[ch][t] === contagiousRoom) {
          if (markInfected(ch, t + 1)) newly.push(ch);
        }
      }

      const occupantsByRoom = new Map();
      for (const room of R) {
        occupantsByRoom.set(room, []);
      }
      for (const ch of C) {
        const room = schedule[ch][t];
        occupantsByRoom.get(room).push(ch);
      }

      for (const room of R) {
        const occupants = occupantsByRoom.get(room) || [];
        const hasInfected = occupants.some((ch) => infected.has(ch));
        if (hasInfected) {
          for (const ch of occupants) {
            if (markInfected(ch, t + 1)) newly.push(ch);
          }
        }
      }

      if (newly.length) {
        infectionTimeline.push({ time: t + 1, characters: newly.sort() });
      }
    }

    const infectionOrder = Object.entries(infectionTimes)
      .filter(([, time]) => time !== null)
      .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] - b[1]))
      .map(([ch]) => ch);

    const neverInfected = C.filter((ch) => infectionTimes[ch] === null);

    priv.contagion = {
      contagious_room: contagiousRoom,
      infection_times: infectionTimes,
      infection_order: infectionOrder,
      infection_timeline: infectionTimeline,
      infected_count: infected.size,
      never_infected: neverInfected,
    };
  }

  if (privKeys.S11) {
    let keyHolder = null;
    if (privKeys.S11.KH) {
      for (let ci = 0; ci < C.length; ci++) {
        if (val(`S11_KH_${C[ci]}`)) {
          keyHolder = C[ci];
          break;
        }
      }
    }
    const vaultRoom = privKeys.S11.vaultRoom || [...R].sort()[0];
    const visitors = new Set();
    for (const ch of C) {
      for (let t = 0; t < T; t++) {
        if (schedule[ch][t] === vaultRoom) visitors.add(ch);
      }
    }

    priv.vault = {
      key_holder: keyHolder,
      vault_room: vaultRoom,
      vault_visitors: Array.from(visitors).sort(),
    };
  }

  if (privKeys.S12) {
    const glueRoom = privKeys.S12.glueRoom;
    const firstEntries = {};

    for (const ch of C) {
      let entryTime = null;
      for (let t = 0; t < T; t++) {
        const here = schedule[ch][t] === glueRoom;
        const cameFromOther = t === 0 || schedule[ch][t - 1] !== glueRoom;
        if (here && cameFromOther) {
          entryTime = t + 1;
          break;
        }
      }
      firstEntries[ch] = entryTime;
    }

    priv.glue_room = { glue_room: glueRoom, first_entries: firstEntries };
  }

  if (privKeys.S13) {
    let gluePerson = null;
    if (privKeys.S13.GS) {
      for (let ci = 0; ci < C.length; ci++) {
        if (val(`S13_GLUE_${C[ci]}`)) {
          gluePerson = C[ci];
          break;
        }
      }
    }

    const stuckRecords = [];
    if (gluePerson) {
      const firstStuck = new Map();
      for (let t = 0; t < T; t++) {
        const room = schedule[gluePerson][t];
        for (const ch of C) {
          if (ch === gluePerson) continue;
          if (schedule[ch][t] === room && !firstStuck.has(ch)) {
            firstStuck.set(ch, { character: ch, time: t + 1, room });
          }
        }
      }
      stuckRecords.push(...Array.from(firstStuck.values()).sort((a, b) => a.time - b.time));
    }

    priv.glue_shoes = { glue_person: gluePerson, stuck: stuckRecords };
  }

  if (privKeys.S14) {
    const simulateCurse = (origin) => {
      let carriers = new Set([origin]);
      const timeline = [];

      for (let t = 0; t < T; t++) {
        const byRoom = new Map();
        for (const room of R) byRoom.set(room, []);
        for (const ch of C) {
          const room = schedule[ch][t];
          byRoom.get(room).push(ch);
        }

        const updatedCarriers = new Set(carriers);

        for (const room of R) {
          const occupants = byRoom.get(room);
          if (!occupants.length) continue;
          const cursedHere = occupants.filter((ch) => carriers.has(ch));
          const uncursedHere = occupants.filter((ch) => !carriers.has(ch));

          if (!cursedHere.length || !uncursedHere.length) continue;

          cursedHere.forEach((ch) => updatedCarriers.delete(ch));
          uncursedHere.forEach((ch) => updatedCarriers.add(ch));
        }

        timeline.push({ time: t + 1, cursed: Array.from(updatedCarriers).sort() });
        carriers = updatedCarriers;
      }

      const finalCursed = timeline[timeline.length - 1]?.cursed || [];
      return { timeline, cursedAtSix: timeline[5]?.cursed || finalCursed };
    };

    const outcomes = [];
    const cursedAtTime6ByOrigin = {};
    const rng = cfg.seed == null ? Math.random : mulberry32(cfg.seed);

    for (const ch of C) {
      const sim = simulateCurse(ch);
      cursedAtTime6ByOrigin[ch] = sim.cursedAtSix;
      outcomes.push({ origin: ch, finalKey: sim.cursedAtSix.join("|") || "-", sim });
    }

    const finalKeyCounts = outcomes.reduce((acc, outcome) => {
      acc[outcome.finalKey] = (acc[outcome.finalKey] || 0) + 1;
      return acc;
    }, {});

    const uniqueOutcomes = outcomes.filter(
      (outcome) => finalKeyCounts[outcome.finalKey] === 1,
    );
    const pool = uniqueOutcomes.length ? uniqueOutcomes : outcomes;
    const chosen = pool[Math.floor(rng() * pool.length)];

    const possibleOrigins = outcomes
      .filter((o) => o.finalKey === chosen.finalKey)
      .map((o) => o.origin)
      .sort();

    priv.curse_of_amarinta = {
      origin: chosen.origin,
      final_cursed: chosen.sim.cursedAtSix,
      possible_origins: possibleOrigins,
      cursed_at_time6_by_origin: cursedAtTime6ByOrigin,
      timeline: chosen.sim.timeline,
    };
  }

  // S15: World Travelers decoding
  if (privKeys.S15) {
    // Count unique rooms visited by each character
    const visitCounts = {};
    const roomsVisitedByChar = {};
    for (const ch of C) {
      const roomsVisited = new Set();
      for (let t = 0; t < T; t++) {
        roomsVisited.add(schedule[ch][t]);
      }
      visitCounts[ch] = roomsVisited.size;
      roomsVisitedByChar[ch] = Array.from(roomsVisited).sort();
    }

    // Calculate rooms missed by podium finishers relative to map
    const secondMissed = R.filter(
      (room) => !roomsVisitedByChar[privKeys.S15.second].includes(room),
    );
    const thirdMissed = R.filter(
      (room) => !roomsVisitedByChar[privKeys.S15.third].includes(room),
    );

    priv.world_travelers = {
      first: privKeys.S15.first,
      second: privKeys.S15.second,
      third: privKeys.S15.third,
      targets: privKeys.S15.targets,
      visit_counts: visitCounts,
      rooms_visited: roomsVisitedByChar,
      rooms_missed: {
        first: R.filter((room) => !roomsVisitedByChar[privKeys.S15.first].includes(room)),
        second: secondMissed,
        third: thirdMissed,
      },
    };
  }

  // S16: Homebodies decoding
  if (privKeys.S16) {
    const visitCounts = {};
    const roomsVisitedByChar = {};
    for (const ch of C) {
      const roomsVisited = new Set();
      for (let t = 0; t < T; t++) {
        roomsVisited.add(schedule[ch][t]);
      }
      visitCounts[ch] = roomsVisited.size;
      roomsVisitedByChar[ch] = Array.from(roomsVisited).sort();
    }

    // Sort characters by visit count to create ranking
    const ranking = [...C].sort((a, b) => visitCounts[a] - visitCounts[b]);

    priv.homebodies = {
      homebody: privKeys.S16.homebody,
      visit_count_assignments: privKeys.S16.visitCountAssignments,
      visit_count_targets: privKeys.S16.visitCountTargets,
      min_visit_count: privKeys.S16.minVisitCount,
      actual_visit_counts: visitCounts,
      rooms_visited: roomsVisitedByChar,
      ranking, // sorted from fewest to most rooms visited
    };
  }

  // S3: Singer's Jewels decoding - compute jewel passing chain
  if (cfg.scenarios && cfg.scenarios.s3) {
    const jewelRoom = [...R].sort()[0];

    // Find who visits the jewel room alone first (earliest timestep)
    let firstThief = null;
    let firstThiefTime = null;
    for (let t = 0; t < T; t++) {
      const visitorsAtT = C.filter((ch) => schedule[ch][t] === jewelRoom);
      if (visitorsAtT.length === 1) {
        firstThief = visitorsAtT[0];
        firstThiefTime = t + 1;
        break;
      }
    }

    // Simulate jewel passing: jewels pass when holder meets exactly one other person
    const passingChain = [];
    let currentHolder = firstThief;

    if (currentHolder) {
      passingChain.push({ holder: currentHolder, time: firstThiefTime, room: jewelRoom, event: 'pickup' });

      for (let t = (firstThiefTime - 1); t < T; t++) {
        if (!currentHolder) break;
        const holderRoom = schedule[currentHolder][t];
        const occupants = C.filter(ch => schedule[ch][t] === holderRoom);

        // Jewels pass when holder meets exactly one other person (2 people total in room)
        if (occupants.length === 2) {
          const otherPerson = occupants.find(ch => ch !== currentHolder);
          if (otherPerson && otherPerson !== currentHolder) {
            passingChain.push({
              from: currentHolder,
              to: otherPerson,
              time: t + 1,
              room: holderRoom,
              event: 'pass'
            });
            currentHolder = otherPerson;
          }
        }
      }
    }

    // Who has the jewels at the end?
    const finalHolder = currentHolder;

    priv.singers_jewels = {
      jewel_room: jewelRoom,
      first_thief: firstThief,
      first_thief_time: firstThiefTime,
      passing_chain: passingChain,
      final_holder: finalHolder,
      total_passes: passingChain.filter(p => p.event === 'pass').length,
    };
  }

  const stats = {
    totalVars: numVars,
    totalClauses: clauses.length,
    avgClauseLength:
      clauses.length > 0
        ? clauses.reduce((sum, c) => sum + c.length, 0) / clauses.length
        : 0,
    solveTimeMs: solveTime,
  };

  return { schedule, byTime, visits, priv, meta: { vars: numVars }, stats };
}

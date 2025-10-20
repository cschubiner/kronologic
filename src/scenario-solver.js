/* ===========================
   Minimal SAT (DPLL + Unit)
   =========================== */
function mulberry32(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}}

export function satSolve(clauses, numVars, randSeed=0, timeoutMs=12000) {
  // Clauses: array of arrays of ints, var IDs are 1..numVars, negative = negated
  // Returns: assignment array with 1..numVars: true/false, or null if UNSAT/timeout
  const rng = mulberry32(randSeed);
  const startTime = Date.now();
  let assigns = new Array(numVars+1).fill(0); // 0=unassigned, 1=true, -1=false
  let occPos = Array.from({length:numVars+1}, ()=>[]);
  let occNeg = Array.from({length:numVars+1}, ()=>[]);
  for (let i=0;i<clauses.length;i++){
    const c = clauses[i];
    for (const lit of c){
      const v = Math.abs(lit);
      if (lit>0) occPos[v].push(i); else occNeg[v].push(i);
    }
  }

  function assignLiteral(lit, trail){
    const v = Math.abs(lit);
    const val = lit>0 ? 1 : -1;
    const current = assigns[v];
    if (current !== 0){
      return current === val;
    }
    assigns[v] = val;
    trail.push(v);
    return true;
  }

  function unitProp(queue, trail){
    while (queue.length){
      const lit = queue.pop();
      if (!assignLiteral(lit, trail)) return false;
      const v = Math.abs(lit);
      const val = lit>0 ? 1 : -1;
      const remList = val>0 ? occNeg[v] : occPos[v];
      for (const ci of remList){
        const clause = clauses[ci];
        let satisfied = false;
        let unassigned = 0;
        let lastUnassigned = 0;
        for (const lit2 of clause){
          const v2 = Math.abs(lit2);
          const assign = assigns[v2];
          if (assign === 1 && lit2 > 0){ satisfied = true; break; }
          if (assign === -1 && lit2 < 0){ satisfied = true; break; }
          if (assign === 0){
            unassigned++;
            lastUnassigned = lit2;
          }
        }
        if (satisfied) continue;
        if (unassigned === 0) return false;
        if (unassigned === 1){
          queue.push(lastUnassigned);
        }
      }
    }
    return true;
  }

  function chooseLiteral(){
    const literalScores = new Map();
    let found = false;
    for (const clause of clauses){
      let satisfied = false;
      const unassignedLits = [];
      for (const lit of clause){
        const v = Math.abs(lit);
        const assign = assigns[v];
        if ((assign === 1 && lit > 0) || (assign === -1 && lit < 0)){
          satisfied = true;
          break;
        }
        if (assign === 0){
          unassignedLits.push(lit);
        }
      }
      if (satisfied || unassignedLits.length === 0) continue;
      found = true;
      const weight = Math.pow(2, -unassignedLits.length);
      for (const lit of unassignedLits){
        literalScores.set(lit, (literalScores.get(lit) || 0) + weight);
      }
    }
    if (found){
      const eps = 1e-12;
      let bestLit = 0;
      let bestScore = -Infinity;
      for (const [lit, score] of literalScores.entries()){
        if (score > bestScore + eps || (Math.abs(score - bestScore) <= eps && rng() < 0.5)){
          bestScore = score;
          bestLit = lit;
        }
      }
      if (bestLit !== 0) return bestLit;
    }
    for (let v=1; v<=numVars; v++){
      if (assigns[v]===0) return v;
    }
    return 0;
  }

  // initial unit clauses
  let initQ = [];
  for (const c of clauses){ if (c.length===1 && c[0]!==0) initQ.push(c[0]); }
  const trail = [];
  if (!unitProp(initQ, trail)) return null;

  function dfs(){
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('SAT_TIMEOUT');
    }

    // check all satisfied?
    let allSat = true;
    for (const clause of clauses){
      let satisfied = false;
      let unassigned = false;
      for (const lit of clause){
        const v = Math.abs(lit);
        const assign = assigns[v];
        if (assign === 0){ unassigned = true; continue; }
        if ((assign === 1 && lit > 0) || (assign === -1 && lit < 0)){
          satisfied = true;
          break;
        }
      }
      if (!satisfied){
        if (!unassigned) return false;
        allSat = false;
      }
    }
    if (allSat) return true;

    const lit = chooseLiteral();
    if (lit===0) return true; // nothing left
    // branch with suggested literal first, then opposite
    for (const tryLit of [lit, -lit]){
      const trailSize = trail.length;
      const v = Math.abs(tryLit);
      if (assigns[v] !== 0 && assigns[v] !== (tryLit>0?1:-1)) continue;
      const stack = [tryLit];
      if (unitProp(stack, trail)){
        if (dfs()) return true;
      }
      while (trail.length > trailSize){
        const reverted = trail.pop();
        assigns[reverted] = 0;
      }
    }
    return false;
  }

  try {
    if (!dfs()) return null;
  } catch (e) {
    if (e.message === 'SAT_TIMEOUT') return null;
    throw e;
  }

  // build boolean array
  const out = new Array(numVars+1);
  for (let v=1; v<=numVars; v++){
    out[v] = assigns[v]===1;
    if (assigns[v]===0) out[v]=false; // default
  }
  return out;
}

/* ===========================
   CNF Builder Helpers
   =========================== */
export function varPool(){
  let next = 1;
  const id = new Map();
  const rev = new Map();
  return {
    get(name){
      if (!id.has(name)){ id.set(name, next); rev.set(next, name); next++; }
      return id.get(name);
    },
    count(){ return next-1; },
    rev
  };
}

export function atLeastOne(cl){ // OR over literals (already in int form)
  return [cl];
}

export function atMostOne(vars){ // pairwise
  const out = [];
  for (let i=0;i<vars.length;i++) for (let j=i+1;j<vars.length;j++){
    out.push([-vars[i], -vars[j]]);
  }
  return out;
}

export function exactlyOne(vars){
  return [...atLeastOne(vars), ...atMostOne(vars)];
}

export function atLeastK(vars, k){
  if (k <= 0) return [[]];
  const n = vars.length;
  if (k > n) return [];
  const targetSize = n - k + 1;
  const combos = [];
  function backtrack(start, chosen){
    if (chosen.length === targetSize){
      combos.push(chosen.slice());
      return;
    }
    for (let i=start; i<n; i++){
      chosen.push(vars[i]);
      backtrack(i+1, chosen);
      chosen.pop();
    }
  }
  backtrack(0, []);
  return combos;
}

export function buildTotalizer(vars, vp, clauses, prefix){
  let nodeCounter = 0;

  function helper(list, tag){
    if (!list.length) return [];
    if (list.length === 1) return [list[0]];

    const mid = Math.floor(list.length / 2);
    const left = helper(list.slice(0, mid), `${tag}L`);
    const right = helper(list.slice(mid), `${tag}R`);

    const id = `${tag}_${nodeCounter++}`;
    const outLen = left.length + right.length;
    const out = new Array(outLen);

    for (let i=0; i<outLen; i++){
      out[i] = vp.get(`${prefix}_${id}_${i+1}`);
    }

    for (let i=1; i<out.length; i++){
      clauses.push([-out[i], out[i-1]]);
    }
    for (let i=0; i<left.length; i++){
      clauses.push([-left[i], out[i]]);
    }
    for (let j=0; j<right.length; j++){
      clauses.push([-right[j], out[j]]);
    }
    for (let i=0; i<left.length; i++){
      for (let j=0; j<right.length; j++){
        const idx = i + j + 1;
        if (idx < out.length){
          clauses.push([-left[i], -right[j], out[idx]]);
        }
      }
    }

    for (let i=0; i<out.length; i++){
      const support = [];
      if (i < left.length) support.push(left[i]);
      if (i < right.length) support.push(right[i]);

      for (let a=0; a<left.length; a++){
        for (let b=0; b<right.length; b++){
          if (a + b + 1 !== i) continue;
          const comb = vp.get(`${prefix}_${id}_comb_${i}_${a}_${b}`);
          clauses.push([-comb, left[a]]);
          clauses.push([-comb, right[b]]);
          clauses.push([comb, -left[a], -right[b]]);
          support.push(comb);
        }
      }

      if (support.length === 0){
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
export function parseMermaid(txt){
  // Parse Mermaid-like graph: handle quoted and unquoted room names
  const rooms = new Set();
  const edges = [];
  // Match: optional quote, capture content, optional quote, ---, repeat
  const re = /"([^"]+)"|(\S+)/g;
  const lines = txt.split(/\r?\n/);
  for (let line of lines){
    line = line.trim();
    if (!line || line.startsWith("graph")) continue;
    if (!line.includes("---")) continue;

    // Extract all quoted or unquoted tokens
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
        rooms.add(a); rooms.add(b);
        edges.push([a, b]);
      }
    }
  }
  return { rooms: Array.from(rooms), edges };
}

export function neighbors(rooms, edges, includeSelf){
  const idx = new Map(); rooms.forEach((r,i)=>idx.set(r,i));
  const nbr = Array.from({length: rooms.length}, ()=> new Set());
  for (const [a,b] of edges){
    if (!idx.has(a) || !idx.has(b)) continue;
    const i = idx.get(a), j = idx.get(b);
    nbr[i].add(j); nbr[j].add(i);
  }
  if (includeSelf){ for (let i=0;i<rooms.length;i++) nbr[i].add(i); }
  return { idx, nbr: nbr.map(s=>Array.from(s)) };
}

/* ===========================
   Problem Encoding
   =========================== */
export function buildCNF(config){
  // config: {rooms[], edges[], chars[], T, mustMove, allowStay, scenarios: {s1:{room?,time?}, s2, s4:{room?}, s5}, seed}
  const vp = varPool();
  const clauses = [];

  const R = config.rooms, C = config.chars, T = config.T;
  const baseStay = config.allowStay && !config.mustMove;
  const freezeStay = !!(config.scenarios && (config.scenarios.s8 || config.scenarios.s9));
  const { idx: Ridx, nbr } = neighbors(R, config.edges, baseStay || freezeStay);

  // Helper to get variable IDs
  const X = (ci, t, ri) => vp.get(`X_${C[ci]}_${t}_${R[ri]}`);

  // Exactly one room per (c,t)
  for (let ci=0; ci<C.length; ci++){
    for (let t=0; t<T; t++){
      const vars = [];
      for (let ri=0; ri<R.length; ri++) vars.push(X(ci,t,ri));
      clauses.push(...exactlyOne(vars));
    }
  }

  // Movement constraints
  for (let ci=0; ci<C.length; ci++){
    for (let t=0; t<T-1; t++){
      for (let ri=0; ri<R.length; ri++){
        const allowed = nbr[ri];
        const rhs = allowed.map(r2 => X(ci, t+1, r2));
        clauses.push([ -X(ci,t,ri), ...rhs ]);
      }
    }
  }

  // =========== Scenarios ===========
  const privKeys = {};

  // S3: Ensure first listed room is visited at least once
  if (config.scenarios.s3){
    if (!R.length) throw new Error('S3 requires at least one room');
    const firstRoomVar = [];
    for (let ci=0; ci<C.length; ci++){
      for (let t=0; t<T; t++){
        firstRoomVar.push(X(ci, t, 0));
      }
    }
    clauses.push(firstRoomVar);
  }

  // S2: Phantom alone at every time
  let PH = null;
  if (config.scenarios.s2){
    PH = C.map((_,ci)=> vp.get(`PH_${C[ci]}`));
    clauses.push(...exactlyOne(PH));
    for (let t=0; t<T; t++){
      for (let ri=0; ri<R.length; ri++){
        for (let ci=0; ci<C.length; ci++){
          for (let cj=0; cj<C.length; cj++){
            if (ci===cj) continue;
            clauses.push([ -PH[ci], -X(ci,t,ri), -X(cj,t,ri) ]);
          }
        }
      }
    }
    for (let ci=0; ci<C.length; ci++){
      const atLeastOnceNotAlone = [];
      for (let t=0; t<T; t++){
        for (let ri=0; ri<R.length; ri++){
          for (let cj=0; cj<C.length; cj++){
            if (ci===cj) continue;
            const bothThere = vp.get(`notAlone_${ci}_${t}_${ri}_${cj}`);
            clauses.push([-bothThere, X(ci,t,ri)]);
            clauses.push([-bothThere, X(cj,t,ri)]);
            clauses.push([-X(ci,t,ri), -X(cj,t,ri), bothThere]);
            atLeastOnceNotAlone.push(bothThere);
          }
        }
      }
      clauses.push([PH[ci], ...atLeastOnceNotAlone]);
    }
    privKeys.PH = PH;
  }

  // S5: Lovers never meet
  let L1=null, L2=null;
  if (config.scenarios.s5){
    L1 = C.map((_,ci)=> vp.get(`L1_${C[ci]}`));
    L2 = C.map((_,ci)=> vp.get(`L2_${C[ci]}`));
    clauses.push(...exactlyOne(L1));
    clauses.push(...exactlyOne(L2));
    for (let ci=0; ci<C.length; ci++){ clauses.push([ -L1[ci], -L2[ci] ]); }

    // If both S2 and S5 are enabled (S6), phantom must NOT be a lover
    // The phantom is in their own category - neither lover nor non-lover
    if (PH){
      for (let ci=0; ci<C.length; ci++){
        // PH[ci] => NOT L1[ci] AND NOT L2[ci]
        // CNF: -PH[ci] OR -L1[ci]  AND  -PH[ci] OR -L2[ci]
        clauses.push([ -PH[ci], -L1[ci] ]);
        clauses.push([ -PH[ci], -L2[ci] ]);
      }
    }

    // Lovers never meet
    for (let t=0; t<T; t++){
      for (let ri=0; ri<R.length; ri++){
        for (let c1=0; c1<C.length; c1++){
          for (let c2=0; c2<C.length; c2++){
            if (c1===c2) continue;
            clauses.push([ -L1[c1], -L2[c2], -X(c1,t,ri), -X(c2,t,ri) ]);
          }
        }
      }
    }
    
    // Every pair of non-lovers must meet at least once
    // (Phantom is excluded from this - they're neither lover nor non-lover)
    for (let ci=0; ci<C.length; ci++){
      for (let cj=ci+1; cj<C.length; cj++){
        // Create variable: ci and cj meet at least once
        const pairMeets = [];
        for (let t=0; t<T; t++){
          for (let ri=0; ri<R.length; ri++){
            const bothThere = vp.get(`loverPairMeet_${ci}_${cj}_${t}_${ri}`);
            // bothThere ⇔ (X(ci,t,ri) ∧ X(cj,t,ri))
            clauses.push([-bothThere, X(ci,t,ri)]);
            clauses.push([-bothThere, X(cj,t,ri)]);
            clauses.push([-X(ci,t,ri), -X(cj,t,ri), bothThere]);
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
  let V=null, PT=null, PR=null;
  if (config.scenarios.s1){
    const assassinIdx = 0;

    V  = C.map((_,ci)=> vp.get(`V_${C[ci]}`));
    PT = Array.from({length:T}, (_,t)=> vp.get(`PT_${t}`));
    PR = R.map((_,ri)=> vp.get(`PR_${R[ri]}`));

    clauses.push(...exactlyOne(V));
    clauses.push(...exactlyOne(PT));
    clauses.push(...exactlyOne(PR));

    clauses.push([ -V[assassinIdx] ]);

    if (config.scenarios.s1_room){
      const ri = Ridx.get(config.scenarios.s1_room);
      if (ri!=null) clauses.push([ PR[ri] ]);
    }
    if (config.scenarios.s1_time){
      const t = Number(config.scenarios.s1_time)-1;
      if (!Number.isNaN(t) && t>=0 && t<T) clauses.push([ PT[t] ]);
    }

    for (let t=0; t<T; t++){
      for (let ri=0; ri<R.length; ri++){
        for (let vi=0; vi<C.length; vi++){
          if (vi === assassinIdx) continue;

          clauses.push([ -PT[t], -PR[ri], -V[vi], X(assassinIdx, t, ri) ]);
          clauses.push([ -PT[t], -PR[ri], -V[vi], X(vi, t, ri) ]);

          for (let ci=0; ci<C.length; ci++){
            if (ci === assassinIdx || ci === vi) continue;
            clauses.push([ -PT[t], -PR[ri], -V[vi], -X(ci, t, ri) ]);
          }
        }
      }
    }

    for (let t=0; t<T; t++){
      for (let ri=0; ri<R.length; ri++){
        const isPoisonMoment = vp.get(`isPoisonMoment_${t}_${ri}`);

        const poisonClauses = [];
        for (let vi=0; vi<C.length; vi++){
          if (vi === assassinIdx) continue;
          const thisPoison = vp.get(`thisPoison_${t}_${ri}_${vi}`);
          clauses.push([-thisPoison, PT[t]]);
          clauses.push([-thisPoison, PR[ri]]);
          clauses.push([-thisPoison, V[vi]]);
          clauses.push([-PT[t], -PR[ri], -V[vi], thisPoison]);
          poisonClauses.push(thisPoison);
        }
        clauses.push([-isPoisonMoment, ...poisonClauses]);
        for (const tp of poisonClauses){
          clauses.push([-tp, isPoisonMoment]);
        }

        for (let ci=0; ci<C.length; ci++){
          if (ci === assassinIdx) continue;
          for (let cj=ci+1; cj<C.length; cj++){
            if (cj === assassinIdx) continue;

            const exactlyTwo = vp.get(`exactlyTwo_${t}_${ri}_${ci}_${cj}`);

            clauses.push([-exactlyTwo, X(assassinIdx, t, ri)]);
            clauses.push([-exactlyTwo, X(ci, t, ri)]);
            clauses.push([-exactlyTwo, X(cj, t, ri)]);
            for (let ck=0; ck<C.length; ck++){
              if (ck === assassinIdx || ck === ci || ck === cj) continue;
              clauses.push([-exactlyTwo, -X(ck, t, ri)]);
            }

            const others = [];
            for (let ck=0; ck<C.length; ck++){
              if (ck === assassinIdx || ck === ci || ck === cj) continue;
              others.push(X(ck, t, ri));
            }
            clauses.push([exactlyTwo, -X(assassinIdx, t, ri), -X(ci, t, ri), -X(cj, t, ri), ...others]);

            clauses.push([-exactlyTwo, isPoisonMoment]);
          }
        }

        for (let ci=0; ci<C.length; ci++){
          if (ci === assassinIdx) continue;

          const exactlyOne = vp.get(`exactlyOne_${t}_${ri}_${ci}`);

          clauses.push([-exactlyOne, X(assassinIdx, t, ri)]);
          clauses.push([-exactlyOne, X(ci, t, ri)]);
          for (let ck=0; ck<C.length; ck++){
            if (ck === assassinIdx || ck === ci) continue;
            clauses.push([-exactlyOne, -X(ck, t, ri)]);
          }

          const others = [];
          for (let ck=0; ck<C.length; ck++){
            if (ck === assassinIdx || ck === ci) continue;
            others.push(X(ck, t, ri));
          }
          clauses.push([exactlyOne, -X(assassinIdx, t, ri), -X(ci, t, ri), ...others]);

          clauses.push([-exactlyOne, isPoisonMoment]);
        }
      }
    }
    privKeys.V = V;
    privKeys.PT = PT;
    privKeys.PR = PR;
  }

  // S7: Aggrosassin
  let AGG=null;
  if (config.scenarios.s7){
    if (T < 2) throw new Error('S7 requires at least two timesteps');
    if (C.length < 2) throw new Error('S7 requires at least two characters');

    const requiredKills = Math.max(2, Math.ceil(T / 2));
    if (C.length - 1 < requiredKills){
      throw new Error('S7 requires at least as many potential victims as required kills');
    }

    AGG = C.map((_,ci)=> vp.get(`AGG_${C[ci]}`));
    clauses.push(...exactlyOne(AGG));

    const killTimeVars = Array.from({length:C.length}, ()=>Array(T).fill(null));
    const killVictimVars = Array.from({length:C.length}, ()=>Array.from({length:C.length}, ()=>Array(T).fill(null)));

    for (let ci=0; ci<C.length; ci++){
      for (let t=0; t<T; t++){
        const kt = vp.get(`AGGKillTime_${C[ci]}_${t}`);
        killTimeVars[ci][t] = kt;
        clauses.push([-kt, AGG[ci]]);
      }

      for (let vj=0; vj<C.length; vj++){
        if (ci === vj) continue;
        const victimsAtTimes = [];
        for (let t=0; t<T; t++){
          const kv = vp.get(`AGGKillVictim_${C[ci]}_${C[vj]}_${t}`);
          killVictimVars[ci][vj][t] = kv;
          victimsAtTimes.push(kv);
          clauses.push([-kv, AGG[ci]]);
          clauses.push([-kv, killTimeVars[ci][t]]);
        }
      }
    }

    for (let ci=0; ci<C.length; ci++){
      for (let t=0; t<T; t++){
        const choices = [];
        for (let vj=0; vj<C.length; vj++){
          if (ci === vj) continue;
          const kv = killVictimVars[ci][vj][t];
          if (kv) choices.push(kv);
        }
        if (choices.length){
          clauses.push([-killTimeVars[ci][t], ...choices]);
        } else {
          clauses.push([-killTimeVars[ci][t]]);
        }
      }
    }

    for (let ci=0; ci<C.length; ci++){
      for (let vj=0; vj<C.length; vj++){
        if (ci === vj) continue;
        for (let t=0; t<T; t++){
          const kv = killVictimVars[ci][vj][t];
          if (!kv) continue;
          const detailVars = [];
          for (let ri=0; ri<R.length; ri++){
            const detail = vp.get(`AGGKillDetail_${C[ci]}_${C[vj]}_${t}_${R[ri]}`);
            detailVars.push(detail);
            clauses.push([-detail, AGG[ci]]);
            clauses.push([-detail, kv]);
            clauses.push([-detail, X(ci,t,ri)]);
            clauses.push([-detail, X(vj,t,ri)]);
            for (let ck=0; ck<C.length; ck++){
              if (ck === ci || ck === vj) continue;
              clauses.push([-detail, -X(ck,t,ri)]);
            }

            const reverse = [ -AGG[ci], -X(ci,t,ri), -X(vj,t,ri) ];
            for (let ck=0; ck<C.length; ck++){
              if (ck === ci || ck === vj) continue;
              reverse.push( X(ck,t,ri) );
            }
            reverse.push(detail);
            clauses.push(reverse);
          }
          if (detailVars.length){
            clauses.push([-kv, ...detailVars]);
          } else {
            clauses.push([-kv]);
          }
        }
      }
    }

    for (let ak=0; ak<C.length; ak++){
      for (let ci=0; ci<C.length; ci++){
        if (ci === ak) continue;
        for (let cj=ci+1; cj<C.length; cj++){
          if (cj === ak) continue;
          for (let t=0; t<T; t++){
            for (let ri=0; ri<R.length; ri++){
              const clause = [ -AGG[ak], -X(ci,t,ri), -X(cj,t,ri), X(ak,t,ri) ];
              for (let ck=0; ck<C.length; ck++){
                if (ck === ak || ck === ci || ck === cj) continue;
                clause.push( X(ck,t,ri) );
              }
              clauses.push(clause);
            }
          }
        }
      }
    }

    for (let ci=0; ci<C.length; ci++){
      const killTimes = killTimeVars[ci];
      if (requiredKills > killTimes.length){
        clauses.push([-AGG[ci]]);
      } else if (requiredKills > 0) {
        const combos = atLeastK(killTimes, requiredKills);
        for (const combo of combos){
          clauses.push([-AGG[ci], ...combo]);
        }
      }
    }

    privKeys.AGG = AGG;
  }

  // S8: Freeze
  let FRZ = null;
  if (config.scenarios && config.scenarios.s8){
    if (T < 2) throw new Error('S8 requires at least two timesteps');
    if (C.length < 2) throw new Error('S8 requires at least two characters');

    // Randomly choose which character is the freeze based on seed
    const rng = mulberry32(config.seed || 0);
    const freezeIdx = Math.floor(rng() * C.length);

    FRZ = C.map((_,ci)=> vp.get(`FRZ_${C[ci]}`));
    clauses.push(...exactlyOne(FRZ));
    
    // Force the randomly chosen character to be the freeze
    clauses.push([FRZ[freezeIdx]]);

    const freezeDetailByVictim = Array.from({length:C.length}, ()=>
      Array.from({length:T}, ()=>Array.from({length:R.length}, ()=>[]))
    );

    // Randomize freeze constraints based on seed (reuse RNG from freeze selection)
    // Randomly choose number of required kills (1-3)
    const numRequiredKills = Math.floor(rng() * 3) + 1; // 1, 2, or 3
    
    // Randomly choose which timesteps must have kills (excluding final timestep)
    const availableTimesteps = Array.from({length: T-1}, (_, i) => i);
    const requiredKillTimesteps = [];
    for (let i = 0; i < Math.min(numRequiredKills, availableTimesteps.length); i++) {
      const idx = Math.floor(rng() * availableTimesteps.length);
      requiredKillTimesteps.push(availableTimesteps[idx]);
      availableTimesteps.splice(idx, 1);
    }

    const freezeKillsByTimestep = Array.from({length:C.length}, ()=>
      Array.from({length:T}, ()=>[])
    );

    for (let ci=0; ci<C.length; ci++){
      for (let vj=0; vj<C.length; vj++){
        if (ci === vj) continue;
        for (let t=0; t<T; t++){
          for (let ri=0; ri<R.length; ri++){
            const detail = vp.get(`FRZKill_${C[ci]}_${C[vj]}_${t}_${R[ri]}`);
            freezeDetailByVictim[vj][t][ri].push(detail);
            freezeKillsByTimestep[ci][t].push(detail);

            clauses.push([-detail, FRZ[ci]]);
            clauses.push([-detail, X(ci,t,ri)]);
            clauses.push([-detail, X(vj,t,ri)]);
            for (let ck=0; ck<C.length; ck++){
              if (ck === ci || ck === vj) continue;
              clauses.push([-detail, -X(ck,t,ri)]);
            }

            const reverse = [ -FRZ[ci], -X(ci,t,ri), -X(vj,t,ri) ];
            for (let ck=0; ck<C.length; ck++){
              if (ck === ci || ck === vj) continue;
              reverse.push( X(ck,t,ri) );
            }
            reverse.push(detail);
            clauses.push(reverse);

            for (let u=t; u<T; u++){
              clauses.push([-detail, X(vj,u,ri)]);
            }
          }
        }
      }
    }

    // Require kills at the randomly chosen timesteps
    for (let ci=0; ci<C.length; ci++){
      for (const t of requiredKillTimesteps) {
        const killsAtTime = freezeKillsByTimestep[ci][t];
        if (killsAtTime.length === 0){
          throw new Error(`S8 requires a kill opportunity at timestep ${t+1}`);
        }
        clauses.push([-FRZ[ci], ...killsAtTime]);
      }
    }

    if (config.mustMove){
      const freezeSupports = Array.from({length:C.length}, ()=>
        Array.from({length:T}, ()=>Array.from({length:R.length}, ()=>[]))
      );

      for (let vi=0; vi<C.length; vi++){
        for (let ri=0; ri<R.length; ri++){
          const seen = new Set();
          for (let t=0; t<T; t++){
            for (const detail of freezeDetailByVictim[vi][t][ri]){
              seen.add(detail);
            }
            freezeSupports[vi][t][ri] = Array.from(seen);
          }
        }
      }

      for (let vi=0; vi<C.length; vi++){
        for (let t=0; t<T-1; t++){
          for (let ri=0; ri<R.length; ri++){
            const clause = [ -X(vi,t,ri), -X(vi,t+1,ri) ];
            const support = freezeSupports[vi][t][ri];
            if (support.length){ clause.push(...support); }
            clauses.push(clause);
          }
        }
      }
    }

    privKeys.FRZ = FRZ;
  }

  // S9: Doctor heals frozen characters
  let S9_DOC = null;
  let S9_FROZ = null;
  if (config.scenarios && config.scenarios.s9){
    if (T < 3) throw new Error('S9 requires at least three timesteps');
    if (C.length < 2) throw new Error('S9 requires at least two characters');
    if (R.length < 2) throw new Error('S9 requires at least two rooms');

    const frozenCountRaw = config.scenarios.s9_frozenCount;
    const frozenCount = frozenCountRaw == null ? Math.max(1, Math.min(2, C.length - 1)) : Number(frozenCountRaw);
    if (!Number.isInteger(frozenCount) || frozenCount < 1){
      throw new Error('S9 requires at least one frozen character');
    }
    if (frozenCount >= C.length){
      throw new Error('S9 frozen count must leave at least one non-frozen character');
    }

    S9_DOC = C.map((_,ci)=> vp.get(`S9Doctor_${C[ci]}`));
    S9_FROZ = C.map((_,ci)=> vp.get(`S9Frozen_${C[ci]}`));

    clauses.push(...exactlyOne(S9_DOC));

    const frozenTotal = buildTotalizer(S9_FROZ, vp, clauses, 'S9FrozenTot');
    if (frozenCount > frozenTotal.length){
      throw new Error('S9 frozen count exceeds available characters');
    }
    clauses.push([frozenTotal[frozenCount-1]]);
    if (frozenCount < frozenTotal.length){
      clauses.push([-frozenTotal[frozenCount]]);
    }

    for (let ci=0; ci<C.length; ci++){
      clauses.push([-S9_DOC[ci], -S9_FROZ[ci]]);
    }

    const healNowVars = Array.from({length:C.length}, ()=>Array(T).fill(null));
    const healedVars = Array.from({length:C.length}, ()=>Array(T).fill(null));

    const healNotFirst = [];
    const healNotFinal = [];
    const healMiddle = [];

    for (let ci=0; ci<C.length; ci++){
      for (let t=0; t<T; t++){
        const healNow = vp.get(`S9HealNow_${C[ci]}_${t}`);
        const healed = vp.get(`S9Healed_${C[ci]}_${t}`);
        healNowVars[ci][t] = healNow;
        healedVars[ci][t] = healed;

        clauses.push([-healNow, S9_FROZ[ci]]);
        clauses.push([-healed, S9_FROZ[ci]]);

        if (t === 0){
          clauses.push([-healNow, healed]);
          clauses.push([-healed, healNow]);
        } else {
          const prev = healedVars[ci][t-1];
          clauses.push([-prev, healed]);
          clauses.push([-healNow, healed]);
          clauses.push([-healed, prev, healNow]);
        }

        if (t > 0) healNotFirst.push(healNow);
        if (t < T-1) healNotFinal.push(healNow);
        if (t > 0 && t < T-1) healMiddle.push(healNow);
      }
    }

    for (let ci=0; ci<C.length; ci++){
      const healChoices = [];
      for (let t=0; t<T; t++){
        const detailOptions = [];
        for (let di=0; di<C.length; di++){
          for (let ri=0; ri<R.length; ri++){
            const detail = vp.get(`S9HealDetail_${C[ci]}_${C[di]}_${t}_${R[ri]}`);
            detailOptions.push(detail);

            clauses.push([-detail, S9_DOC[di]]);
            clauses.push([-detail, S9_FROZ[ci]]);
            clauses.push([-detail, X(di, t, ri)]);
            clauses.push([-detail, X(ci, t, ri)]);

            clauses.push([-S9_DOC[di], -S9_FROZ[ci], -X(di, t, ri), -X(ci, t, ri), detail]);

            clauses.push([-detail, healNowVars[ci][t]]);
          }
        }

        if (detailOptions.length){
          clauses.push([-healNowVars[ci][t], ...detailOptions]);
        } else {
          clauses.push([-healNowVars[ci][t]]);
        }

        healChoices.push(healNowVars[ci][t]);
      }

      clauses.push([-S9_FROZ[ci], ...healChoices]);
    }

    if (!healNotFirst.length || !healNotFinal.length || !healMiddle.length){
      throw new Error('S9 requires sufficient timeline for healing observations');
    }
    clauses.push(healNotFirst);
    clauses.push(healNotFinal);
    clauses.push(healMiddle);

    for (let ci=0; ci<C.length; ci++){
      for (let t=0; t<T-1; t++){
        for (let ri=0; ri<R.length; ri++){
          clauses.push([
            -S9_FROZ[ci],
            healedVars[ci][t],
            -X(ci, t, ri),
            X(ci, t+1, ri)
          ]);

          if (config.mustMove){
            clauses.push([ -X(ci, t, ri), -X(ci, t+1, ri), S9_FROZ[ci] ]);
            clauses.push([ -X(ci, t, ri), -X(ci, t+1, ri), -healedVars[ci][t] ]);
          }
        }
      }
    }

    for (let ci=0; ci<C.length; ci++){
      const moveAfterHeal = [];
      for (let t=0; t<T-1; t++){
        for (let ri=0; ri<R.length; ri++){
          for (let rj=0; rj<R.length; rj++){
            if (ri === rj) continue;
            const detail = vp.get(`S9MoveDetail_${C[ci]}_${t}_${R[ri]}_${R[rj]}`);
            moveAfterHeal.push(detail);

            clauses.push([-detail, S9_FROZ[ci]]);
            clauses.push([-detail, healedVars[ci][t]]);
            clauses.push([-detail, X(ci, t, ri)]);
            clauses.push([-detail, X(ci, t+1, rj)]);

            clauses.push([-S9_FROZ[ci], -healedVars[ci][t], -X(ci, t, ri), -X(ci, t+1, rj), detail]);
          }
        }
      }
      if (moveAfterHeal.length){
        clauses.push([-S9_FROZ[ci], ...moveAfterHeal]);
      }
    }

    privKeys.S9 = true;
  }

  // S4: Bomb duo
  // Constraint: A1 and A2 are the ONLY pair ever alone together (exactly 2 people in a room)
  let A1=null, A2=null;
  if (config.scenarios.s4){
    A1 = C.map((_,ci)=> vp.get(`A1_${C[ci]}`));
    A2 = C.map((_,ci)=> vp.get(`A2_${C[ci]}`));
    clauses.push(...exactlyOne(A1));
    clauses.push(...exactlyOne(A2));
    for (let ci=0; ci<C.length; ci++){ clauses.push([ -A1[ci], -A2[ci] ]); }

    // Bombers are the ONLY pair ever alone together
    const bomberAloneChoices = Array.from({length:C.length}, ()=>Array.from({length:C.length}, ()=>[]));

    for (let t=0; t<T; t++){
      for (let ri=0; ri<R.length; ri++){
        for (let ci=0; ci<C.length; ci++){
          for (let cj=ci+1; cj<C.length; cj++){
            const exactlyTwo = vp.get(`exactlyTwo_${t}_${ri}_${ci}_${cj}`);

            bomberAloneChoices[ci][cj].push(exactlyTwo);
            bomberAloneChoices[cj][ci].push(exactlyTwo);

            clauses.push([-exactlyTwo, X(ci,t,ri)]);
            clauses.push([-exactlyTwo, X(cj,t,ri)]);

            for (let ck=0; ck<C.length; ck++){
              if (ck === ci || ck === cj) continue;
              clauses.push([-exactlyTwo, -X(ck,t,ri)]);
            }

            const someoneElse = [];
            for (let ck=0; ck<C.length; ck++){
              if (ck === ci || ck === cj) continue;
              someoneElse.push(X(ck,t,ri));
            }
            clauses.push([exactlyTwo, -X(ci,t,ri), -X(cj,t,ri), ...someoneElse]);

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

    for (let ci=0; ci<C.length; ci++){
      for (let cj=ci+1; cj<C.length; cj++){
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

export function solveAndDecode(cfg){
  const { vp, clauses, privKeys } = buildCNF(cfg);
  const numVars = vp.count();
  const seed = Number(cfg.seed||0) || 0;
  const solveStartTime = Date.now();
  const sol = satSolve(clauses, numVars, seed);
  const solveTime = Date.now() - solveStartTime;
  if (!sol) return null;

  const val = name => sol[ vp.get(name) ]===true;

  const R = cfg.rooms, C = cfg.chars, T = cfg.T;
  const schedule = {};
  for (let ci=0; ci<C.length; ci++){
    const row = [];
    for (let t=0; t<T; t++){
      let found = "(none)";
      for (let ri=0; ri<R.length; ri++){
        if (val(`X_${C[ci]}_${t}_${R[ri]}`)){ found = R[ri]; break; }
      }
      row.push(found);
    }
    schedule[C[ci]] = row;
  }

  const byTime = {};
  for (let t=0; t<T; t++){
    const counts = {}; R.forEach(r=>counts[r]=0);
    for (let ci=0; ci<C.length; ci++){
      const r = schedule[C[ci]][t];
      if (counts[r]!=null) counts[r]++;
    }
    byTime[t+1] = counts;
  }

  const visits = {};
  for (let ci=0; ci<C.length; ci++){
    const v = {}; R.forEach(r=>v[r]=0);
    for (let t=0; t<T; t++){ v[ schedule[C[ci]][t] ]++; }
    visits[C[ci]] = v;
  }

  const priv = {};
  if (privKeys.PH){
    for (let ci=0; ci<C.length; ci++){
      if (val(`PH_${C[ci]}`)) { priv.phantom = C[ci]; break; }
    }
  }
  if (privKeys.L1 && privKeys.L2){
    let l1=null, l2=null;
    for (let ci=0; ci<C.length; ci++){
      if (val(`L1_${C[ci]}`)) l1 = C[ci];
      if (val(`L2_${C[ci]}`)) l2 = C[ci];
    }
    if (l1 && l2) priv.lovers = [l1,l2];
  }
  if (privKeys.V && privKeys.PT && privKeys.PR){
    let victim=null, pTime=null, pRoom=null;
    const assassin = C[0];
    for (let ci=0; ci<C.length; ci++) if (val(`V_${C[ci]}`)) victim = C[ci];
    for (let t=0; t<T; t++) if (val(`PT_${t}`)) pTime = t+1;
    for (let ri=0; ri<R.length; ri++) if (val(`PR_${R[ri]}`)) pRoom = R[ri];
    priv.assassin = assassin; priv.victim = victim; priv.poison_time = pTime; priv.poison_room = pRoom;
  }
  if (privKeys.A1 && privKeys.A2){
    let a1=null, a2=null;
    for (let ci=0; ci<C.length; ci++){ if (val(`A1_${C[ci]}`)) a1=C[ci]; if (val(`A2_${C[ci]}`)) a2=C[ci]; }
    priv.bomb_duo = [a1,a2];
  }
  if (privKeys.AGG){
    let agg=null;
    for (let ci=0; ci<C.length; ci++) if (val(`AGG_${C[ci]}`)) agg = C[ci];

    // Calculate victims (characters alone with aggrosassin)
    const victims = new Set();
    for (let t=0; t<T; t++){
      for (const room of R){
        const charsInRoom = C.filter(c => schedule[c][t] === room);
        if (charsInRoom.length === 2 && charsInRoom.includes(agg)){
          const victim = charsInRoom.find(c => c !== agg);
          victims.add(victim);
        }
      }
    }

    priv.aggrosassin = agg;
    priv.victims = Array.from(victims);
  }
  if (privKeys.FRZ){
    let freezeChar = null;
    for (let ci=0; ci<C.length; ci++){
      if (val(`FRZ_${C[ci]}`)){ freezeChar = C[ci]; break; }
    }
    if (freezeChar){
      const victims = new Set();
      const seenVictims = new Set();
      const killRecords = [];
      for (let t=0; t<T; t++){
        const room = schedule[freezeChar][t];
        const charsInRoom = C.filter(c => schedule[c][t] === room);
        if (charsInRoom.length === 2){
          const victim = charsInRoom.find(c => c !== freezeChar);
          if (victim){
            victims.add(victim);
            if (!seenVictims.has(victim)){
              seenVictims.add(victim);
              killRecords.push({ victim, time: t+1, room });
            }
          }
        }
      }
      priv.freeze = freezeChar;
      priv.freeze_victims = Array.from(victims);
      priv.freeze_kills = killRecords;
    }
  }

  if (privKeys.S9){
    let doctor = null;
    const frozen = [];
    const healings = [];

    for (let ci=0; ci<C.length; ci++){
      if (val(`S9Doctor_${C[ci]}`)){ doctor = C[ci]; }
      if (val(`S9Frozen_${C[ci]}`)){ frozen.push(C[ci]); }
      for (let t=0; t<T; t++){
        if (val(`S9HealNow_${C[ci]}_${t}`)){
          healings.push({ patient: C[ci], time: t+1, room: schedule[C[ci]][t] });
        }
      }
    }

    if (doctor) priv.doctor = doctor;
    if (frozen.length) priv.frozen = frozen;
    if (healings.length) priv.healings = healings;
  }

  const stats = {
    totalVars: numVars,
    totalClauses: clauses.length,
    avgClauseLength: clauses.length > 0 ? clauses.reduce((sum, c) => sum + c.length, 0) / clauses.length : 0,
    solveTimeMs: solveTime
  };

  return { schedule, byTime, visits, priv, meta: { vars:numVars }, stats };
}

/* ===========================
   Minimal SAT (DPLL + Unit)
   =========================== */
export function satSolve(clauses, numVars, randSeed=0, timeoutMs=5000) {
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

  function unitProp(queue){
    while (queue.length){
      const lit = queue.pop();
      const v = Math.abs(lit);
      const val = lit>0 ? 1 : -1;
      if (assigns[v] !== 0){
        if (assigns[v] !== val) return false; // conflict
        continue;
      }
      assigns[v] = val;
      // Satisfy clauses containing lit
      const satList = val>0 ? occPos[v] : occNeg[v];
      for (const ci of satList){ clauses[ci] = [0]; } // mark satisfied
      // For clauses containing ~lit, remove ~lit
      const remList = val>0 ? occNeg[v] : occPos[v];
      for (const ci of remList){
        if (clauses[ci].length===1 && clauses[ci][0]===0) continue;
        // remove -lit
        let arr = clauses[ci];
        let idx = arr.indexOf(-lit);
        if (idx>=0){ arr.splice(idx,1); }
        if (arr.length===0) return false; // empty => conflict
        if (arr.length===1){
          const u = arr[0];
          if (u!==0) queue.push(u);
        }
      }
    }
    return true;
  }

  function chooseVar(){
    // Heuristic: pick variable from a random non-satisfied clause
    for (let tries=0; tries<1000; tries++){
      const ci = Math.floor(rng()*clauses.length);
      const c = clauses[ci];
      if (c.length===1 && c[0]===0) continue; // satisfied
      if (c.length>0){
        // pick literal with smallest abs assignment or random
        let lit = c[Math.floor(rng()*c.length)];
        return Math.abs(lit);
      }
    }
    // fallback
    for (let v=1; v<=numVars; v++) if (assigns[v]===0) return v;
    return 0;
  }

  // initial unit clauses
  let initQ = [];
  for (const c of clauses){ if (c.length===1 && c[0]!==0) initQ.push(c[0]); }
  if (!unitProp(initQ)) return null;

  function dfs(){
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('SAT_TIMEOUT');
    }

    // check all satisfied?
    let allSat = true;
    for (const c of clauses){
      if (c.length===0) return false;
      if (!(c.length===1 && c[0]===0)) { allSat=false; break; }
    }
    if (allSat) return true;

    const v = chooseVar();
    if (v===0) return true; // nothing left
    // branch true, then false
    for (const tryVal of [true,false]){
      // clone state (clauses + assigns) cheaply via snapshots
      const snapshotClauses = clauses.map(c=>c.slice());
      const snapshotAssigns = assigns.slice();
      if (unitProp([tryVal ? v : -v])){
        if (dfs()) return true;
      }
      // restore
      clauses = snapshotClauses;
      assigns = snapshotAssigns;
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

function mulberry32(a){return function(){var
t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}}

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

function atLeastOne(cl){ // OR over literals (already in int form)
  return [cl];
}

function atMostOne(vars){ // pairwise
  const out = [];
  for (let i=0;i<vars.length;i++) for (let j=i+1;j<vars.length;j++){
    out.push([-vars[i], -vars[j]]);
  }
  return out;
}

function exactlyOne(vars){
  return [...atLeastOne(vars), ...atMostOne(vars)];
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
  const { idx: Ridx, nbr } = neighbors(R, config.edges, config.allowStay && !config.mustMove);

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

  // S4: Bomb duo
  let A1=null, A2=null, KR=null;
  if (config.scenarios.s4){
    A1 = C.map((_,ci)=> vp.get(`A1_${C[ci]}`));
    A2 = C.map((_,ci)=> vp.get(`A2_${C[ci]}`));
    KR = R.map((_,ri)=> vp.get(`KR_${R[ri]}`));
    clauses.push(...exactlyOne(A1));
    clauses.push(...exactlyOne(A2));
    for (let ci=0; ci<C.length; ci++){ clauses.push([ -A1[ci], -A2[ci] ]); }
    clauses.push(...exactlyOne(KR));

    const plantTime = T - 1;

    if (config.scenarios.s4_room){
      const ri = Ridx.get(config.scenarios.s4_room);
      if (ri!=null) clauses.push([ KR[ri] ]);
    }

    for (let ri=0; ri<R.length; ri++){
      for (let ci=0; ci<C.length; ci++){
        clauses.push([ -A1[ci], -KR[ri], X(ci, plantTime, ri) ]);
        clauses.push([ -A2[ci], -KR[ri], X(ci, plantTime, ri) ]);
        clauses.push([ -KR[ri], -X(ci, plantTime, ri), A1[ci], A2[ci] ]);
      }
    }

    for (let t=0; t<T; t++){
      for (let ri=0; ri<R.length; ri++){
        for (let ci=0; ci<C.length; ci++){
          for (let cj=ci+1; cj<C.length; cj++){
            const exactlyTwo = vp.get(`exactlyTwo_${t}_${ri}_${ci}_${cj}`);

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
    privKeys.A1 = A1;
    privKeys.A2 = A2;
    privKeys.KR = KR;
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
  const sol = satSolve(clauses, numVars, seed);
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
  if (privKeys.A1 && privKeys.A2 && privKeys.KR){
    let a1=null, a2=null, kRoom=null;
    for (let ci=0; ci<C.length; ci++){ if (val(`A1_${C[ci]}`)) a1=C[ci]; if (val(`A2_${C[ci]}`)) a2=C[ci]; }
    for (let ri=0; ri<R.length; ri++) if (val(`KR_${R[ri]}`)) kRoom = R[ri];
    priv.bomb_duo = [a1,a2]; priv.plant_time = T; priv.plant_room = kRoom;
  }

  return { schedule, byTime, visits, priv, meta: { vars:numVars } };
}

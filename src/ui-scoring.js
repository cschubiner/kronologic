/* ===========================
   Scoring Functions (HTML-specific)
   =========================== */
export function scoreScenario(res, cfg) {
  let score = 0;
  const scores = {};
  
  // S2: Phantom scoring
  if (cfg.scenarios.s2 && res.priv.phantom) {
    scores.phantom = scorePhantom(res, cfg);
    score += scores.phantom;
  }
  
  // S5/S6: Lovers scoring
  if (cfg.scenarios.s5 && res.priv.lovers) {
    scores.lovers = scoreLovers(res, cfg);
    score += scores.lovers;
  }
  
  // S1: Poison scoring
  if (cfg.scenarios.s1 && res.priv.assassin) {
    scores.poison = scorePoison(res, cfg);
    score += scores.poison;
  }
  
  // S4: Bomb duo scoring
  if (cfg.scenarios.s4 && res.priv.bomb_duo) {
    scores.bomb = scoreBomb(res, cfg);
    score += scores.bomb;
  }

  // S3: Singer's Jewels scoring
  if (cfg.scenarios.s3) {
    scores.jewels = scoreJewels(res, cfg);
    score += scores.jewels;
  }

  // S7: Aggrosassin scoring
  if (cfg.scenarios.s7 && res.priv.aggrosassin) {
    scores.aggrosassin = scoreAggrosassin(res, cfg);
    score += scores.aggrosassin;
  }

  // S8: Freeze scoring
  if (cfg.scenarios.s8 && res.priv.freeze) {
    scores.freeze = scoreFreeze(res, cfg);
    score += scores.freeze;
  }

  // S9: Doctor's Cure scoring
  if (cfg.scenarios.s9 && res.priv.doctor) {
    scores.doctor = scoreDoctor(res, cfg);
    score += scores.doctor;
  }

  if (cfg.scenarios.s10 && res.priv.contagion) {
    scores.contagion = scoreContagion(res, cfg);
    score += scores.contagion;
  }

  if (cfg.scenarios.s11 && res.priv.vault) {
    scores.vault = scoreVault(res, cfg);
    score += scores.vault;
  }

  if (cfg.scenarios.s12 && res.priv.glue_room) {
    scores.glueRoom = scoreGlueRoom(res, cfg);
    score += scores.glueRoom;
  }

  if (cfg.scenarios.s13 && res.priv.glue_shoes) {
    scores.glueShoes = scoreGlueShoes(res, cfg);
    score += scores.glueShoes;
  }

  if (cfg.scenarios.s14 && res.priv.curse_of_amarinta) {
    scores.curse = scoreCurseOfAmarinta(res, cfg);
    score += scores.curse;
  }

  return { total: score, breakdown: scores };
}

export function scorePhantom(res, cfg) {
  // Higher score = harder puzzle
  // Measure: How many other characters are "almost phantom" (alone many times but not all)
  const phantom = res.priv.phantom;
  const T = cfg.T;
  const chars = cfg.chars;
  
  let score = 0;
  
  for (const char of chars) {
    if (char === phantom) continue;
    
    // Count how many times this character is alone
    let aloneCount = 0;
    for (let t = 0; t < T; t++) {
      const room = res.schedule[char][t];
      const othersInRoom = chars.filter(c => 
        c !== char && res.schedule[c][t] === room
      ).length;
      if (othersInRoom === 0) aloneCount++;
    }
    
    // Characters alone T-1 or T-2 times are "red herrings" - increase difficulty
    if (aloneCount >= T - 2) {
      score += 100 * (aloneCount / T); // Weight by proportion
    } else if (aloneCount >= T / 2) {
      score += 50 * (aloneCount / T); // Moderate red herrings
    }
  }
  
  return score;
}

export function scoreLovers(res, cfg) {
  // Higher score = harder puzzle
  // Measure: How many other character pairs are "almost lovers" (rarely meet)
  const [lover1, lover2] = res.priv.lovers;
  const T = cfg.T;
  const chars = cfg.chars;
  
  let score = 0;
  
  // Check all other pairs
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      const c1 = chars[i], c2 = chars[j];
      if ((c1 === lover1 && c2 === lover2) || (c1 === lover2 && c2 === lover1)) continue;
      
      // Count meetings
      let meetings = 0;
      for (let t = 0; t < T; t++) {
        if (res.schedule[c1][t] === res.schedule[c2][t]) meetings++;
      }
      
      // Pairs that meet 0-1 times are red herrings
      if (meetings === 0) score += 100;
      else if (meetings === 1) score += 80;
      else if (meetings <= 2) score += 40;
    }
  }
  
  return score;
}

export function scorePoison(res, cfg) {
  // Higher score = harder puzzle
  // Measure: How many other pairs of characters are alone together at various times
  const assassin = res.priv.assassin;
  const victim = res.priv.victim;
  const poisonTime = res.priv.poison_time - 1; // 0-indexed
  const poisonRoom = res.priv.poison_room;
  const T = cfg.T;
  const chars = cfg.chars;
  
  let score = 0;
  
  // Count other pairs who are alone together (red herrings)
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      const c1 = chars[i], c2 = chars[j];
      
      // Skip the actual assassin-victim pair at poison time
      if ((c1 === assassin && c2 === victim) || (c1 === victim && c2 === assassin)) {
        continue;
      }
      
      // Check if they're alone together at any time
      for (let t = 0; t < T; t++) {
        const room1 = res.schedule[c1][t];
        const room2 = res.schedule[c2][t];
        
        if (room1 === room2) {
          const othersInRoom = chars.filter(c => 
            c !== c1 && c !== c2 && res.schedule[c][t] === room1
          ).length;
          
          if (othersInRoom === 0) {
            // This pair is alone together - red herring
            score += 60;
          }
        }
      }
    }
  }
  
  return score;
}

export function scoreJewels(res, cfg) {
  // Complexity rises when many moments feature exactly two occupants,
  // creating extra hand-off opportunities in the narrative.
  const T = cfg.T;
  const rooms = cfg.rooms;
  const chars = cfg.chars;
  let score = 0;

  const jewelRoom = rooms[0];

  for (let t = 0; t < T; t++) {
    for (const room of rooms) {
      let count = 0;
      for (const char of chars) {
        if (res.schedule[char][t] === room) count++;
      }
      if (count === 2) {
        score += room === jewelRoom ? 80 : 40;
      }
    }
  }

  return score;
}
export function scoreBomb(res, cfg) {
  // Higher score = harder puzzle
  // Measure: How often bombers are with other people (camouflage)
  // and how many "near miss" groups of 3 exist
  const [bomber1, bomber2] = res.priv.bomb_duo;
  const T = cfg.T;
  const chars = cfg.chars;

  let score = 0;

  // Count times when bombers are together WITH other people (not alone)
  for (let t = 0; t < T; t++) {
    const room1 = res.schedule[bomber1][t];
    const room2 = res.schedule[bomber2][t];

    if (room1 === room2) {
      const othersInRoom = chars.filter(c =>
        c !== bomber1 && c !== bomber2 && res.schedule[c][t] === room1
      ).length;

      if (othersInRoom > 0) {
        // Bombers together but not alone - camouflage
        score += 40;
      }
    }
  }

  // Count "near miss" situations: groups of exactly 3 people
  // These are confusing because they're "almost" a suspicious pair
  for (let t = 0; t < T; t++) {
    for (const room of cfg.rooms) {
      const charsInRoom = chars.filter(c => res.schedule[c][t] === room);
      if (charsInRoom.length === 3) {
        score += 30; // Near-miss group
      }
    }
  }

  return score;
}

export function scoreAggrosassin(res, cfg) {
  // Higher score = harder puzzle
  // Measure: More victims and more pair meetings in general
  const T = cfg.T;
  const chars = cfg.chars;
  
  let score = 0;
  
  // +10 points per victim (increased from 3 to weight kills more)
  const victimCount = res.priv.victims ? res.priv.victims.length : 0;
  score += victimCount * 10;
  
  // +1 point per instance of exactly 2 people in a room
  for (let t = 0; t < T; t++) {
    for (const room of cfg.rooms) {
      const charsInRoom = chars.filter(c => res.schedule[c][t] === room);
      if (charsInRoom.length === 2) {
        score += 1;
      }
    }
  }

  return score;
}

export function scoreFreeze(res, cfg) {
  // Higher score = harder puzzle
  // Measure: More freeze victims and red herring 1:1 meetings
  const freeze = res.priv.freeze;
  if (!freeze) return 0;

  const kills = res.priv.freeze_kills || [];
  const T = cfg.T;
  const chars = cfg.chars;

  let score = kills.length * 100;

  let redHerrings = 0;
  for (let t = 0; t < T; t++) {
    for (const room of cfg.rooms) {
      const charsInRoom = chars.filter(c => res.schedule[c][t] === room);
      if (charsInRoom.length === 2 && !charsInRoom.includes(freeze)) {
        redHerrings++;
      }
    }
  }

  score += redHerrings * 5;
  return score;
}

export function scoreDoctor(res, cfg) {
  const frozen = res.priv.frozen || [];
  const heals = res.priv.heals || [];
  const frozenRatio = frozen.length / Math.max(1, cfg.chars.length - 1);

  let score = 80 + (1 - frozenRatio) * 140;

  const healTimes = new Set();
  for (const heal of heals) {
    healTimes.add(heal.time);
    score += 30;
    if (heal.time > 1 && heal.time < cfg.T) score += 10;
  }

  if (healTimes.size > 1) score += healTimes.size * 15;
  if (heals.length && frozen.length > 1) score += 25;

  return score;
}

export function scoreContagion(res, cfg) {
  const contagion = res.priv.contagion;
  if (!contagion) return 0;

  const infectedCount = contagion.infected_count || 0;
  const totalChars = cfg.chars.length || 1;
  const infectionTimes = contagion.infection_times || {};
  const timeline = contagion.infection_timeline || [];

  let score = (infectedCount / totalChars) * 180;

  const uniqueTimes = new Set(Object.values(infectionTimes).filter(Boolean)).size;
  score += uniqueTimes * 20;

  for (const step of timeline){
    const newCount = step.characters?.length || 0;
    if (newCount === 0) continue;
    score += newCount === 1 ? 25 : Math.max(8, 18 - newCount * 2);
  }

  if (timeline.length){
    const avgNewPerStep = infectedCount / timeline.length;
    if (avgNewPerStep <= 1.25) score += 35;
    else if (avgNewPerStep <= 2.5) score += 18;
    else score += 8;
  }

  return score;
}

export function scoreVault(res, cfg) {
  const vault = res.priv.vault;
  if (!vault) return 0;

  const vaultRoom = vault.vault_room || [...cfg.rooms].sort()[0];
  const keyHolder = vault.key_holder;
  const chars = cfg.chars;
  const T = cfg.T;

  let withOthers = 0;
  let maxGroup = 0;
  let khVisits = 0;
  let totalVisits = 0;
  const companions = new Set();
  const groupPatterns = new Set();

  for (let t = 0; t < T; t++) {
    const occupants = chars.filter((c) => res.schedule[c][t] === vaultRoom);
    if (occupants.length) {
      totalVisits++;
      groupPatterns.add(occupants.slice().sort().join(','));
    }
    if (occupants.includes(keyHolder)) {
      khVisits++;
      if (occupants.length > 1) {
        withOthers++;
        occupants
          .filter((c) => c !== keyHolder)
          .forEach((c) => companions.add(c));
      }
    }
    if (occupants.length > maxGroup) maxGroup = occupants.length;
  }

  let score = 30;
  score += companions.size * 12;
  score += withOthers * 8;
  score += Math.max(0, khVisits - withOthers) * 4;
  score += Math.max(0, maxGroup - 2) * 6;
  score += Math.min(groupPatterns.size, 6) * 3;

  return score;
}

export function scoreGlueRoom(res, cfg) {
  const info = res.priv.glue_room;
  if (!info) return 0;

  const glueRoom = info.glue_room;
  const chars = cfg.chars;
  const T = cfg.T;

  let entryCount = 0;
  const distinctVisitors = new Set();

  for (const ch of chars) {
    for (let t = 0; t < T; t++) {
      const here = res.schedule[ch][t] === glueRoom;
      const cameFromOther = t === 0 || res.schedule[ch][t - 1] !== glueRoom;
      if (here && cameFromOther) {
        entryCount++;
        distinctVisitors.add(ch);
      }
    }
  }

  let score = entryCount * 12;
  score += distinctVisitors.size * 10;
  score += Math.max(0, T - 2) * 2;

  return score;
}

export function scoreGlueShoes(res, cfg) {
  const info = res.priv.glue_shoes;
  if (!info) return 0;

  const gluePerson = info.glue_person;
  const victims = info.stuck || [];
  const T = cfg.T;

  let totalStickEvents = 0;
  if (gluePerson) {
    for (let t = 0; t < T - 1; t++) {
      const room = res.schedule[gluePerson][t];
      const others = cfg.chars.filter(
        (ch) => ch !== gluePerson && res.schedule[ch][t] === room,
      );
      if (others.length) {
        totalStickEvents += others.length;
      }
    }
  }

  let score = victims.length * 22;
  score += totalStickEvents * 6;
  score += Math.max(0, T - 3) * 4;

  return score;
}

export function scoreCurseOfAmarinta(res, cfg) {
  const info = res.priv.curse_of_amarinta;
  const timeline = info?.timeline || [];

  if (!timeline.length) return 0;

  let handoffs = 0;
  let totalCursed = 0;

  const symmetricDiffCount = (a, b) => {
    let count = 0;
    for (const item of a) {
      if (!b.has(item)) count++;
    }
    for (const item of b) {
      if (!a.has(item)) count++;
    }
    return count;
  };

  let prevSet = new Set(timeline[0].cursed || []);
  totalCursed += prevSet.size;

  for (let i = 1; i < timeline.length; i++) {
    const currentSet = new Set(timeline[i].cursed || []);
    totalCursed += currentSet.size;
    handoffs += symmetricDiffCount(prevSet, currentSet);
    prevSet = currentSet;
  }

  const cursedAtSix = info.final_cursed?.length
    ? info.final_cursed
    : timeline[5]?.cursed || [];

  let score = 0;
  score += handoffs * 6;
  score += cursedAtSix.length * 14;
  score += totalCursed * 3;

  return score;
}

export function deriveGlueRoomFacts(res, cfg) {
  if (res.priv.glue_room) return res.priv.glue_room;

  for (const room of cfg.rooms) {
    const firstEntries = {};
    let validRoom = false;
    let violated = false;

    for (const ch of cfg.chars) {
      let entryTime = null;
      for (let t = 0; t < cfg.T; t++) {
        const here = res.schedule[ch][t] === room;
        const cameFromOther = t === 0 || res.schedule[ch][t - 1] !== room;
        if (here && cameFromOther) {
          if (t === cfg.T - 1 || res.schedule[ch][t + 1] !== room) {
            violated = true;
            break;
          }
          if (t + 2 < cfg.T && res.schedule[ch][t + 2] === room) {
            violated = true;
            break;
          }
          entryTime ??= t + 1;
          validRoom = true;
        }
      }
      if (violated) break;
      firstEntries[ch] = entryTime;
    }

    if (!violated && validRoom) {
      return { glue_room: room, first_entries: firstEntries };
    }
  }

  return null;
}

export function deriveGlueShoesFacts(res, cfg) {
  if (res.priv.glue_shoes) return res.priv.glue_shoes;

  for (const glueCandidate of cfg.chars) {
    const firstStuck = new Map();
    let violated = false;
    let sawVictim = false;

    for (let t = 0; t < cfg.T - 1; t++) {
      const room = res.schedule[glueCandidate][t];
      const victims = cfg.chars.filter(
        (ch) => ch !== glueCandidate && res.schedule[ch][t] === room,
      );

      for (const v of victims) {
        if (res.schedule[v][t + 1] !== room) {
          violated = true;
          break;
        }
        if (t + 2 < cfg.T && res.schedule[v][t + 2] === room) {
          violated = true;
          break;
        }
        if (!firstStuck.has(v)) firstStuck.set(v, { character: v, time: t + 1, room });
        sawVictim = true;
      }
      if (violated) break;
    }

    if (!violated && sawVictim) {
      return {
        glue_person: glueCandidate,
        stuck: Array.from(firstStuck.values()).sort((a, b) => a.time - b.time),
      };
    }
  }

  return null;
}

/* ===========================
   URL State Management (HTML-specific)
   =========================== */
export function encodeScenarioToURL(res, cfg) {
  // Create a compact representation of the scenario
  const state = {
    v: 1, // version
    r: cfg.rooms,
    c: cfg.chars,
    t: cfg.T,
    e: cfg.edges,
    s: cfg.seed,
    // Encode schedule as compact string: char_index,room_index for each timestep
    // Format: "0,1,2,0,1,2|1,2,0,1,2,0|..." (pipe separates characters)
    sch: cfg.chars.map(char => {
      return res.schedule[char].map(room => cfg.rooms.indexOf(room)).join(',');
    }).join('|')
  };
  
  // Convert to base64 JSON
  const json = JSON.stringify(state);
  const encoded = btoa(encodeURIComponent(json));
  return encoded;
}

export function decodeScenarioFromURL(encoded) {
  try {
    const json = decodeURIComponent(atob(encoded));
    const state = JSON.parse(json);
    
    if (state.v !== 1) return null; // Version mismatch
    
    // Reconstruct schedule
    const schedule = {};
    const schedParts = state.sch.split('|');
    state.c.forEach((char, ci) => {
      const roomIndices = schedParts[ci].split(',').map(Number);
      schedule[char] = roomIndices.map(ri => state.r[ri]);
    });
    
    // Reconstruct byTime
    const byTime = {};
    for (let t = 0; t < state.t; t++) {
      const counts = {};
      state.r.forEach(r => counts[r] = 0);
      state.c.forEach(char => {
        const room = schedule[char][t];
        if (counts[room] != null) counts[room]++;
      });
      byTime[t + 1] = counts;
    }
    
    // Reconstruct visits
    const visits = {};
    state.c.forEach(char => {
      const v = {};
      state.r.forEach(r => v[r] = 0);
      for (let t = 0; t < state.t; t++) {
        v[schedule[char][t]]++;
      }
      visits[char] = v;
    });
    
    return {
      schedule,
      byTime,
      visits,
      rooms: state.r,
      chars: state.c,
      T: state.t,
      edges: state.e,
      seed: state.s
    };
  } catch (e) {
    console.error('Failed to decode scenario from URL:', e);
    return null;
  }
}

export function updateURL(encoded) {
  const url = new URL(window.location);
  url.searchParams.set('scenario', encoded);
  window.history.pushState({}, '', url);
}

export function getScenarioFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('scenario');
}

export function clampPercentile(value) {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function syncPercentileDisplay({
  sliderId = 'percentile',
  displayId = 'percentileValue',
  formatter = (pct) => pct.toFixed(1),
} = {}) {
  const slider = typeof document !== 'undefined'
    ? document.getElementById(sliderId)
    : null;

  if (!slider) return 0;

  const pct = clampPercentile(Number(slider.value));
  slider.value = pct;

  const display = document.getElementById(displayId);
  if (display) display.textContent = formatter(pct);

  return pct;
}

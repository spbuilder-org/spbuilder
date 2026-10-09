/* Embedded directly in QSF. No imports, build helpers, DOM, or backend dependencies. */

/** Strategy only: each nonempty candidate pool has equal probability, regardless of size. */
function selectUniformPool(candidates, random) {
  return candidates[Math.floor(random() * candidates.length)].poolIndex;
}

/** Inventory and item consumption are separate from pool selection policy. */
function createPoolSampler(pools, usage, random, selectPool) {
  random = random || Math.random;
  selectPool = selectPool || selectUniformPool;
  return function draw(poolIndexes) {
    const candidates = Array.from(new Set(poolIndexes)).map(poolIndex => ({
      poolIndex, remaining: pools[poolIndex] ? pools[poolIndex].shuffledIndexes.length - (usage[poolIndex] || 0) : 0,
    })).filter(candidate => candidate.remaining > 0);
    if (!poolIndexes.length) return { status: 'blank', type: 'empty', content: '' };
    if (!candidates.length) return { status: 'exhausted', type: 'empty', content: '' };
    const poolIndex = selectPool(candidates, random);
    const cursor = usage[poolIndex] || 0;
    const itemIndex = pools[poolIndex].shuffledIndexes[cursor];
    usage[poolIndex] = cursor + 1;
    return Object.assign({}, pools[poolIndex].items[itemIndex], { status: 'drawn', poolIndex, itemIndex });
  };
}

/** Missing, skipped, or exhausted references are unknown, including for !=. */
function evaluatePageCondition(condition, records) {
  function evaluate(node) {
    if (node.type === 'group') {
      if (!node.children.length) return null;
      const values = node.children.map(evaluate);
      if (node.operator === 'and') return values.includes(false) ? false : values.includes(null) ? null : true;
      if (node.operator === 'or') return values.includes(true) ? true : values.includes(null) ? null : false;
      return null;
    }
    const page = records[node.pageId];
    if (!page || page.status !== 'completed') return null;
    let value;
    if (node.type === 'response') {
      value = page.response;
    } else if (node.type === 'pool') {
      const draw = page.draws[node.position];
      if (!draw || draw.status !== 'drawn') return null;
      value = draw.poolIndex;
    } else return null;
    if (value === null || value === undefined || !node.values.length) return null;
    const matches = node.values.includes(value);
    return node.operator === 'eq' ? matches : node.operator === 'neq' ? !matches : null;
  }
  return !condition || evaluate(condition) === true;
}

/** Sequential page lifecycle. Adapters own display, keyboard, clock and Qualtrics output. */
function createPageFlowRunner(options) {
  const { pages, totalTrials, records, draw, display, clear, listen, onTrial, onDone } = options;
  const schedule = options.setTimeout || setTimeout;
  const cancel = options.clearTimeout || clearTimeout;
  const now = options.now || (() => performance.now());
  const timers = new Set();
  let stopped = false;
  function later(fn, ms) {
    const timer = schedule(() => { timers.delete(timer); if (!stopped) fn(); }, ms);
    timers.add(timer);
  }
  function reset() {
    timers.forEach(cancel); timers.clear(); listen(null, []);
  }
  function run(tid, index) {
    if (stopped) return;
    if (tid >= totalTrials) { reset(); clear(); onDone(); return; }
    const trial = records[tid] || (records[tid] = {});
    while (index < pages.length && !evaluatePageCondition(pages[index].condition, trial)) {
      trial[pages[index].id] = { status: 'skipped', draws: {}, response: null, duration: null };
      index++;
    }
    if (index === pages.length) { onTrial(tid, trial); later(() => run(tid + 1, 0), 0); return; }
    const page = pages[index];
    let record = trial[page.id];
    if (!record || record.status === 'skipped') {
      record = trial[page.id] = { status: 'displayed', draws: {}, response: null, duration: null };
      page.displays.forEach(item => { record.draws[item.key] = draw(item.pools); });
    }
    display(record.draws);
    let settled = false;
    function finish(response, duration) {
      if (settled || stopped) return;
      settled = true;
      reset();
      if (record.status !== 'completed') {
        record.status = 'completed'; record.response = response; record.duration = duration;
      }
      const retention = record.response !== 'TIMEOUT' ? page.response.delayAfter : 0;
      later(() => { clear(); later(() => run(tid, index + 1), page.interval); }, retention);
    }
    if (record.status === 'completed') { finish(record.response, record.duration); return; }
    if (page.response.mode === 'timeout') {
      later(() => finish('TIMEOUT', null), page.response.duration);
    } else {
      later(() => {
        const started = now();
        listen(key => {
          if (page.response.keys.includes(key)) finish(key, Math.floor(now() - started));
        }, page.response.keys);
      }, page.response.delayBefore);
      if (page.response.timeout !== null) later(() => finish('TIMEOUT', null), page.response.timeout);
    }
  }
  return {
    start: () => run(0, 0),
    stop: () => { stopped = true; reset(); clear(); },
  };
}

function exportPageRecords(rounds) {
  return rounds.map(trials => trials.map(trial => Object.fromEntries(Object.entries(trial).map(([id, record]) => [id, {
    status: record.status, response: record.response, duration: record.duration,
    draws: Object.fromEntries(Object.entries(record.draws).map(([key, draw]) => [key, {
      status: draw.status, pool: draw.poolIndex === undefined ? null : draw.poolIndex + 1,
      item: draw.itemIndex === undefined ? null : draw.itemIndex + 1,
    }])),
  }]))));
}

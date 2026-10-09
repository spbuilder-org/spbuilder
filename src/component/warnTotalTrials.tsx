import { Alert } from '@arco-design/web-react';
import React from 'react';
import { AmpParams } from '../data/ampTypes';
import { choicePools } from '../data/pageFlow';
import { sumBy } from 'lodash';

export const WarnTotalTrials: React.FC<{ values: AmpParams }> = ({ values }) => {

  if (values.timeline.concurrentDisplays && (values.timeline.pageSettings?.some(p => p.condition) || values.timeline.concurrentDisplays.some(frame => frame.some(row => row.some(cell => choicePools(cell).length > 1))))) {
    return <Alert type='info' content='Pool usage depends on page conditions and random draws, so the trial count cannot be guaranteed from pool sizes. Empty pools are skipped during selection; a position is blank if all its pools are exhausted. Actual draws and page responses are saved in sptPageResults. The built-in legacy data analysis does not support this format.' />;
  }
  let usageOfEachPool: number[];
  if (values.timeline.concurrentDisplays) {
    // copied from trial.js
    usageOfEachPool = values.stimuli.map(() => 0);
    for (const elementPoolMapping of values.timeline.concurrentDisplays) {
      for (const row of elementPoolMapping) {
        for (const col of row) {
          for (const pool of choicePools(col)) {
            if (pool >= 0 && pool < usageOfEachPool.length) usageOfEachPool[pool] += 1;
          }
        }
      }
    }
  } else {
    usageOfEachPool = values.stimuli.map(() => 1);
  }

  const invalidPools = values.stimuli.map((pool, poolIndex) => {
    // if any priming overrides count, skip this poool
    if (pool.isEnablePriming && pool.prime.some(primeItem => primeItem.overrideCount !== null)) return;

    const minCount = usageOfEachPool[poolIndex] * values.totalTrials;
    const poolSize = sumBy(pool.items, 'count')
    if (minCount > poolSize) {
      return {
        poolIndex,
        poolSize,
        poolUsage: usageOfEachPool[poolIndex],
      };
    }
  }).filter(x => x) as { poolIndex: number, poolSize: number, poolUsage: number }[];

  return (
    <div style={{ marginBottom: 20 }}>
      {
        invalidPools.map(({ poolIndex, poolSize, poolUsage }) => {
          const alertContent = `Stimuli pool ${poolIndex + 1} does not have sufficient item counts. `
            + `You have ${values.totalTrials} trials`
            + (values.timeline.concurrentDisplays ? ` and each trial uses ${poolUsage} counts from pool ${poolIndex + 1}` : '')
            + `, but the pool only has ${poolSize} item counts.`;
          return <Alert type='warning' content={alertContent} key={poolIndex} />
        })
      }
    </div>
  );
};

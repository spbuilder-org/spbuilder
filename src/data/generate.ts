import type { AmpParams, AmpStimuliPrimeItem, AmpTimeline } from './ampTypes';
import { buildAdvancedTimeline, pageFlowErrors } from './pageFlow';
import qsfTemplate from '../assets/qsfTemplate.json';
import { renderTrialHtml } from './renderTrialHtml';
import { type UidDetail, getDisplayKey, getUidDetail, map2d } from '../util/util';

interface EmbeddedDataTemplate {
  Description: string;
  Field: string;
  Type: string;
  Value?: string;
}
export function hydrateQsf(params: AmpParams) {
  const errors = pageFlowErrors(params);
  if (errors.length) throw new Error(errors.join('\n'));
  const template = JSON.parse(JSON.stringify(qsfTemplate)) as typeof qsfTemplate;

  // Remove obsolete development ED declarations, including from a manually re-exported template.
  const surveyFlow = template.SurveyElements.find(e => e.Element === 'FL')?.Payload as any;
  function removeObsoleteFields(flow: any[]) {
    flow.forEach(node => {
      if (node.EmbeddedData) node.EmbeddedData = node.EmbeddedData.filter((ed: EmbeddedDataTemplate) =>
        !['sptPageDataVersion', 'sptPageResults', 'selectedOutputs'].includes(ed.Field) &&
        !/^stimuliItem_\d+_[A-Z]+\d+$/.test(ed.Field));
      if (node.Flow) removeObsoleteFields(node.Flow);
    });
  }
  removeObsoleteFields(surveyFlow.Flow);

  // Set embedded data

  /* @ts-ignore */
  const embeddedData = template.SurveyElements[1].Payload.Flow[0].EmbeddedData as EmbeddedDataTemplate[];
  function setEd(name: string, value: any) {
    let ed = embeddedData.find(ed => ed.Field === name);
    if (!ed) { ed = { Description: name, Field: name, Type: 'Custom' }; embeddedData.push(ed); }
    if (ed) {
      if (value === null) {
        ed.Type = 'Recipient';
        ed.Value = undefined; // Value field will be removed when stringify. That's how Qualtrics represents empty value.
      } else if (typeof value === 'object') {
        ed.Type = 'Custom';
        ed.Value = JSON.stringify(value);
      } else {
        ed.Type = 'Custom';
        ed.Value = `${value}`; // (undefined, true, false...) are parsed to strings
      }
    }
  }

  const stimuliItems = [{
    pools: params.stimuli.map(({ items, shuffle }) => ({
      items: items.map(({ type, content, count }) => ({ type, content, count })),
      shuffle: shuffle,
    })),
    totalTrials: params.totalTrials,
  }];
  setEd('stimuliItems', stimuliItems);
  setEd('totalRounds', params.totalRounds);
  const { pageSettings, ...timeline } = params.timeline;
  const advancedTimeline = buildAdvancedTimeline(params);
  setEd('timeline', advancedTimeline ?? { ...timeline, concurrentDisplays: transformConcurrentDisplays(timeline.concurrentDisplays) });
  if (advancedTimeline) {
    ['sptPoolSelectionArray', 'sptDisplayedPages', 'sptResponsesUnreversed', 'sptResponsesUnreversedArray']
      .forEach(name => setEd(name, null));
  }
  setEd('primes', exportPrime(params));
  setEd('acceptedKeys', params.acceptedKeys.join(','));
  setEd('darkMode', params.trialHtml.darkMode);

  // Render trial html

  const trialSurveyElement = template.SurveyElements.find(e => e.PrimaryAttribute === 'QID2')
  if (trialSurveyElement) {
    const trialHtml = params.trialHtml.customHtml ?? renderTrialHtml(params.trialHtml, params.timeline.concurrentDisplays);
    // @ts-ignore
    trialSurveyElement.Payload.QuestionText = trialHtml;
    // @ts-ignore
    trialSurveyElement.Payload.QuestionDescription = '';
    // @ts-ignore
    trialSurveyElement.SecondaryAttribute = '';
  } else {
    console.error('Failed to render trialHtml: qsf question element QID2 not found.')
  }

  return template;
}

export function generateQsfString(params: AmpParams) {
  const hydrated = hydrateQsf(params);
  // Runtime changes are installed through the manual Qualtrics export workflow.
  // Do not download a new-schema survey paired with the old pageFlow runtime.
  if (buildAdvancedTimeline(params)) {
    const load = hydrated.SurveyElements.find(e => e.PrimaryAttribute === 'QID1')?.Payload as any;
    const trial = hydrated.SurveyElements.find(e => e.PrimaryAttribute === 'QID2')?.Payload as any;
    if (!load?.QuestionJS?.includes('transformAdvancedTimeline') || !trial?.QuestionJS?.includes('sptPoolSelectionArray')) {
      throw new Error('The Qualtrics template needs the updated advanced timeline runtime. Paste amp-qualtrics/src/load.js and src/trial.js into the template experiment, test it, then export QSF and replace src/assets/qsfTemplate.json. Editor settings can still be saved.');
    }
  }
  return JSON.stringify(hydrated);
}

export function generateBlob(str: string) {
  return new Blob([str], { type: 'text/plain' });
}

function exportPrime(params: AmpParams) {
  const primes = params.stimuli.flatMap((stimuli, poolIndex) => (
    stimuli.prime.map(primeItem => ({ ...primeItem, stimuli, poolIndex }))
  ));
  return primes.map(({ uid, name, includeUids, excludeUids, overrideCount, stimuli, poolIndex }) => {
    /** prime export name or stimuli item index (1-based) */
    function getPrimeRefForExport(uidDetail?: UidDetail) {
      if (uidDetail?.type === 'prime') {
        return getPrimeExportName(poolIndex, uidDetail.ref.name);
      } else if (uidDetail?.type === 'stimuli') {
        return uidDetail.index + 1;
      }
    }
    const include = includeUids.flatMap(uid => (
      getPrimeRefForExport(getUidDetail(uid, stimuli)) ?? []
    ));
    const exclude = excludeUids.flatMap(uid => (
      getPrimeRefForExport(getUidDetail(uid, stimuli)) ?? []
    ));
    return {
      name: getPrimeExportName(poolIndex, name),
      pool: poolIndex + 1,
      include: include?.length ? include : undefined,
      exclude: exclude?.length ? exclude : undefined,
      overrideCount: exportOverrideCount(overrideCount),
    }
  });
}

function getPrimeExportName(poolIndex: number, name: string) {
  return `stimuli_${poolIndex + 1}_${name}`;
}

function exportOverrideCount(overrideCount: AmpStimuliPrimeItem['overrideCount']) {
  if (Array.isArray(overrideCount)) {
    return overrideCount.map(x => x === undefined ? null : x);
  } else if (overrideCount === undefined) {
    return null;
  } else { // number or null
    return overrideCount;
  }
}

function transformConcurrentDisplays(concurrentDisplays: AmpTimeline['concurrentDisplays']) {
  return concurrentDisplays?.map(frame => (
    map2d(frame, (pool, row, col) => ({
      key: getDisplayKey(row, col),
      pool: typeof pool === 'number' ? pool + 1 : 0, // empty
    })).flat()
  ));
}

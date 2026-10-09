export interface AmpStimuliItem {
  uid: number;
  type: 'image' | 'text';
  content: string;
  count: number;
}

export type AmpStimuliPrimeItem = {
  uid: number;
  name: string;
  includeUids: number[];
  excludeUids: number[];
  // undefined means no-override, null means selection box is explicit no-override
  overrideCount: (number | undefined) | (number | undefined)[] | null;
};

export interface AmpStimuli {
  items: AmpStimuliItem[];
  shuffle: boolean | number;
  isEnablePriming: boolean;
  prime: AmpStimuliPrimeItem[];
}

export interface AmpTrialHtml {
  width: number;
  height: number;
  marginTop: number;
  instruction: string;
  textFontSize: number;
  textIsBold: boolean;
  textColor?: string;
  textWrap: boolean;
  darkMode: boolean;
  concurrentVerticalGap?: number; // effective only when concurrentDisplays enabled
  concurrentHorizontalGap?: number; // effective only when concurrentDisplays enabled
  customHtml?: string; // this is like an "override"; under params mode it's undefined; when switching to custom mode, it gets rendered from params
  /** @deprecated */
  text?: string; // use instruction
}

export type PoolChoice = number | number[] | 'empty';
export type ConcurrentDisplayFrame = PoolChoice[][]; // [row][column]; 'empty' will map to -1; also called 'frame' in larger context
export type DisplayLayout = number[];

export interface AmpTimeline {
  durationsAndIntervals: [number, number][],
  delayBeforeKeyboard: number,
  delayAfterKeyboard: number,
  autoProceedTimeout: number | null,
  concurrentDisplays?: ConcurrentDisplayFrame[],
  pageSettings?: PageSettings[],
}

export interface AmpParams {
  uidCounter?: number;
  stimuli: AmpStimuli[];
  timeline: AmpTimeline;
  acceptedKeys: string[];
  totalTrials: number;
  totalRounds: number;
  trialHtml: AmpTrialHtml;
}

/** Recursive model; UI edits immutable subtrees instead of mutating generic tree nodes. */
export type PageCondition =
  | { type: 'group'; operator: 'and' | 'or'; children: PageCondition[] }
  | { type: 'response'; pageId: string; operator: 'eq' | 'neq'; values: string[] }
  | { type: 'pool'; pageId: string; position: string; operator: 'eq' | 'neq'; values: number[] };

export interface PageSettings {
  id: string;
  name: string;
  condition?: PageCondition;
  response: {
    mode: 'keyboard' | 'timeout';
    keys: string[];
    duration: number;
    timeout: number | null;
    delayBefore: number;
    delayAfter: number;
  };
  interval: number;
}

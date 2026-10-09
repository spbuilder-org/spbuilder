/**
 * @typedef {import('./type.d.ts').StimuliItem} StimuliItem
 * @typedef {import('./type.d.ts').StimuliPrimeItem} StimuliPrimeItem
 * @typedef {import('./type.d.ts').StimuliPoolConfig} StimuliPoolConfig
 * @typedef {import('./type.d.ts').Params} Params
 * 
 * @typedef {{type: 'image'|'text'|'empty', content: string}|null} StimuliItemToDisplay
 */
/** @type {{params: Params, responses: number[][], responseDurations: number[][]}} */
const myGlobalThis = window.top;


/**
 * One instance per document (iframe)
 */
class GlobalKeydownEventListener {
  constructor() {
    /** @type {(key: string) -> void} */
    this.callback = undefined;
    this.acceptedKeys = [];
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.passKeydownToTopWindow = this.passKeydownToTopWindow.bind(this);
  }
  add() {
    window.addEventListener('keydown', this.passKeydownToTopWindow);
    window.top.addEventListener('keydown', this.handleKeyDown);
    window.top.addEventListener('message', this.handleMessage);
  }
  remove() {
    window.removeEventListener('keydown', this.passKeydownToTopWindow);
    window.top.removeEventListener('keydown', this.handleKeyDown);
    window.top.removeEventListener('message', this.handleMessage);
  }
  handleKeyDown(event) {
    const normalizedKey = this.normalizeKey(event.key);
    if (this.callback && this.acceptedKeys.includes(normalizedKey)) {
      event.stopPropagation();
      event.preventDefault();
      this.callback && this.callback(normalizedKey);
    }
  }
  handleMessage(event) {
    if (event.data && event.data.type === 'iframe-keydown' && this.acceptedKeys.includes(event.data.key)) {
      this.callback && this.callback(event.data.key);
    }
  }
  /**
   * Pass keydown event from iframe to top window. 
   * Otherwise, in Qualtrics Preview, top window cannot receive keydown event if focus is on iframe
   */
  passKeydownToTopWindow(event) {
    if (window === window.top) return;
    const normalizedKey = this.normalizeKey(event.key);
    if (this.callback && this.acceptedKeys.includes(normalizedKey)) {
      event.stopPropagation();
      event.preventDefault();
      window.top.postMessage({
        type: 'iframe-keydown',
        key: normalizedKey,
      });
    }
  }
  normalizeKey(key) {
    // Maybe we should use `code` instead of `key` in the future
    if (key.length === 1) {
      if (key >= '0' && key <= '9') return key;
      if (key >= 'a' && key <= 'z') return key;
      if (key >= 'A' && key <= 'Z') return key.toLowerCase();
      if (key === ' ') return 'Space';
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
      return key;
    }
    return null;
  }
}

// Prepare input and output in myGlobalThis
if (!myGlobalThis.params) {
  alert('Sorry. Critical error occured in the survey webpage. Please restart survey or contact the survey conductor. Error message: "SPT trial parameters not found."');
}
if (myGlobalThis.currentRound === undefined) {
  myGlobalThis.currentRound = 0;
}
if (myGlobalThis.responses === undefined) {
  myGlobalThis.responses = myGlobalThis.params.rounds.map(({ totalTrials }) => Array(totalTrials));
}
if (myGlobalThis.responseDurations === undefined) {
  myGlobalThis.responseDurations = myGlobalThis.params.rounds.map(({ totalTrials }) => Array(totalTrials));
}

const roundIndex = myGlobalThis.currentRound;
const roundParams = myGlobalThis.params.rounds[roundIndex];
if (!roundParams) {
  alert('Sorry. Critical error occured in the survey webpage. Please restart survey or contact the survey conductor. Error message: "SPT round parameters not found for round #' + (roundIndex + 1) + '."');
}


const { pools, totalTrials, timeline, logicalTrial } = roundParams;

let pageFlowRunner;
const keyboardListener = new GlobalKeydownEventListener();
keyboardListener.acceptedKeys = myGlobalThis.params.acceptedKeys;

Qualtrics.SurveyEngine.addOnload(function () {

  const thisQultricsQuestion = this;
  this.hideNextButton();
  this.hidePreviousButton();
  this.hideChoices();

  const displayController = DisplayController(thisQultricsQuestion.questionContainer);
  keyboardListener.add();

  const { currentRound } = myGlobalThis;
  const poolUsage = pools.map(() => 0); // within this round

  if (timeline.pageFlow) {
    myGlobalThis.pageRecords = myGlobalThis.pageRecords || myGlobalThis.params.rounds.map(() => []);
    myGlobalThis.pagePoolUsage = myGlobalThis.pagePoolUsage || myGlobalThis.params.rounds.map(() => []);
    const flow = timeline.pageFlow;
    pageFlowRunner = createPageFlowRunner({
      pages: flow.pages, totalTrials,
      records: myGlobalThis.pageRecords[currentRound],
      draw: createPoolSampler(pools, myGlobalThis.pagePoolUsage[currentRound]),
      display: draws => displayController.display(Object.entries(draws).map(([key, item]) => ({
        key, stimuliItem: Object.assign({}, item, { content: item.type === 'image' ? (myGlobalThis.preload[item.content] || item.content) : item.content }),
      }))),
      clear: () => displayController.clear(),
      listen: (callback, keys) => { keyboardListener.callback = callback; keyboardListener.acceptedKeys = keys; },
      onTrial: (tid, records) => {
        const primary = flow.pages.find(page => page.response.mode === 'keyboard' && records[page.id].status === 'completed');
        if (primary) {
          const record = records[primary.id];
          myGlobalThis.responses[currentRound][tid] = record.response === 'TIMEOUT' ? undefined : record.response;
          myGlobalThis.responseDurations[currentRound][tid] = record.duration === null ? undefined : record.duration;
        }
        exportResponse();
        _set('sptPageDataVersion', '1');
        _set('sptPageResults', JSON.stringify(exportPageRecords(myGlobalThis.pageRecords)));
      },
      onDone: () => {
        keyboardListener.remove();
        myGlobalThis.currentRound = roundIndex + 1;
        thisQultricsQuestion.clickNextButton();
      },
    });
    pageFlowRunner.start();
    return;
  }


  function runTrial(tid) {
    if (timeline) runTimelineTrial(tid);
  }

  // Trial state machine:
  // -> display stimuli[] -> retardation -> !!!await keyboard!!! --@accepted-> retention -> $
  //                                                             --@timeout?--------------> $ 
  function runTimelineTrial(tid) {
    // The shared-variable communication between keyboard thread and timeout thread
    // When one thread is resolved, set isAwaiting=false to disable the other thread
    let isAwaiting = false;
    let awaitKeyboardStartTime;

    console.debug('runTrial', currentRound, tid);

    timeline.concurrentDisplays.forEach((elementPoolMapping, frameIndex) => {
      const stimuliItemsMappedToElement = getElementToStimuliItemMapping(elementPoolMapping, poolUsage);
      const frameStartTime = sum(timeline.durationsAndIntervals.slice(0, frameIndex).flat());
      // Show this frame
      setTimeout(() => {
        displayController.display(stimuliItemsMappedToElement);
      }, frameStartTime);
      if (frameIndex !== timeline.concurrentDisplays.length - 1) {
        // For non-last frame, hide this frame or await input
        const stimuliDuration = timeline.durationsAndIntervals[frameIndex][0];
        setTimeout(() => {
          displayController.clear();
        }, frameStartTime + stimuliDuration);
      } else {
        // For last frame, start awaiting keyboard
        setTimeout(() => {
          isAwaiting = true;
          keyboardListener.callback = keyboardListenerCallback;
          awaitKeyboardStartTime = performance.now();
        }, frameStartTime + (timeline.delayBeforeKeyboard || 0));
        // auto proceed
        if (timeline.autoProceedTimeout !== null && timeline.autoProceedTimeout >= 0) {
          setTimeout(() => {
            if (isAwaiting) {
              isAwaiting = false;
              keyboardListener.callback = undefined;
              nextTrial(tid + 1);
            }
          }, frameStartTime + timeline.autoProceedTimeout);
        }
      }
    });

    function keyboardListenerCallback(key) {
      if (isAwaiting) {
        isAwaiting = false;
        keyboardListener.callback = undefined;
        const duration = Math.floor(performance.now() - awaitKeyboardStartTime);
        myGlobalThis.responses[currentRound][tid] = key;
        myGlobalThis.responseDurations[currentRound][tid] = duration;
        setTimeout(() => {
          nextTrial(tid + 1);
        }, timeline.delayAfterKeyboard); // NaN|undef|negative behaves like 0 
      }
    }
  }

  /**
   * Start next trial, if not ended, after updating the response. Regardless of timeline trial or logical trial
   */
  function nextTrial(newTid) {
    exportResponse();
    myGlobalThis.currentTrial = newTid;
    if (myGlobalThis.currentTrial >= totalTrials) {
      myGlobalThis.currentRound = roundIndex + 1;
      myGlobalThis.currentTrial = undefined;
      thisQultricsQuestion.clickNextButton();
    } else {
      runTrial(newTid);
    }
  }

  nextTrial(0);
});


Qualtrics.SurveyEngine.addOnUnload(function () {
  if (pageFlowRunner) pageFlowRunner.stop();
  keyboardListener.remove();
})


function exportResponse() {
  const { responses, responseDurations } = myGlobalThis;
  _set('sptResponses', responses.map(round => round.join(',')).join(';'));  // empty array item will be empty string
  _set('sptResponsesArray', JSON.stringify(responses));
  _set('sptResponseDurations', responseDurations.map(round => round.join(',')).join(';'));
  _set('sptResponseDurationsArray', JSON.stringify(responseDurations));
}


/**
 * Get content from stimuli or preload
 * @param {number|null} poolIndex 
 * @param {number} shuffledItemIndex 
 * @returns {StimuliItemToDisplay}
 */
function getContent(poolIndex, shuffledItemIndex) {
  if (poolIndex === null) return null;
  if (poolIndex < 0 || shuffledItemIndex >= pools[poolIndex].shuffledIndexes.length) { // Formally, -1 (which is 0 in 1-based config) means empty
    return { type: 'empty', content: '' };
  }
  const itemIndex = pools[poolIndex].shuffledIndexes[shuffledItemIndex];
  const item = pools[poolIndex].items[itemIndex];
  if (item === undefined) {
    return null;
  }
  const { type, content } = item;
  const preload = type === 'image' && myGlobalThis.preload[content];
  return { type, content: preload || content }; // better use ?? here
}



/**
 * @param {{key: string, pool: number|null}[]} elementPoolMapping 
 * @param {number[]} poolUsage
 * @returns {{key: string, stimuliItem: StimuliItemToDisplay}[]}
 */
function getElementToStimuliItemMapping(elementPoolMapping, poolUsage) {
  return elementPoolMapping.map(({ key, pool }) => {
    let stimuliItem = null;
    if (typeof pool === 'number' && pool >= 0) {
      stimuliItem = getContent(pool, poolUsage[pool]);
      poolUsage[pool]++;
    } else if (pool === -1) {
      stimuliItem = { type: 'empty', content: '' };
    }
    return { key, stimuliItem };
  })
}


/**
 * @param {HTMLElement} questionContainer 
 */
function DisplayController(questionContainer) {
  /**
   * @param {{key: string, stimuliItem: StimuliItemToDisplay}[]} stimuliItems
   */
  function display(stimuliItems) {
    clear();
    stimuliItems.forEach(({ key, stimuliItem }) => {
      const contentEl = questionContainer.querySelector('.spt-trial-content.spt-trial-content-' + key);
      if (contentEl) {
        if (stimuliItem !== null) {
          const textEl = contentEl.querySelector('.spt-trial-text');
          const imageEl = contentEl.querySelector('.spt-trial-image');
          if (stimuliItem.type === 'text') {
            if (textEl) textEl.style.visibility = '';
            if (textEl) textEl.innerHTML = stimuliItem.content;
            if (imageEl) imageEl.style.visibility = 'hidden';
            if (imageEl) imageEl.src = '';
          } else if (stimuliItem.type === 'image') {
            if (textEl) textEl.style.visibility = 'hidden';
            if (textEl) textEl.innerHTML = '';
            if (imageEl) imageEl.style.visibility = '';
            if (imageEl) imageEl.src = stimuliItem.content;
          }
          contentEl.style.display = '';
        }
      }
    })
  }
  function clear() {
    questionContainer.querySelectorAll('.spt-trial-content').forEach(contentEl => {
      const textEl = contentEl.querySelector('.spt-trial-text');
      const imageEl = contentEl.querySelector('.spt-trial-image');
      if (textEl) textEl.style.visibility = 'hidden';
      if (textEl) textEl.innerHTML = '';
      if (imageEl) imageEl.style.visibility = 'hidden';
      if (imageEl) imageEl.src = '';
      contentEl.style.display = 'none';
    })
  }
  return { display, clear };
}


// Dark mode
if (myGlobalThis.params.darkMode) {
  let wrapperEl, skinInnerEl;
  let wrapperElOriginalColor, skinInnerElOriginalColor;

  Qualtrics.SurveyEngine.addOnload(function () {
    wrapperEl = document.getElementById('Wrapper');
    if (wrapperEl) {
      wrapperElOriginalColor = wrapperEl.style.backgroundColor;
      wrapperEl.style.backgroundColor = 'black';
      skinInnerEl = wrapperEl.getElementsByClassName('SkinInner').length ? wrapperEl.getElementsByClassName('SkinInner')[0] : null;
      if (skinInnerEl) {
        skinInnerElOriginalColor = skinInnerEl.style.backgroundColor;
        skinInnerEl.style.backgroundColor = 'black';
      }
    }
  });

  Qualtrics.SurveyEngine.addOnUnload(function () {
    if (wrapperEl) {
      wrapperEl.style.backgroundColor = wrapperElOriginalColor;
      if (skinInnerEl) {
        skinInnerEl.style.backgroundColor = skinInnerElOriginalColor;
      }
    }
  });
}



function sum(array) {
  return array.reduce((a, b) => a + b, 0);
}

function _set(name, value) {
  console.debug('[AMP] set ' + name + ' = ' + value);
  Qualtrics.SurveyEngine.setEmbeddedData(name, value);
}
import React, { useEffect, useState } from 'react';
import { Button, Space } from '@arco-design/web-react';
import { configured, consentKey, finishSurvey, getConsent, loadSurvey, Question, saveConsent, setPage, showSurvey, surveyEligible, syncUsage } from './usage';

const prompt = 'May we collect usage statistics to improve SP-Builder? Your experiment content and participant responses are excluded.';

export function UsageSettings({ path }: { path: string }) {
  const [consent, setConsent] = useState(getConsent);
  const [settings, setSettings] = useState(false);
  const [survey, setSurvey] = useState<{ question: Question; submission: string }>();
  const [answer, setAnswer] = useState('');

  useEffect(() => { setPage(path); syncUsage(); }, [path]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === consentKey || event.key === null) {
        syncUsage();
        setConsent(getConsent());
        setSurvey(undefined);
        setSettings(false);
      }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);

  useEffect(() => {
    if (consent !== 'allow' || settings || survey) return;
    const controller = new AbortController();
    let busy = false;
    let retryAfter = 0;
    const available = () => surveyEligible() &&
      !Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"], dialog[open]'))
        .some(dialog => dialog.getClientRects().length > 0 && getComputedStyle(dialog).visibility !== 'hidden');
    const check = async () => {
      if (busy || performance.now() < retryAfter || !available()) return;
      busy = true;
      try {
        const question = await loadSurvey(controller.signal);
        if (question && !controller.signal.aborted && available()) {
          const submission = showSurvey(question);
          if (submission) { setAnswer(''); setSurvey({ question, submission }); }
        }
      } catch { /* Feedback is optional when the network is unavailable. */ }
      finally { busy = false; retryAfter = performance.now() + 60000; }
    };
    void check();
    const timer = window.setInterval(check, 3000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [consent, settings, survey]);

  if (!configured) return null;
  function choose(value: 'allow' | 'decline') {
    saveConsent(value);
    setConsent(value);
    setSettings(false);
    setSurvey(undefined);
  }
  function finish(answer?: string) {
    if (survey) finishSurvey(survey.submission, survey.question, answer);
    setSurvey(undefined);
  }
  return <>
    <footer className="usage-footer"><Button type="text" size="small" onClick={() => setSettings(true)}>Privacy settings</Button></footer>
    {(!consent || settings) ? <aside className="usage-card" aria-label="Usage statistics">
      <p>{prompt}</p>
      <Space><Button size="small" onClick={() => choose('allow')}>Allow statistics</Button>
        <Button size="small" onClick={() => choose('decline')}>Decline</Button></Space>
    </aside> : survey && <aside className="usage-card" aria-label="Optional feedback">
      <fieldset><legend>{survey.question.question}</legend>
        {survey.question.choices.map(choice => <label key={choice}>
          <input type="radio" name="usage-feedback" checked={answer === choice} onChange={() => setAnswer(choice)} /> {choice}
        </label>)}
      </fieldset>
      <Space><Button size="small" disabled={!answer} onClick={() => finish(answer)}>Submit</Button>
        <Button size="small" onClick={() => finish()}>Dismiss</Button></Space>
    </aside>}
  </>;
}

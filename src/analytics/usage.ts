import posthog from 'posthog-js/dist/module.slim.no-external';
import type { CaptureResult } from 'posthog-js';
import type { AmpParams } from '../data/ampTypes';
import { timelineMode } from '../data/timelineMode';
import { DATA_ANALYSIS_ROUTE } from '../config/dataAnalysis';
import { USER_MANUAL_ROUTE } from '../config/userManual';

const routes = { editor: '/', analysis: DATA_ANALYSIS_ROUTE, manual: USER_MANUAL_ROUTE };
type Page = keyof typeof routes;
export type Consent = 'allow' | 'decline';
export type SettingsSource = 'blank' | 'example' | 'imported';
const token = process.env.REACT_APP_POSTHOG_PROJECT_TOKEN;
const region = process.env.REACT_APP_POSTHOG_REGION;
const host = window.location.hostname;
const local = ['localhost', '127.0.0.1', '[::1]'].includes(host);
const production = ['spbuilder.org', 'www.spbuilder.org', 'spbuilder-team.github.io'].includes(host);
const environment = production ? 'prod' : 'beta';
export const configured = Boolean(token?.startsWith('phc_') && (region === 'us' || region === 'eu') && (local || production));
const apiHost = `https://${region}.i.posthog.com`;
const surveyId = process.env.REACT_APP_POSTHOG_SURVEY_ID;
export const consentKey = 'spbuilder.usage.consent';
const sessionKey = 'spbuilder.usage.session';
const surveyKey = 'spbuilder.usage.survey.' + surveyId;
const storageFallback = new Map<string, string | null>();

function read(key: string) {
  if (storageFallback.has(key)) return storageFallback.get(key) ?? null;
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    storageFallback.delete(key);
  } catch { storageFallback.set(key, value); }
}

export function getConsent(): Consent | null {
  const value = read(consentKey);
  return value === 'allow' || value === 'decline' ? value : null;
}
export function saveConsent(value: Consent) {
  write(consentKey, value);
  syncUsage();
}
let active = false;
let initialized = false;
let page: Page | undefined;
let visit: { page: Page; id: string; sessionId: string; opened: number; focused: number | null; delta: number; segment: number } | undefined;
let timer: number | undefined;

interface Session {
  id: string;
  returning: boolean;
  edited: boolean;
  editorMs: number;
  campaign: Record<string, string>;
}

// Keep the entry campaign across refreshes, route changes, and downloads within this SDK session.
function session(): Session {
  let prior: Session | undefined;
  try { prior = JSON.parse(read(sessionKey) || 'null'); } catch { /* Start a fresh session. */ }
  const id = posthog.get_session_id();
  if (prior?.id === id) return prior;
  const campaign: Record<string, string> = {};
  const query = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  const routeQuery = new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '');
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = query.get(key) ?? routeQuery.get(key);
    if (value && /^[a-z0-9_-]{1,64}$/i.test(value)) campaign[key] = value;
  }
  if (document.referrer) {
    try { campaign.$referring_domain = new URL(document.referrer).hostname; } catch { /* Unknown source. */ }
  }
  const next = { id, returning: Boolean(prior), edited: false, editorMs: 0, campaign };
  write(sessionKey, JSON.stringify(next));
  return next;
}

const actionFields = {
  example_loaded: [],
  settings_imported: [],
  settings_download_requested: [],
  analysis_data_imported: [],
  analysis_completed: [],
  processed_data_download_requested: [],
} as const;

const eventFields = {
  ...actionFields,
  $pageview: [],
  $pageleave: ['$prev_pageview_duration', 'previous_page'],
  page_engagement: ['engagement_ms', 'segment'],
  editing_started: [],
  qsf_download_requested: ['started_from', 'mode', 'has_multi_pool', 'has_condition', 'page_count', 'pool_count', 'round_count'],
  'survey shown': ['$survey_id', '$survey_submission_id'],
  'survey dismissed': ['$survey_id', '$survey_submission_id'],
  'survey sent': ['$survey_id', '$survey_submission_id', '$survey_completed'],
} as const;
const sdkFields = ['token', 'distinct_id', '$device_id', '$session_id', '$window_id', '$lib', '$lib_version',
  '$browser', '$browser_version', '$os', '$device_type', '$process_person_profile'];
type EventName = keyof typeof eventFields;
type Meta = Record<string, string | number | boolean>;

// Project the final SDK payload too: URL, initial UTM, person properties and DOM data can be added by the SDK.
function clean(event: CaptureResult): CaptureResult | null {
  if (!active || !visit || getConsent() !== 'allow' || !Object.prototype.hasOwnProperty.call(eventFields, event.event)) return null;
  const fields = [...sdkFields, ...eventFields[event.event as EventName]];
  if (event.event === 'survey sent' && currentQuestionId) fields.push('$survey_response_' + currentQuestionId);
  const properties = Object.fromEntries(fields.filter(key => event.properties[key] !== undefined)
    .map(key => [key, event.properties[key]]));
  const entry = session().campaign;
  const campaign = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', '$referring_domain']
    .filter(key => typeof entry[key] === 'string').map(key => [key, entry[key]]));
  const path = routes[visit.page];
  return {
    uuid: event.uuid, event: event.event, timestamp: event.timestamp,
    properties: { ...properties, ...campaign, environment, page: visit.page, page_instance_id: visit.id,
      $current_url: window.location.origin + '/#' + path, $pathname: path, $host: host },
  };
}
function capture(name: EventName, metadata?: Meta) {
  if (active && visit) posthog.capture(name, metadata, { send_instantly: true });
}

export function recordAction(name: keyof typeof actionFields) {
  capture(name);
}
export function needsEditingEvent() {
  if (!active || !visit) return false;
  resumeVisit();
  return !session().edited;
}
export function editingStarted() {
  if (!active || !visit) return;
  const state = session();
  if (state.edited) return;
  state.edited = true;
  write(sessionKey, JSON.stringify(state));
  capture('editing_started');
}
export function recordQsfDownload(values: AmpParams, startedFrom: SettingsSource) {
  if (!active) return;
  const { timeline, stimuli, totalRounds } = values;
  const frames = timeline.concurrentDisplays;
  capture('qsf_download_requested', {
    started_from: startedFrom, mode: timelineMode(timeline), page_count: frames?.length ?? stimuli.length,
    pool_count: stimuli.length, round_count: totalRounds,
    has_multi_pool: !!frames?.some(frame => frame.some(row => row.some(cell => Array.isArray(cell) && new Set(cell).size > 1))),
    has_condition: !!timeline.pageSettings?.some(item => item.condition),
  });
}

function foreground() { return document.visibilityState === 'visible' && document.hasFocus(); }
function tick() {
  if (!visit) return;
  const now = performance.now();
  if (visit.focused !== null) visit.delta += Math.max(0, now - visit.focused);
  visit.focused = foreground() ? now : null;
}
function flush() {
  if (!visit) return;
  tick();
  const ms = Math.floor(visit.delta);
  if (ms < 1) return;
  visit.delta -= ms;
  if (visit.page === 'editor') {
    const state = session();
    state.editorMs += ms;
    write(sessionKey, JSON.stringify(state));
  }
  capture('page_engagement', { engagement_ms: ms, segment: ++visit.segment });
}
function closePage() {
  if (!visit) return;
  flush();
  capture('$pageleave', { previous_page: visit.page, $prev_pageview_duration: (performance.now() - visit.opened) / 1000 });
  visit = undefined;
}
function openPage() {
  if (!active || !page || visit?.page === page) return;
  closePage();
  const now = performance.now();
  visit = { page, id: crypto.randomUUID(), sessionId: '', opened: now, focused: foreground() ? now : null, delta: 0, segment: 0 };
  capture('$pageview');
  visit.sessionId = posthog.get_session_id();
}

function resumeVisit() {
  if (!visit || !foreground()) return;
  // get_session_id() is read-only. Ask the SDK to apply its idle timeout on actual
  // foreground activity so an old tab can enter a new session before the first edit.
  const id = posthog.sessionManager?.checkAndGetSessionAndWindowId(false).sessionId;
  if (id && visit.sessionId !== id) {
    visit = undefined;
    openPage();
  } else tick();
}
export function setPage(path: string) {
  page = (Object.keys(routes) as Page[]).find(key => routes[key] === path);
  if (page) openPage();
  else closePage();
}
function visibility() {
  if (document.visibilityState === 'hidden') flush();
  else tick();
}
export function syncUsage() {
  const allowed = configured && getConsent() === 'allow';
  if (allowed === active) return;
  active = allowed;
  if (allowed) {
    if (!initialized) {
      posthog.init(token!, {
        api_host: apiHost, persistence: 'localStorage', person_profiles: 'never', autocapture: false,
        capture_pageview: false, capture_pageleave: false, disable_session_recording: true, disable_surveys: true,
        capture_performance: false, advanced_disable_flags: true, disable_external_dependency_loading: true,
        save_campaign_params: false, save_referrer: false, before_send: clean,
      });
      initialized = true;
    }
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
    window.addEventListener('pagehide', closePage);
    window.addEventListener('pageshow', openPage);
    window.addEventListener('focus', resumeVisit);
    window.addEventListener('blur', tick);
    document.addEventListener('visibilitychange', visibility);
    timer = window.setInterval(() => { if (visit && visit.focused !== null) flush(); }, 60000);
    openPage();
  } else {
    window.clearInterval(timer);
    window.removeEventListener('pagehide', closePage);
    window.removeEventListener('pageshow', openPage);
    window.removeEventListener('focus', resumeVisit);
    window.removeEventListener('blur', tick);
    document.removeEventListener('visibilitychange', visibility);
    visit = undefined;
    write(sessionKey, null);
    write(surveyKey, null);
    posthog.opt_out_capturing();
  }
}

export interface Question { id: string; question: string; choices: string[] }
let currentQuestionId: string | undefined;
export function surveyEligible() {
  if (!active || !visit || !foreground() || !surveyId || read(surveyKey)) return false;
  const state = session();
  const pending = visit.page === 'editor' ? visit.delta + (visit.focused === null ? 0 : performance.now() - visit.focused) : 0;
  return state.returning || state.editorMs + pending >= 180000;
}
export async function loadSurvey(signal: AbortSignal): Promise<Question | undefined> {
  if (!surveyEligible()) return;
  const url = new URL('/api/surveys/', apiHost);
  url.searchParams.set('token', token!);
  const response = await fetch(url.toString(), { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) return;
  const { surveys } = await response.json();
  const survey = Array.isArray(surveys) && surveys.find(s => s.id === surveyId && s.type === 'api' && s.start_date && !s.end_date);
  const q = survey?.questions?.[0];
  if (survey?.questions?.length === 1 && q?.type === 'single_choice' && !q.hasOpenChoice &&
      typeof q.id === 'string' && typeof q.question === 'string' && Array.isArray(q.choices) && q.choices.every((c: unknown) => typeof c === 'string')) return q;
}
export function showSurvey(question: Question) {
  if (!surveyEligible()) return;
  const submission = crypto.randomUUID();
  currentQuestionId = question.id;
  write(surveyKey, 'shown');
  capture('survey shown', { $survey_id: surveyId!, $survey_submission_id: submission });
  return submission;
}
export function finishSurvey(submission: string, question: Question, answer?: string) {
  if (!surveyId) return;
  const props = { $survey_id: surveyId, $survey_submission_id: submission };
  if (answer !== undefined && question.choices.includes(answer)) {
    capture('survey sent', { ...props, $survey_completed: true, ['$survey_response_' + question.id]: answer });
  } else capture('survey dismissed', props);
}

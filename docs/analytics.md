# SP-Builder usage analytics

The editor, data analysis tool and manual share one US PostHog project. The production dashboard measures published site usage (`environment = prod`). The beta dashboard measures local development and testing (`environment = beta`). Each dashboard has its own saved insights.

## Consent and collection

The browser asks “May we collect usage statistics to improve SP-Builder? Your experiment content and participant responses are excluded.” Collection starts on **Allow statistics**. **Privacy settings** lets a visitor change their choice. Consent is stored on the current origin.

Events carry an anonymous browser and session ID, logical page, environment and basic browser/device properties. Session entry retains the referring domain and `utm_source`, `utm_medium` and `utm_campaign` (campaign tags accept up to 64 letters, digits, hyphens or underscores). PostHog can estimate a city from the request IP. Geolocation may be unknown. A campaign targeting a city and a visitor's estimated city are separate dimensions.

The payload allowlist excludes raw URLs, experiment text, stimulus URLs, filenames, CSV rows, participant responses and analysis results. Autocapture and session replay are disabled. The Qualtrics runtime has no analytics integration.

## Events

| Event | When it fires |
| --- | --- |
| `$pageview`, `$pageleave` | One visit per logical route (`editor`, `analysis`, `manual`). A tab returning after session expiry starts a fresh visit. Each visit has a `page_instance_id`. On leave, `$prev_pageview_duration` is elapsed seconds on the page being left. |
| `page_engagement` | New milliseconds spent visible and focused. Flush on hide, navigation, exit and every active minute. `segment` identifies each increment within the visit. |
| `editing_started` | First user action that changes editor settings in a session. Initialization, example loading and settings import are excluded. |
| `example_loaded`, `settings_imported` | Confirmed example or successfully applied settings file. |
| `settings_download_requested` | Click on the settings download link. |
| `qsf_download_requested` | Click on a generated QSF link. Includes `started_from` (blank, example or imported), `mode`, `has_multi_pool`, `has_condition`, `page_count`, `pool_count` and `round_count`. A completed file transfer cannot be observed from the editor. |
| `analysis_data_imported`, `analysis_completed` | Nonempty CSV loaded without parser errors, then a successful **Generate Results** action. These fire independently. |
| `processed_data_download_requested` | **Download** on the Data tab requests the processed CSV. Each request counts once, including downloads before **Generate Results**. No file metadata or CSV content is sent. |
| `survey shown`, `survey dismissed`, `survey sent` | Native PostHog survey events for the optional feedback question. The visitor can select one preset answer. |

The survey becomes eligible on a returning browser's second distinct session or after three foreground minutes in the editor in one session. Refreshes retain the current session. The card waits for a visible, focused page without an open dialog and is offered once per consenting browser profile on that origin. Survey response rate is unique submitters divided by unique viewers.

## Dashboard

The first row shows the current UTC calendar month to date as a number, alongside a six-month trend. Each point represents one calendar month, including the current partial month. **Monthly Page Visits** (PV) counts every `$pageview` across the editor, analysis tool and manual. **Monthly User Visits** (UV) counts each anonymous browser identity with a `$pageview` once per month across those routes.

**Editor settings actions** counts each confirmed **Use Example Settings**, successful **Load**, and **Save** download request over the last 30 days. Repeated actions count separately.

| Funnel | Ordered steps within a single session |
| --- | --- |
| Editor to QSF download | Editor view → QSF download request |
| Manual editing to QSF download | Editor view → first edit → QSF download request |
| Analysis visit to results | Analysis view → CSV import → completed analysis |

Each step counts unique PostHog session IDs. Intervening events are allowed. Compare the first two funnels to include visitors who download directly from an example or import. The campaign/city table shows editor sessions, conversions and rate. The export table groups QSF requests by starting point, mode and enabled features.

The time table reports median and mean elapsed seconds for visits with an observed leave, plus leave coverage. Foreground seconds are summed per visit after deduplicating segments, then summarized across visits with measured focus. Closing a browser can lose the final segment or leave event.

## Build configuration

Before running CRA, set `REACT_APP_POSTHOG_PROJECT_TOKEN` to your public project token and `REACT_APP_POSTHOG_REGION` to your project's region (`us` or `eu`). To enable the optional feedback question, set `REACT_APP_POSTHOG_SURVEY_ID` to the ID of your single-choice API survey. Use ignored `.env.development.local` for local development and `.env.production.local` or build environment variables for a release. Collection is enabled on localhost/loopback and the SP-Builder production hosts. Without a configured token and region, the app runs without analytics. OAuth credentials belong to maintainer tools only.

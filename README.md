# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

## Concurrent and conditional pages

Enable **Enable concurrent/conditional stimuli display** to edit pages. A position can
select several source pools. Each draw chooses uniformly among its nonempty pools,
then consumes one remaining item count from that pool. Selecting the same pool twice
does not increase its weight. Positions and pages share counts within a round; the
next round gets fresh counts after priming. Pool ordering/shuffle settings still
apply within each pool. Pools are never refilled during a round. A position is blank
when every selected pool is exhausted.

Pages end on a fixed duration or a keyboard response, optionally with a timeout
measured from page onset. Response time starts when keyboard input becomes enabled.
Conditions can inspect an earlier page's response or a position's actual source
pool. Use **Add condition** and **Add group** to combine nested AND/OR groups; new
groups default to AND. Deleting a group removes its subtree. Empty groups and invalid
references must be fixed before QSF export. A skipped page consumes no stimuli;
skipped or exhausted references are unknown, including for `is not` comparisons.

For insect/flower feedback, configure the error page as OR of two AND groups:
`(source = insect AND response != d) OR (source = flower AND response != k)`.

QSF exports are self-contained. New page mode adds `sptPageDataVersion=1` and
`sptPageResults`: rounds → trials → stable page IDs → status, response, duration,
and per-position draws. Output pool/item numbers are one-based. Each draw records
`drawn`, `blank`, or `exhausted`; pages record `completed` or `skipped`. `TIMEOUT` is
an explicit page response. Existing trial response fields retain the first completed
keyboard page's response/time. The built-in legacy data analysis rejects page-mode
exports because its shuffle-order-to-trial assumption does not apply; analyze actual
`sptPageResults` instead. Old settings without page settings retain the legacy runtime.
Opening old concurrent settings in the editor initializes equivalent per-page controls.

### Runtime maintenance and checks

Runtime source is maintained in the separate `amp-qualtrics` repository:
`src/load.js` and `src/trial.js`. The entire `trial.js` is ready to paste into
Qualtrics; its sampling policy, inventory, conditions, and page scheduling are
separate functions within that file. SP-Builder does not maintain another runtime
source copy or automatically rewrite the QSF template.

Keep the manual release workflow:

1. Edit `amp-qualtrics/src/load.js` and/or `src/trial.js`.
2. Prepare the template experiment in Qualtrics (one-time setup).
3. Paste the complete scripts into the template questions and test the experiment.
4. Export the experiment as QSF and replace `src/assets/qsfTemplate.json` here.

Run `npm run test:runtime` in `amp-qualtrics` to test the source and in SP-Builder
to test the imported QSF scripts. Tests do not write back to the template. The
current STML-29 candidate template was assembled locally during development; it
still needs testing and a fresh export from the Qualtrics template experiment.

Use Node 20+ for `npm run test:runtime`. These tests include the actual generated QSF
load/trial scripts in a Qualtrics API test harness, legacy behavior, two rounds,
feedback branches, depletion, caching, timeouts, and cleanup. Run
`npm test -- --watchAll=false --runInBand`, `npx tsc --noEmit`, and `npm run build`
for editor/export checks. A test harness does not replace verification in a hosted
Qualtrics survey.

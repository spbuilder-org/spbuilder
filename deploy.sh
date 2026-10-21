#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Publish a traceable source commit to the existing SP-Builder site.
if ! git diff --quiet HEAD --; then
  echo 'Commit tracked changes before deploying.' >&2
  exit 1
fi
source_sha=$(git rev-parse HEAD)
npm run check:template
npm run build
printf 'spbuilder.org\n' > build/CNAME

GIT_SSH_COMMAND='ssh -i ~/.ssh/spbuilder-team -o IdentitiesOnly=yes -o BatchMode=yes' \
  ./node_modules/.bin/gh-pages -d build \
  --repo git@github.com:spbuilder-team/spbuilder-team.github.io.git \
  --branch gh-pages --message "Deploy SP-Builder ${source_sha}"

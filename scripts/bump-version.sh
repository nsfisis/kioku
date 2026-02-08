#!/usr/bin/env bash

set -euo pipefail

VERSION="$1"

sed -i 's/"version": ".*"/"version": "'$VERSION'"/' package.json
git add package.json
git commit -m "feat: bump version to v$VERSION"
git tag "v$VERSION"

echo "Bumped to v$VERSION"

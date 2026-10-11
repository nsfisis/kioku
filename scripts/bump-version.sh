#!/usr/bin/env bash

set -euo pipefail

VERSION="$1"

# The cleanup of the legacy "kioku-crdt-sync" IndexedDB database is to be
# dropped in v0.7.1. Remove deleteLegacyCrdtDatabase() (src/client/db/clear.ts)
# and its callers, then delete this check.
if [[ "$VERSION" == "0.7.1" ]]; then
	echo "v0.7.1 must drop the legacy kioku-crdt-sync cleanup first:" >&2
	echo "remove deleteLegacyCrdtDatabase() and its callers, then delete this check from $0." >&2
	exit 1
fi

sed -i 's/"version": ".*"/"version": "'$VERSION'"/' package.json
git add package.json
git commit -m "feat: bump version to v$VERSION"
git tag "v$VERSION"

echo "Bumped to v$VERSION"

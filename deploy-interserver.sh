#!/usr/bin/env bash
# Build and publish an immutable portfolio release, preserving the previous target.
set -euo pipefail
cd "$(dirname "$0")"
npm run build
release=$(date -u +%Y%m%dT%H%M%SZ)
remote=/var/www/daviddn-portfolio/releases/$release
ssh -o BatchMode=yes interserver-vps "mkdir -p '$remote'"
rsync -az dist/ "interserver-vps:$remote/"
ssh -o BatchMode=yes interserver-vps python3 - "$release" <<'PY'
import os,sys,pathlib
base=pathlib.Path('/var/www/daviddn-portfolio');release=sys.argv[1]
current=base/'current';target=base/'releases'/release
assert (target/'index.html').is_file()
if current.is_symlink(): (base/('previous-'+release)).symlink_to(os.readlink(current))
staged=base/('next-'+release);staged.symlink_to(target);os.replace(staged,current)
print('Portfolio release',release,'active')
PY
curl --fail --silent --show-error -o /dev/null https://daviddn.dev/
echo 'Portfolio verified at https://daviddn.dev/'

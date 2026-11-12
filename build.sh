#!/bin/sh
# Same as: npm run build
cd "$(dirname "$0")" && node tools/build.mjs

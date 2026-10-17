#!/usr/bin/env bash
# Joins the per-role videos into one full-length tutorial.
#   bash concat.sh [lang]   (default: en)
set -euo pipefail
LANG_CODE="${1:-en}"
cd "$(dirname "$0")/out"
if [[ $LANG_CODE == en ]]; then DIR=videos; NAME=laxmi-samadhan-full-tutorial.mp4
else DIR=$LANG_CODE/videos; NAME=$LANG_CODE/laxmi-samadhan-full-tutorial-$LANG_CODE.mp4; fi
(cd "$DIR" && ls [0-9]*.mp4 | sed "s/.*/file '&'/" > list.txt)
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$DIR/list.txt" -c copy "$NAME"
rm "$DIR/list.txt"
echo "Full tutorial: out/$NAME"

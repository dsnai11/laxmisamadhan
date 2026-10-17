#!/usr/bin/env bash
# Joins the per-role videos into one full-length tutorial.
set -euo pipefail
cd "$(dirname "$0")/out/videos"
ls [0-9]*.mp4 | sed "s/.*/file '&'/" > list.txt
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i list.txt -c copy ../laxmi-samadhan-full-tutorial.mp4
rm list.txt
echo "Full tutorial: out/laxmi-samadhan-full-tutorial.mp4"

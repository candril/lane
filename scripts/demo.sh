#!/usr/bin/env bash
# Record the README demo gif from the demo board, unattended — the same tmux capture
# and Pillow render as scripts/shots.sh, one frame per step of docs/demo.txt.
#
#   scripts/demo.sh                     # → site/src/assets/lane-demo.gif
#
# Each line of docs/demo.txt is `hold-seconds | keys | keycap | caption`: the keys are
# sent, the pane is captured after they land, and the frame is shown for that long with
# the keycap and caption printed in a strip underneath. A line with no keys just holds
# the previous frame longer.
set -euo pipefail

cd "$(dirname "$0")/.."

COLS=${DEMO_COLS:-140}
ROWS=${DEMO_ROWS:-42}
OUT=${DEMO_OUT:-site/src/assets/lane-demo.gif}
SESSION=lane-demo-rec
SCRATCH=${TMPDIR:-/tmp}/lane-demo-rec

rm -rf "$SCRATCH"
mkdir -p "$SCRATCH/xdg"

tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -x "$COLS" -y "$ROWS" \
  "XDG_CACHE_HOME=$SCRATCH/xdg/cache XDG_STATE_HOME=$SCRATCH/xdg/state \
   XDG_CONFIG_HOME=$SCRATCH/xdg/config \
   bun --define 'LANE_VERSION=\"0.1.0\"' src/index.tsx --mock 2>/dev/null; sleep 600"
sleep 3

# Captions are prose — apostrophes and quotes rule out the `xargs` trim used elsewhere.
trim() { printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }

manifest="$SCRATCH/frames.tsv"
: > "$manifest"
n=0
while IFS='|' read -r hold keys keycap caption; do
  [[ -z "${hold// /}" || "${hold// /}" == \#* ]] && continue
  hold=$(trim "$hold")
  keys=$(trim "$keys")
  keycap=$(trim "${keycap:-}")
  caption=$(trim "${caption:-}")
  for key in $keys; do
    if [ "$key" = "wait" ]; then
      sleep 2
      continue
    fi
    tmux send-keys -t "$SESSION" -- "$key"
    sleep 0.3
  done
  sleep 0.6
  n=$((n + 1))
  frame=$(printf "%s/frame-%03d.txt" "$SCRATCH" "$n")
  tmux capture-pane -t "$SESSION" -e -N -p > "$frame"
  printf '%s\t%s\t%s\t%s\n' "$frame" "$hold" "$keycap" "$caption" >> "$manifest"
done < docs/demo.txt

tmux kill-session -t "$SESSION" 2>/dev/null || true
python3 scripts/render-shot.py --gif "$OUT" --frames "$manifest" --cols "$COLS" --rows "$ROWS"

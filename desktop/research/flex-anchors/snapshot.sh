#!/usr/bin/env bash
# Snapshot the running research workflow's journal into the repo and push it, so
# progress survives a container reset. Safe to run repeatedly (no-op when unchanged).
set -u
REPO=/home/user/fdat
DIR=$REPO/desktop/research/flex-anchors
JOURNAL=${1:-/root/.claude/projects/-home-user-fdat/fb1d7f18-f46f-5695-b961-37c4221bc0d5/subagents/workflows/wf_2d53e9ec-f9f/journal.jsonl}
[ -f "$JOURNAL" ] || { echo "no journal at $JOURNAL"; exit 0; }
cp "$JOURNAL" "$DIR/journal.jsonl"
python3 "$DIR/rebuild.py" "$DIR/journal.jsonl" "$DIR/state.json" >/dev/null
cd "$REPO" || exit 1
if git diff --quiet -- desktop/research/flex-anchors && [ -z "$(git ls-files --others --exclude-standard desktop/research/flex-anchors)" ]; then
  echo "snapshot unchanged"; exit 0
fi
for attempt in 1 2 3; do
  if git add desktop/research/flex-anchors && git commit -q -m "research: snapshot FLEx anchor workflow progress ($(python3 -c "import json;print(len(json.load(open('$DIR/state.json'))['results']))") agent results)" ; then
    git push -q origin HEAD 2>/dev/null && { echo "snapshot pushed"; exit 0; }
  fi
  sleep 15
done
echo "snapshot: commit/push failed after retries"; exit 1

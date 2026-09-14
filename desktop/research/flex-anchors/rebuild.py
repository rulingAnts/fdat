#!/usr/bin/env python3
"""Rebuild state.json (label -> result) from a workflow journal.jsonl snapshot.

The Workflow runtime appends one JSON line per event: {"type":"started","key":..,"label":..}
and {"type":"result","key":..,"result":..}. Results are keyed by a hash of the agent's
prompt+options; this script joins them back to the human-readable labels the script assigns
(sweep:<key>, verify:<key>#<n>:<lens>, critic, gap:<i>, verify:gap<i>#<j>:<lens>, synthesize).

    python rebuild.py journal.jsonl state.json
"""
import json, sys

src = sys.argv[1] if len(sys.argv) > 1 else 'journal.jsonl'
dst = sys.argv[2] if len(sys.argv) > 2 else 'state.json'
labels = {}
results = {}
with open(src, encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get('type') == 'started' and e.get('key') and e.get('label'):
            labels[e['key']] = e['label']
        elif e.get('type') == 'result' and e.get('key') in labels:
            r = e.get('result')
            if isinstance(r, str):
                try:
                    r = json.loads(r)
                except json.JSONDecodeError:
                    pass  # plain-text result (e.g. the synthesis report)
            if r is not None:
                results[labels[e['key']]] = r
json.dump({'results': results}, open(dst, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(f'{len(results)} completed agent results -> {dst}')
for k in results:
    print('  ', k)

#!/bin/bash
# usage: review.sh DIR K [N]  -> id check, counts, max length, flags, and the first N changes with old text
D=$1; k=$2
diff <(jq -r '.[].id' $D/batch-$k.json) <(jq -r '.[].id' $D/ops-$k.json) >/dev/null && echo "ids ok" || echo "ID MISMATCH (subagents sometimes mistype an id: fix before applying)"
jq -r 'group_by(.action)|map("\(.[0].action) \(length)")|join(", ")' $D/ops-$k.json
jq -r '"max supersede length: \([.[]|select(.action=="supersede")|.content|length]|max)"' $D/ops-$k.json
jq -r '.[]|select(.action=="supersede")|select(.content|test("[Nn]ot yet live|merged as|\\[ledger|still open|\\b[0-9a-f]{8,40}\\b|task-1[0-9]{12}"))|"FLAG \(.id[-6:]): \(.content)"' $D/ops-$k.json
jq -r --slurpfile b $D/batch-$k.json '($b[0]|map({(.id):.content})|add) as $o | .[]|select(.action!="keep")|"\(.id[-6:]) \(.action[0:3]): \(.content // .reason)\n   WAS: \($o[.id][0:160])"' $D/ops-$k.json | head -${3:-60}

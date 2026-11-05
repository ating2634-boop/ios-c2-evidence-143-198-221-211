# -*- coding: utf-8 -*-
"""Stage-3: parse MM properly (JSON), decode every entry, sweep IOC."""
import re
import json
import base64
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
BASE = r'C:\Users\WMTG\Downloads\evidence\ios-c2'

stage1 = open(BASE + r'\stage1_obChTK.js', encoding='utf-8').read()
print(f'stage1 length: {len(stage1)}')

# isolate the JSON object after "let MM="
i = stage1.find('{')
obj_str = stage1[i:] if i >= 0 else ''
print(f'object slice from: {len(obj_str)}')

mm = {}
end = 0
try:
    mm, end = json.JSONDecoder().raw_decode(obj_str)
    print(f'MM parsed OK via raw_decode, entries = {len(mm)}, consumed {end} chars')
except Exception as e:
    print('raw_decode failed:', e)
    for h, v in re.findall(r'"([^"]{8,80})"\s*:\s*"([A-Za-z0-9+/=]+)"', stage1):
        mm[h] = v
    end = len(stage1)
    print(f'fallback entries = {len(mm)}')

# tail of stage1 (code after the table)
tail = stage1[i + end:] if i >= 0 else ''
print(f'\n--- stage1 tail ({len(tail)} chars) ---')
print(tail[:1500])

# decode every entry
chunks = []
for h, v in mm.items():
    try:
        body = base64.b64decode(v).decode('utf-8', 'replace')
    except Exception:
        body = '<FAIL>'
    chunks.append(f'\n/* ===== {h} (len={len(body)}) ===== */\n{body}')

allcode = '\n'.join(chunks)
open(BASE + r'\stage3_all_functions.js', 'w', encoding='utf-8').write(allcode)
print(f'\ndecoded {len(chunks)} entries, total {len(allcode)} chars -> stage3_all_functions.js')

blob = stage1 + '\n' + allcode

urls = sorted(set(re.findall(r'https?://[^\s"\'`\)\]\},;]{4,140}', blob)))
print(f'\n=== URLs ({len(urls)}) ===')
for u in urls[:50]:
    print(' ', u)

doms = sorted(set(re.findall(
    r'\b(?:[a-z0-9][a-z0-9\-]{1,40}\.)+(?:com|net|org|cn|io|xyz|top|cc|vip|info|site|club|app|dev|link|shop|icu|fun)\b',
    blob, re.I)))
print(f'\n=== domains ({len(doms)}) ===')
for d in doms[:50]:
    print(' ', d)

paths = sorted(set(re.findall(r'["\'`](/(?:api|v[0-9]|beacon|result|war|log|stats|next-chain|exfil|chain|data|upload|register|report|task|cmd)[A-Za-z0-9_\-/]{0,50})["\'`]', blob)))
print(f'\n=== API paths ({len(paths)}) ===')
for p in paths[:50]:
    print(' ', p)

keys = sorted(set(re.findall(r'\b(?:key|token|secret|password|pass|iv|salt)\s*[:=]\s*["\']([^"\']{4,60})["\']', blob, re.I)))
print(f'\n=== key-like literals ({len(keys)}) ===')
for k in keys[:30]:
    print(' ', k)

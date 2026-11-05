# -*- coding: utf-8 -*-
"""Stage-2: unwrap obChTK = new Function(atob(...)) -> let MM={hash: base64(src)}"""
import re
import base64
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = r'C:\Users\WMTG\Downloads\evidence\ios-c2'
src = open(BASE + r'\index.js', encoding='utf-8', errors='replace').read()

# 1) locate the atob(...) payload of obChTK
m = re.search(r'obChTK\s*=\s*new Function\(atob\("([A-Za-z0-9+/=]{200,})"\)', src)
if not m:
    m = re.search(r'atob\("([A-Za-z0-9+/=]{200,})"\)', src)
if not m:
    print('NO atob payload found')
    sys.exit(1)

b64 = m.group(1)
print(f'atob payload length: {len(b64)}')
try:
    stage1 = base64.b64decode(b64).decode('utf-8', 'replace')
except Exception as e:
    print('b64 decode failed:', e)
    sys.exit(1)

print(f'stage1 length: {len(stage1)}')
print('stage1 head:', stage1[:300].replace('\n', ' '))
open(BASE + r'\stage1_obChTK.js', 'w', encoding='utf-8').write(stage1)

# 2) parse MM = { "hash": "base64", ... }
pairs = re.findall(r'"([0-9a-f]{40})"\s*:\s*"([A-Za-z0-9+/=]+)"', stage1)
print(f'\nMM entries: {len(pairs)}')

out = []
ok = 0
for h, v in pairs:
    try:
        body = base64.b64decode(v).decode('utf-8', 'replace')
        ok += 1
    except Exception:
        body = '<decode failed>'
    out.append(f'\n/* ===== {h} ===== */\n{body}')

print(f'decoded entries: {ok}/{len(pairs)}')
open(BASE + r'\stage2_all_functions.js', 'w', encoding='utf-8').write('\n'.join(out))
print('written -> stage2_all_functions.js')

# 3) quick IOC sweep across all recovered code
blob = stage1 + '\n' + '\n'.join(out)
urls = sorted(set(re.findall(r'https?://[^\s"\'`\)\]\}]{4,120}', blob)))
print(f'\n--- URLs found ({len(urls)}) ---')
for u in urls[:40]:
    print(' ', u)

doms = sorted(set(re.findall(
    r'\b(?:[a-z0-9][a-z0-9\-]{1,40}\.)+(?:com|net|org|cn|io|xyz|top|cc|vip|info|site|club|app|dev|link|shop)\b',
    blob, re.I)))
print(f'\n--- domains found ({len(doms)}) ---')
for d in doms[:40]:
    print(' ', d)

paths = sorted(set(re.findall(r'["\'](/(?:api|v\d|beacon|result|war|log|stats|next-chain|exfil|chain|data|upload|register)[A-Za-z0-9_\-/]{0,40})["\']', blob)))
print(f'\n--- API paths found ({len(paths)}) ---')
for p in paths[:40]:
    print(' ', p)

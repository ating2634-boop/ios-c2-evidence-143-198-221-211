# -*- coding: utf-8 -*-
"""Full static string recovery: each array uses its own XOR key literal."""
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PATH = r'C:\Users\WMTG\Downloads\evidence\ios-c2\index.js'
src = open(PATH, encoding='utf-8', errors='replace').read()

OUT = r'C:\Users\WMTG\Downloads\evidence\ios-c2\recovered_strings.txt'
res = []

# pattern: [..nums..].map(V=>String.fromCharCode(KEY^V))
pat = re.compile(
    r'\[([\d,\s]{4,})\]\s*\.\s*map\s*\(\s*V\s*=>\s*String\.fromCharCode\(\s*(\d{1,3})\s*\^\s*V\s*\)\s*\)')
matches = pat.findall(src)
print(f'xor-encoded string arrays: {len(matches)}')

seen = set()
for nums_s, key_s in matches:
    key = int(key_s)
    try:
        nums = [int(x) for x in nums_s.split(',') if x.strip()]
    except Exception:
        continue
    s = ''.join(chr(key ^ v) for v in nums if 0 <= (key ^ v) < 0x110000)
    if not s or s in seen:
        continue
    seen.add(s)
    res.append((key, s))

res.sort(key=lambda x: -len(x[1]))
for key, s in res:
    line = f'[key={key:3d}] {s}'
    print(line[:300])
    with open(OUT, 'a', encoding='utf-8') as f:
        f.write(line + '\n')

# also decode fqMaGkN4 big arrays (string tables)
def decode_fq(nums):
    """fqMaGkN4: T='%u'+hex(byte1)+hex(byte0) ... unescape => U+ (byte1<<8|byte0)"""
    out = []
    for R in nums:
        b0 = R & 255
        b1 = (R >> 8) & 255
        b2 = (R >> 16) & 255
        b3 = (R >> 24) & 255
        out.append(chr((b1 << 8) | b0))
        out.append(chr((b3 << 8) | b2))
    return ''.join(out)

fq_pat = re.compile(r'fqMaGkN4\(\s*\[([\d,\s]{20,})\]\s*\)')
print('\n--- fqMaGkN4 string tables ---')
with open(OUT, 'a', encoding='utf-8') as f:
    f.write('\n\n===== fqMaGkN4 tables =====\n')
for nums_s in fq_pat.findall(src):
    try:
        nums = [int(x) for x in nums_s.split(',') if x.strip()]
    except Exception:
        continue
    if not nums:
        continue
    d = decode_fq(nums)
    print(f'  [fq n={len(nums)}] {d[:200]!r}')
    with open(OUT, 'a', encoding='utf-8') as f:
        f.write(f'\n--- fq n={len(nums)} ---\n{d}\n')

print(f'\nrecovered -> {OUT}')

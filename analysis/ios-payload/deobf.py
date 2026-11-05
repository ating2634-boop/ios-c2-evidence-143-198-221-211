# -*- coding: utf-8 -*-
"""Static deobfuscator for the weifile payload. Does NOT execute any JS."""
import re
import sys

PATH = r'C:\Users\WMTG\Downloads\evidence\ios-c2\index.js'
src = open(PATH, encoding='utf-8', errors='replace').read()
print(f'source length: {len(src)}')

arrays = re.findall(r'\[([\d,\s]{20,})\]', src)
print(f'numeric arrays found: {len(arrays)}')


def decode_fq(nums):
    """Reimplementation of fqMaGkN4: 32-bit int -> two UTF-16 code units."""
    out = []
    for R in nums:
        b0 = R & 255
        b1 = (R >> 8) & 255
        b2 = (R >> 16) & 255
        b3 = (R >> 24) & 255
        out.append(chr((b2 << 8) | b0))
        out.append(chr((b3 << 8) | b1))
    return ''.join(out)


def xor88(nums):
    return ''.join(chr(88 ^ v) for v in nums if 0 <= v < 256)


def printable_ratio(s):
    if not s:
        return 0.0
    ok = sum(1 for ch in s if 32 <= ord(ch) < 127 or ord(ch) > 0x2000)
    return ok / len(s)


results = []
for i, a in enumerate(arrays):
    try:
        nums = [int(x) for x in a.split(',') if x.strip()]
    except Exception:
        continue
    if not nums:
        continue
    info = {'idx': i, 'n': len(nums), 'max': max(nums)}
    out = []
    if max(nums) < 256:
        d = xor88(nums)
        info['xor88_printable'] = round(printable_ratio(d), 2)
        out.append(('xor88', d))
    if max(nums) > 0xFFFFFF:
        d = decode_fq(nums)
        info['fq_printable'] = round(printable_ratio(d), 2)
        out.append(('fq', d))
    results.append((info, out))

results.sort(key=lambda x: -x[0]['n'])
for info, out in results[:8]:
    print(f"\n=== array[{info['idx']}] n={info['n']} max={info['max']} "
          f"xor88p={info.get('xor88_printable')} fqp={info.get('fq_printable')} ===")
    for name, d in out:
        preview = d[:500].replace('\n', '\\n').replace('\r', '\\r')
        print(f'  [{name}] {preview}')

# dump full decodes of the two big arrays
big = [r for r in results if r[0]['n'] > 50]
with open(r'C:\Users\WMTG\Downloads\evidence\ios-c2\decoded_strings.txt', 'w',
          encoding='utf-8') as f:
    for info, out in results:
        f.write(f"\n===== array[{info['idx']}] n={info['n']} max={info['max']} =====\n")
        for name, d in out:
            f.write(f'--- {name} ---\n{d}\n')
print('\nfull decode dumped -> decoded_strings.txt')

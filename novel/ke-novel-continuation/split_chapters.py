# -*- coding: utf-8 -*-
"""Split 送给可可的一切（第一卷）.md into chapter_01.md ... chapter_36.md"""
import os

src = os.path.join(os.path.dirname(__file__), '..', '送给可可的一切（第一卷）.md')
out_dir = os.path.join(os.path.dirname(__file__), 'chapters')

with open(src, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find line indices where line.strip() is "1", "2", ... "36"
markers = {}
for i, line in enumerate(lines):
    s = line.strip()
    if s.isdigit() and 1 <= int(s) <= 36:
        n = int(s)
        if n not in markers:
            markers[n] = i

# Build chapter contents: chapter N = from (marker N + 1) to (marker N+1 - 1), or to end for 36
# Include 序言 at start of chapter_01 (lines 0-1), then "1" at line 2, then content from line 3
if 1 in markers:
    start_1 = markers[1] + 1  # first line of ch1 content after "1"
else:
    start_1 = 0

# Chapter 1: 序言 (lines 0,1) + content from after "1" (line 3) to before "2" (line 26)
preface = ''.join(lines[0:2])  # 序言
ch1_content = preface + '\n\n' + ''.join(lines[markers[1]+1:markers[2]])
os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, 'chapter_01.md'), 'w', encoding='utf-8') as f:
    f.write(ch1_content)

for n in range(2, 36):
    start = markers[n] + 1
    end = markers[n + 1]
    content = ''.join(lines[start:end])
    with open(os.path.join(out_dir, f'chapter_{n:02d}.md'), 'w', encoding='utf-8') as f:
        f.write(content)

# Chapter 36: from after "36" to end
ch36_start = markers[36] + 1
ch36_content = ''.join(lines[ch36_start:])
with open(os.path.join(out_dir, 'chapter_36.md'), 'w', encoding='utf-8') as f:
    f.write(ch36_content)

print('Split done:', len(markers), 'chapters')

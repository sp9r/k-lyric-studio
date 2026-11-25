"""Build lib/hanja_readings.js from libhangul's hanja.txt.

Usage: python tools/build_hanja.py <path/to/hanja.txt>

hanja.txt (https://github.com/libhangul/libhangul, data/hanja/hanja.txt) lists
"reading:hanja:note". The one-syllable entries give each character's Korean reading,
and they also cover the Japanese forms (恋 련, 学 학, 気 기). Only those readings are
kept, for the characters Japanese text uses (JIS X 0208), so the extension can check
that a kanji word in the Japanese translation is read the same as the Korean word.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "lib" / "hanja_readings.js"

NOTICE = """// Korean readings of kanji, built by tools/build_hanja.py from libhangul data/hanja/hanja.txt.
// Copyright (c) 2005,2006 Choe Hwanjin. All rights reserved.
// Redistribution and use in source and binary forms, with or without modification, are
// permitted provided that the conditions in THIRD_PARTY_NOTICES.md are met.
"""


def in_jis(ch):
    try:
        b = ch.encode("shift_jis")
    except UnicodeEncodeError:
        return False
    return len(b) == 2 and b[0] >= 0x88  # kanji area of JIS X 0208


def main(src):
    readings = {}
    for line in Path(src).read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        parts = line.split(":")
        if len(parts) < 2 or len(parts[0]) != 1 or len(parts[1]) != 1:
            continue
        syl, ch = parts[0], parts[1]
        if not ("\uac00" <= syl <= "\ud7a3") or not in_jis(ch):
            continue
        cur = readings.setdefault(ch, "")
        if syl not in cur:
            readings[ch] = cur + syl
    data = json.dumps(dict(sorted(readings.items())), ensure_ascii=False, separators=(",", ":"))
    js = NOTICE + "(function (root) {\n  root.KLyricHanjaReadings = " + data + ";\n  if (typeof module !== \"undefined\" && module.exports) module.exports = root.KLyricHanjaReadings;\n})(typeof globalThis !== \"undefined\" ? globalThis : self);\n"
    OUT.write_text(js, encoding="utf-8", newline="\n")
    print(f"{len(readings)} kanji -> {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main(sys.argv[1])

import re
from pathlib import Path

FILES = [
    Path("app/admin/crm-dashboard.tsx"),
    Path("app/admin/ai-dispatcher.tsx"),
]

def bad_score(s):
    markers = [
        "�", " ", " ", "Ў", "Ѓ", "’", "“",
        "џ", "ќ", "љ", "Ў", "І", "ў",
        "вЂ", "СЃ", "СЂ", "С‚", "СЏ", "СЋ", "С‡",
        "??"
    ]
    return sum(s.count(x) for x in markers)

def repair_piece(s):
    current = s

    for _ in range(3):
        try:
            candidate = current.encode("cp1251").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            break

        if bad_score(candidate) >= bad_score(current):
            break

        current = candidate

    return current

def repair_text(text):
    # JSX/TSX strings and JSX text.
    pattern = re.compile(
        r'"([^"\\]*(?:\\.[^"\\]*)*)"'
        r"|'([^'\\]*(?:\\.[^'\\]*)*)'"
        r"|>([^<>]+)<"
    )

    def repl(m):
        if m.group(1) is not None:
            original = m.group(1)
            fixed = repair_piece(original)
            return '"' + fixed + '"'

        if m.group(2) is not None:
            original = m.group(2)
            fixed = repair_piece(original)
            return "'" + fixed + "'"

        original = m.group(3)
        fixed = repair_piece(original)
        return ">" + fixed + "<"

    return pattern.sub(repl, text)

for path in FILES:
    if not path.exists():
        print(" :", path)
        continue

    backup = path.with_suffix(path.suffix + ".before-mojibake-fix")
    backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")

    text = path.read_text(encoding="utf-8")
    fixed = repair_text(text)

    path.write_text(fixed, encoding="utf-8")

    print("С:", path)
    print(":", backup)

"""Export PPTX slides to PNG images using PowerPoint COM (Windows)."""
import os
import sys
import win32com.client

BASE = os.path.join(os.path.dirname(__file__), "..", "docs", "presentations")
DECKS = [
    "X-Market-Sui-Overview.en.pptx",
    "X-Market-Sui-Overview.zh.pptx",
]


def export_deck(app, deck_name: str) -> int:
    pptx_path = os.path.abspath(os.path.join(BASE, deck_name))
    stem = os.path.splitext(deck_name)[0]
    out_dir = os.path.abspath(os.path.join(BASE, "slides", stem))
    os.makedirs(out_dir, exist_ok=True)

    pres = app.Presentations.Open(pptx_path, WithWindow=False)
    count = pres.Slides.Count
    print(f"Exporting {deck_name}: {count} slides -> {out_dir}")

    for i in range(1, count + 1):
        out_path = os.path.join(out_dir, f"slide-{i:02d}.png")
        pres.Slides(i).Export(out_path, "PNG", 1920, 1080)

    pres.Close()
    print(f"Done {deck_name}")
    return count


def main() -> None:
    decks = DECKS
    if len(sys.argv) > 1:
        decks = sys.argv[1:]

    app = win32com.client.Dispatch("PowerPoint.Application")
    app.Visible = 1

    total = 0
    for deck in decks:
        total += export_deck(app, deck)

    app.Quit()
    print(f"Exported {total} slides total")


if __name__ == "__main__":
    main()

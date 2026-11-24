from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect x="4" y="4" width="56" height="56" rx="12" fill="#202328"/>
  <rect x="13" y="40" width="38" height="5.5" rx="2.75" fill="#dfe2e6"/>
  <rect x="18" y="48.5" width="28" height="4" rx="2" fill="#6d8cb5"/>
  <path d="M26 32V16.5L43 13V28" stroke="#dfe2e6" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="22" cy="32.5" r="4.5" fill="#6d8cb5" stroke="#dfe2e6" stroke-width="2"/>
  <circle cx="39" cy="28.5" r="4.5" fill="#6d8cb5" stroke="#dfe2e6" stroke-width="2"/>
</svg>
"""


def render_png(size: int) -> Image.Image:
    scale = max(4, 256 // size)
    hi = size * scale
    img = Image.new("RGBA", (hi, hi), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def p(v: float) -> int:
        return round(hi * (v / 64.0))

    d.rounded_rectangle([p(4), p(4), p(60), p(60)], radius=p(12), fill="#202328")
    # Two subtitle lines at bottom
    d.rounded_rectangle([p(13), p(40), p(51), p(45.5)], radius=p(2.75), fill="#dfe2e6")
    d.rounded_rectangle([p(18), p(48.5), p(46), p(52.5)], radius=p(2), fill="#6d8cb5")

    # Music note stems and beam
    stroke_w = max(2, p(3.4))
    d.line([(p(26), p(32)), (p(26), p(16.5)), (p(43), p(13)), (p(43), p(28))], fill="#dfe2e6", width=stroke_w, joint="curve")

    # Note heads
    outline_w = max(1, p(2))
    d.ellipse([p(17.5), p(28), p(26.5), p(37)], fill="#6d8cb5", outline="#dfe2e6", width=outline_w)
    d.ellipse([p(34.5), p(24), p(43.5), p(33)], fill="#6d8cb5", outline="#dfe2e6", width=outline_w)

    return img.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    (ICONS_DIR / "icon.svg").write_text(SVG, encoding="utf-8")
    for s in (16, 48, 128):
        render_png(s).save(ICONS_DIR / f"{s}.png")


if __name__ == "__main__":
    main()

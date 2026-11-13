# Makes src/fonts/ub-cyrillic-*: Montserrat Cyrillic cut at the exact weights whose stroke thickness matches
# Poppins, so Mongolian and English read as one weight. Plain Montserrat is 10-20% thinner at the same number.
#   python scripts/make-cyrillic-fonts.py <folder with @fontsource-variable/montserrat "files"> [out folder]
# Needs: pip install fonttools brotli
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

src = Path(sys.argv[1])
out = Path(sys.argv[2] if len(sys.argv) > 2 else "src/fonts")
out.mkdir(parents=True, exist_ok=True)

# CSS weight -> Montserrat wght, from measured stems at 400px (Poppins 36/46/56/68; Montserrat 400-800 29/39/51/64/78).
WEIGHTS = {400: 470, 500: 558, 600: 638, 700: 729}

for subset in ("cyrillic", "cyrillic-ext"):
    for css, wght in WEIGHTS.items():
        font = TTFont(src / f"montserrat-{subset}-wght-normal.woff2")
        static = instancer.instantiateVariableFont(font, {"wght": wght})
        static.flavor = "woff2"
        target = out / f"ub-{subset}-{css}.woff2"
        static.save(target)
        print(target, target.stat().st_size)

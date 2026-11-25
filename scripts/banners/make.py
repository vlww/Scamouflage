#!/usr/bin/env python3
"""Section banners for the README (animated SVG) and Devpost (rendered to GIF by render-gifs.mjs).

Draws a seamless woodland-style camouflage tile from layered, irregular blobs and scrolls it
right-to-left behind a title set in Russo One (embedded, so the SVG renders anywhere as an <img>).

    python3 scripts/banners/make.py        # writes docs/banners/*.svg
"""
import base64, json, math, os, random

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'docs', 'banners')
FONT = os.path.join(ROOT, 'node_modules/@fontsource/russo-one/files/russo-one-latin-400-normal.woff2')
ICON = os.path.join(ROOT, 'public/icons/icon128.png')

W_TILE, H_TILE = 560, 280      # seamless in both directions
SPEED = 28                     # px per second (right to left)
WIDTH = 1200

# Dark woodland palette: base, then layers painted on top (largest first).
BASE = '#26301b'
LAYERS = [  # color, count, min r, max r, stretch, jitter
    ('#3a4527', 15, 34, 70, 1.9, 0.38),   # olive
    ('#4a3c25', 14, 28, 58, 2.1, 0.42),   # brown
    ('#1a2213', 16, 22, 50, 2.3, 0.45),   # deep green
    ('#0d100a', 22, 9, 24, 2.8, 0.50),    # black "branches"
]


def blob(rng, cx, cy, r, stretch, jitter, angle):
    """An irregular closed shape: a jittered polygon smoothed with Catmull-Rom splines."""
    n = rng.randint(9, 14)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-0.25, 0.25)
        rr = r * (1 + rng.uniform(-jitter, jitter))
        x, y = math.cos(a) * rr * stretch, math.sin(a) * rr
        # occasional lobe or notch, for a torn-leaf woodland edge
        if rng.random() < 0.22:
            k = rng.uniform(1.25, 1.6) if rng.random() < 0.6 else rng.uniform(0.55, 0.75)
            x, y = x * k, y * k
        ca, sa = math.cos(angle), math.sin(angle)
        pts.append((cx + x * ca - y * sa, cy + x * sa + y * ca))
    d = []
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        if i == 0:
            d.append(f'M{p1[0]:.1f} {p1[1]:.1f}')
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}')
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return ''.join(d) + 'Z', (min(xs), min(ys), max(xs), max(ys))


def camo_tile(seed=7):
    rng = random.Random(seed)
    groups = []
    for color, count, rmin, rmax, stretch, jitter in LAYERS:
        paths = []
        for _ in range(count):
            cx, cy = rng.uniform(0, W_TILE), rng.uniform(0, H_TILE)
            r = rng.uniform(rmin, rmax)
            angle = rng.uniform(-0.5, 0.5)  # mostly horizontal, like woodland pattern
            d, (x0, y0, x1, y1) = blob(rng, cx, cy, r, stretch, jitter, angle)
            # Repeat across tile edges so the tile wraps seamlessly.
            for dx in (-W_TILE, 0, W_TILE):
                for dy in (-H_TILE, 0, H_TILE):
                    if x1 + dx < 0 or x0 + dx > W_TILE or y1 + dy < 0 or y0 + dy > H_TILE:
                        continue
                    paths.append(f'<path transform="translate({dx} {dy})" d="{d}"/>' if dx or dy else f'<path d="{d}"/>')
        groups.append(f'<g fill="{color}">{"".join(paths)}</g>')
    return f'<rect width="{W_TILE}" height="{H_TILE}" fill="{BASE}"/>' + ''.join(groups)


def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def banner(title, kicker=None, height=150, hero=False, accent_first=None):
    """title: text in Russo One. accent_first: number of leading characters drawn in the accent color."""
    tiles_x = math.ceil(WIDTH / W_TILE) + 1
    tiles_y = math.ceil(height / H_TILE)
    loop = W_TILE / SPEED
    font = b64(FONT)
    uses = ''.join(f'<use href="#tile" x="{i * W_TILE}" y="{j * H_TILE}"/>' for i in range(tiles_x) for j in range(tiles_y))
    if hero:
        size = 84
        icon = f'<image href="data:image/png;base64,{b64(ICON)}" x="56" y="{height / 2 - 64}" width="112" height="112"/>'
        tx = 196
        ty = height / 2 + 14
        sub_y = ty + 48
    else:
        size = 46 if len(title) < 26 else 40
        icon = ''
        tx = 56
        ty = height / 2 + (26 if kicker else 16)
        sub_y = None
    if accent_first:
        t = f'<tspan fill="#f6f1dc">{esc(title[:accent_first])}</tspan><tspan fill="#d8c99a">{esc(title[accent_first:])}</tspan>'
    else:
        t = esc(title)
    kick = ''
    if kicker and not hero:
        kick = f'<text x="{tx + 2}" y="{ty - size - 4}" class="k">{esc(kicker.upper())}</text>'
    sub = f'<text x="{tx + 2}" y="{sub_y}" class="s">{esc(kicker)}</text>' if hero and kicker else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{height}" viewBox="0 0 {WIDTH} {height}" role="img" aria-label="{esc(title)}">
<style>
@font-face {{ font-family: 'Russo One'; src: url(data:font/woff2;base64,{font}) format('woff2'); }}
.t {{ font-family: 'Russo One', 'Arial Black', sans-serif; font-size: {size}px; fill: #f6f1dc; letter-spacing: 0.5px; }}
.k {{ font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 2.5px; fill: #b5c98a; }}
.s {{ font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 600; fill: #e6dcbc; }}
.scroll {{ animation: scroll {loop:.2f}s linear infinite; }}
@keyframes scroll {{ from {{ transform: translateX(0); }} to {{ transform: translateX(-{W_TILE}px); }} }}
@media (prefers-reduced-motion: reduce) {{ .scroll {{ animation: none; }} }}
</style>
<defs>
<clipPath id="c"><rect width="{WIDTH}" height="{height}" rx="14"/></clipPath>
<g id="tile">{camo_tile()}</g>
<linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
<stop offset="0" stop-color="#0b0e08" stop-opacity="0.86"/>
<stop offset="0.55" stop-color="#0b0e08" stop-opacity="0.62"/>
<stop offset="1" stop-color="#0b0e08" stop-opacity="0.30"/>
</linearGradient>
</defs>
<g clip-path="url(#c)">
<g class="scroll">{uses}</g>
<rect width="{WIDTH}" height="{height}" fill="url(#shade)"/>
<rect x="0" y="{height - 4}" width="{WIDTH}" height="4" fill="#b5c98a" opacity="0.85"/>
{icon}
{kick}
<text x="{tx}" y="{ty}" class="t">{t}</text>
{sub}
</g>
</svg>
'''


# name: (title, kicker)
README = {
    'readme-hero': ('Scamouflage', 'Spot scams before they spot you.'),
    'readme-try': ('Try it in 60 seconds', 'Start here'),
    'readme-problem': ('The problem', 'Why this matters'),
    'readme-features': ('What it does', 'The product'),
    'readme-hybrid': ('Hybrid inference', 'Firebase AI Logic'),
    'readme-speed': ('Built for speed', 'Gemini Nano, measured'),
    'readme-privacy': ('Private by design', 'Your data'),
    'readme-firebase': ('The Firebase stack', 'Under the hood'),
    'readme-accuracy': ('Accuracy', 'Evaluation'),
    'readme-setup': ('Run it yourself', 'Setup'),
    'readme-judges': ('Testing guide', 'For judges'),
    'readme-project': ('Project facts', 'Hackathon, credits & license'),
}
DEVPOST = {
    'devpost-hero': ('Scamouflage', 'A private scam checker for the people scammers target most.'),
    'devpost-value': ('Value proposition', 'In one paragraph'),
    'devpost-inspiration': ('Inspiration', 'Why I built it'),
    'devpost-what': ('What it does', 'The product'),
    'devpost-ailogic': ('How I used Firebase AI Logic', 'Hybrid inference'),
    'devpost-how': ('How I built it', 'Engineering'),
    'devpost-design': ('Designing for a scared reader', 'Product design'),
    'devpost-impact': ('Potential impact', 'Real problem, real audience'),
    'devpost-challenges': ('Challenges', 'What fought back'),
    'devpost-accomplishments': ('Accomplishments', 'What I’m proud of'),
    'devpost-learned': ('What I learned', 'Takeaways'),
    'devpost-next': ("What's next", 'Roadmap'),
    'devpost-hackathon': ('Built during the hackathon', 'Disclosure'),
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for name, (title, kicker) in {**README, **DEVPOST}.items():
        hero = name.endswith('-hero')
        h = 280 if hero else 150
        svg = banner(title, kicker, height=h, hero=hero, accent_first=4 if hero else None)
        with open(os.path.join(OUT, name + '.svg'), 'w') as f:
            f.write(svg)
        meta[name] = {'height': h, 'loop': W_TILE / SPEED}
    with open(os.path.join(OUT, 'banners.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    print(f'{len(meta)} banners → docs/banners/')

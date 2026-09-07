# nonstopvibin — mirrorball logo (2b)

## Files

| File | Use |
| --- | --- |
| `mirrorball-mark-64.svg` | Mark, 4x4 facets. Default. 32px and up. |
| `mirrorball-mark-24.svg` | Mark, 3x3 facets. 20-31px (sidebar header, tray). |
| `mirrorball-mark-16.svg` | Mark, 2x2 facets. 16-19px (favicon, menu bar). |
| `mirrorball-mark-24-light-ground.svg` | Mark for light backgrounds. |
| `lockup-dark.svg` / `lockup-light.svg` | Mark + wordmark as one image. Only where HTML is not possible. |

Facet count drops as the mark gets smaller. Do not scale the 64px version down to 16px — the facets mud together.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| amber | `#E0A33F` | Mark base, primary accent (unchanged from the app) |
| amber light | `#F0BC63` | Facet highlight |
| amber pale | `#F5D08C` | Facet highlight, brightest |
| amber deep | `#C98A2E` | Facet shadow |
| magenta | `#E88AB8` | `VIBIN`, second accent, dark grounds only |
| magenta deep | `#A8306B` | `VIBIN` on light grounds (contrast) |
| ink | `#17150F` | Text on amber/magenta fills |
| paper | `#EAE5DC` | `NONSTOP` on dark grounds |
| ground | `#171614` – `#1C1A18` | App chrome |

Magenta and amber share the same lightness and chroma. If a third hue is ever needed, keep `oklch(0.75 0.13 H)` and change only H.

## Type

- `NONSTOP` — Space Grotesk 700, italic, letter-spacing `-0.01em`, uppercase.
- `VIBIN` — IBM Plex Mono 500, letter-spacing `0.3em` (add `padding-left` equal to the tracking so the block stays optically centered), uppercase, magenta.
- Wordmark is always `NONSTOP` then `VIBIN`, baseline-aligned, gap `6px` at 15px type.

## HTML lockup (preferred over the SVG)

```html
<span class="nv-logo">
  <span class="nv-ball" aria-hidden="true">
    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
  </span>
  <span class="nv-word">NONSTOP</span>
  <span class="nv-sub">VIBIN</span>
</span>
```

```css
.nv-logo { display: flex; align-items: center; gap: 8px; }

.nv-ball {
  width: 24px; height: 24px; flex: 0 0 auto;
  border-radius: 50%; overflow: hidden; background: #E0A33F;
  display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr);
  gap: 1.5px; padding: 1.5px;
}
.nv-ball i { display: block; }
.nv-ball i:nth-child(1) { background: #F0BC63; }
.nv-ball i:nth-child(2) { background: #E88AB8; }
.nv-ball i:nth-child(3) { background: #E0A33F; }
.nv-ball i:nth-child(4) { background: #E0A33F; }
.nv-ball i:nth-child(5) { background: #F5D08C; }
.nv-ball i:nth-child(6) { background: #C98A2E; }
.nv-ball i:nth-child(7) { background: #E88AB8; }
.nv-ball i:nth-child(8) { background: #E0A33F; }
.nv-ball i:nth-child(9) { background: #F0BC63; }

.nv-word {
  font: italic 700 15px/1 "Space Grotesk", "Helvetica Neue", sans-serif;
  letter-spacing: -0.01em; color: #EAE5DC;
}
.nv-sub {
  font: 500 8.5px/1 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: 0.3em; padding-left: 0.3em; color: #E88AB8;
}
```

## Spin = proxy state

The ball is also the status light. Bind the animation to proxy state, never run it decoratively.

```css
@keyframes nv-spin { to { transform: rotate(360deg); } }

.nv-ball[data-state="running"] { animation: nv-spin 6s linear infinite; }
.nv-ball[data-state="paused"]   { animation: nv-spin 6s linear infinite; animation-play-state: paused; }
.nv-ball[data-state="stopped"]  { filter: grayscale(1); opacity: .55; }

@media (prefers-reduced-motion: reduce) {
  .nv-ball[data-state="running"] { animation: none; }
}
```

- `running` — 6s per turn, linear, never faster. It should read as a slow room light, not a spinner.
- `paused` — proxy on, no traffic. Frozen mid-rotation.
- `stopped` — proxy off. Desaturated.

## Clear space and don'ts

- Clear space on all sides: half the mark's diameter.
- Minimum lockup width: 96px. Below that use the mark alone.
- Never put the mark on a mid-tone background — it needs `#171614`–`#1C1A18` or `#EAE5DC`.
- Never add a gradient, glow, or drop shadow. The facets carry the shine.
- Never re-letter `VIBIN` in the display face or set `NONSTOP` upright.
- Never rotate the wordmark with the ball.

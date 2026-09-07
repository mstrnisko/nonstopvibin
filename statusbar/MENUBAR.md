# nonstopvibin — menu bar & tray

The mirrorball is the status item. It **spins** (5s per turn) and its facets **sweep** through four hues while requests are flowing. Three states, nothing blinks.

| State | Look | Meaning |
| --- | --- | --- |
| `streaming` | spinning, facets sweeping | proxy up, traffic flowing |
| `idle` | still, facets held on one palette offset | proxy up, no traffic |
| `stopped` | grey facets (color trays) or bare ring (template) | proxy down |

Never speed the spin above 5s per turn — it starts reading as a progress spinner. No pulse, no glow, no blink.

## Files

| File | Target | Notes |
| --- | --- | --- |
| `macos-color-dark-bar.svg` | macOS, dark menu bar | full color, 18×18pt |
| `macos-color-light-bar.svg` | macOS, light menu bar | full color, 18×18pt |
| `macos-template.svg` | macOS, template mode | black + alpha, auto-inverts |
| `macos-template-stopped.svg` | macOS, template mode | stopped state |
| `gnome-symbolic-16.svg` | GNOME top bar | one flat fill, 16px |
| `tray-22.svg`, `tray-24.svg` | KDE / SNI / Windows | full color |
| `tray-24-stopped.svg` | KDE / SNI / Windows | stopped state |
| `frames-color-dark/spin-00…11.svg` | macOS dark, animation | 12 frames, 30° apart |
| `frames-color-light/spin-00…11.svg` | macOS light, animation | 12 frames |
| `frames-template/spin-00…11.svg` | macOS template, animation | 12 frames, mono |

Each frame advances rotation by 30° **and** the palette by one hue, so playing the 12 frames in a loop gives the spin and the sweep from one timer.

## Facet count is size-dependent

- **≥ 22px** — 3×3 facets (`tray-22`, `tray-24`).
- **18px** — 3×3 in full color only. In monochrome, 3×3 muds together: use the 2×2 seam cut (`macos-template.svg`).
- **≤ 16px** — 2×2 seam cut everywhere.

Do not downscale the 24px asset to 16px.

## Palette

```
amber    #E0A33F   oklch(.75 .13  70)   Claude
magenta  #E88AB8   oklch(.75 .13 350)   alert / VIBIN
teal     #58C6C0   oklch(.75 .13 195)   Codex
violet   #B79BEA   oklch(.75 .13 295)   Gemini

base ring (dark bar)  #6E4A1C
base ring (light bar) #B4762A
stopped               #6B655C / #4A453E / #7C746A on #2A2724 at 60%
```

## Animation timing

```
spin        5000ms / 360°       → 12 frames @ 417ms
sweep       ~1700ms / full cycle (falls out of the same 12 frames)
under load  play frames @ 300ms (spin 3.6s, sweep 1.2s)
idle        stop the timer, hold the current frame
stopped     swap to the stopped asset, no timer
```

Stop the timer whenever the window is hidden or the machine is on battery saver, and respect reduced motion:

- macOS — `NSWorkspace.shared.accessibilityDisplayShouldReduceMotion`
- GNOME — `org.gnome.desktop.interface enable-animations`
- Windows — `SystemParametersInfo(SPI_GETCLIENTAREAANIMATION)`

When reduced motion is on, hold the idle frame permanently.

## macOS

18×18pt. Export each SVG to PNG at @1x/@2x/@3x (`resvg -w 18`, `36`, `54`).

```swift
let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

// Template mode (auto-inverts, monochrome):
let img = NSImage(named: "nv-template")!
img.isTemplate = true
item.button?.image = img

// Full color: isTemplate = false, and pick the asset from the bar appearance.
// Observe AppleInterfaceThemeChangedNotification and swap dark-bar / light-bar.
```

Animate by swapping `item.button?.image` from a `Timer` on the main run loop. Do not use `NSImage` animated GIF — it ignores the appearance change.

If the user has "Reduce transparency" or a tinted menu bar, full color can clash. Ship a preference: **Menu bar icon → Color / Monochrome**, defaulting to Color.

## GNOME

Symbolic icon, 16px, one fill. Install to `${prefix}/share/icons/hicolor/symbolic/apps/` as `nonstopvibin-symbolic.svg`. The shell recolors it, so the sweep is not available there — GNOME gets spin only (or nothing under `enable-animations=false`). Use `libappindicator` / `ayatana-appindicator` and set the icon by name, not by path, so themes can override it.

## KDE, other StatusNotifierItem trays, Windows

Full color, no restrictions. KDE panels commonly render 22px or 24px. For Windows build a multi-size `.ico` (16, 20, 24, 32) and swap `Shell_NotifyIcon` on the same timer.

## Tauri / Electron

```js
// Electron
const frames = [...Array(12)].map((_, i) =>
  nativeImage.createFromPath(path.join(dir, `spin-${String(i).padStart(2,'0')}.png`)));
frames.forEach(f => f.setTemplateImage(useTemplate));

let i = 0, timer = null;
function setState(state) {
  clearInterval(timer); timer = null;
  if (state === 'stopped') return tray.setImage(stoppedImage);
  if (state === 'idle')    return tray.setImage(frames[i]);
  timer = setInterval(() => { i = (i + 1) % frames.length; tray.setImage(frames[i]); }, 417);
}
```

```rust
// Tauri v2
app.tray_by_id("main").unwrap().set_icon(Some(Image::from_bytes(&frame_png)?))?;
```

## Tooltip and menu

Tooltip: `nonstopvibin — eag · 62% headroom`.

Dropdown header carries the 26px color ball, the `NONSTOP VIBIN` lockup, and `profile · routing · N subs`. Then one row per provider, each with its own hue and a headroom bar, then Pause / Open / Switch profile / Quit. Footer line: `LIVING NONSTOP` left, `1987 — ∞` right. Colors in the dropdown are unrestricted on every platform.

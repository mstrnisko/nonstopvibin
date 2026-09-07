import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SquareTerminal } from "lucide-react";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("public/tray", { recursive: true });
await writeFile(
  "public/providers/opencode.svg",
  renderToStaticMarkup(
    createElement(SquareTerminal, {
      size: 32,
      color: "#242e28",
      strokeWidth: 1.6,
    }),
  ),
);
const render = (file, size) =>
  sharp(file, { density: 1200 }).resize(size, size).png().toBuffer();

// App icon: mirrorball mark on the dark ground (mirrorball/README.md).
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#171614" },
})
  .composite([
    {
      input: await render("mirrorball/mirrorball-mark-64.svg", 310),
      gravity: "centre",
    },
  ])
  .png()
  .toFile("public/icon.png");

// Menu bar / tray frames (statusbar/MENUBAR.md). macOS: 18pt full color at
// @1x/@2x, one set per bar appearance. Linux trays: 22px full color.
const frame = (i) => `spin-${String(i).padStart(2, "0")}.svg`;
const sets = [
  ["mac-dark", "frames-color-dark", 18, true],
  ["mac-light", "frames-color-light", 18, true],
  ["linux", "frames-color-dark", 22, false],
];
for (const [name, dir, size, retina] of sets) {
  for (let i = 0; i < 12; i++) {
    const id = String(i).padStart(2, "0");
    await writeFile(
      `public/tray/${name}-${id}.png`,
      await render(`statusbar/${dir}/${frame(i)}`, size),
    );
    if (retina)
      await writeFile(
        `public/tray/${name}-${id}@2x.png`,
        await render(`statusbar/${dir}/${frame(i)}`, size * 2),
      );
  }
  await writeFile(
    `public/tray/${name}-stopped.png`,
    await render("statusbar/tray-24-stopped.svg", size),
  );
  if (retina)
    await writeFile(
      `public/tray/${name}-stopped@2x.png`,
      await render("statusbar/tray-24-stopped.svg", size * 2),
    );
}

// Ship ICNS directly: electron-builder's WASM icon converter hangs under Bun.
const frames = await Promise.all(
  [
    ["icp4", 16],
    ["icp5", 32],
    ["icp6", 64],
    ["ic07", 128],
    ["ic08", 256],
    ["ic09", 512],
    ["ic11", 32],
    ["ic12", 64],
    ["ic13", 512],
  ].map(async ([type, size]) => {
    const png = await sharp("public/icon.png")
      .resize(size, size)
      .png()
      .toBuffer();
    const header = Buffer.alloc(8);
    header.write(type);
    header.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([header, png]);
  }),
);
const header = Buffer.alloc(8);
header.write("icns");
header.writeUInt32BE(
  8 + frames.reduce((size, frame) => size + frame.length, 0),
  4,
);
await writeFile("public/icon.icns", Buffer.concat([header, ...frames]));

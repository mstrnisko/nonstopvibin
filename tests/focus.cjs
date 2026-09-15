// Run with `bun tests/focus.cjs` (isolated Electron renderer).
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const electron = require("electron");

if (typeof electron === "string") {
  const directory = mkdtempSync(join(tmpdir(), "nv-focus-"));
  require("esbuild").buildSync({
    entryPoints: [resolve(__dirname, "../src/client/focus.ts")],
    bundle: true,
    format: "esm",
    outfile: join(directory, "focus.js"),
  });
  const css = ["styles", "tray", "connect", "activity"]
    .map((name) =>
      readFileSync(resolve(__dirname, `../src/client/${name}.css`), "utf8"),
    )
    .join("\n");
  writeFileSync(
    join(directory, "index.html"),
    `<style>${css}</style>
    <button id="first">Refresh</button>
    <details><summary class="tray-profile">Profile</summary>Quota</details>
    <details><summary class="tray-account-summary">Account</summary>Quota</details>
    <div class="agent-tabs"><button>Agent</button></div>
    <div class="activity-page"><details><summary>Activity</summary></details></div>
    <input aria-label="Profile name">
    <div class="select-item" tabindex="0" data-highlighted>Option</div>
    <input type="checkbox" aria-label="Enabled">
    <script type="module" src="focus.js"></script>`,
  );
  const child = require("node:child_process").spawn(
    electron,
    [__filename, directory, "--headless"],
    { stdio: "inherit" },
  );
  child.on("exit", (code) => {
    rmSync(directory, { recursive: true, force: true });
    process.exitCode = code ?? 1;
  });
} else {
  const { app, BrowserWindow } = electron;
  app.setPath("userData", process.argv[2]);
  app.whenReady().then(async () => {
    const window = new BrowserWindow({ show: false });
    const timeout = setTimeout(() => app.exit(1), 15000);
    try {
      await window.loadFile(join(process.argv[2], "index.html"));
      const contents = window.webContents;
      contents.debugger.attach("1.3");
      await contents.debugger.sendCommand(
        "Emulation.setFocusEmulationEnabled",
        { enabled: true },
      );
      const run = (script) => contents.executeJavaScript(script);
      const outline = () =>
        run("getComputedStyle(document.activeElement).outlineStyle");
      const key = async (value, code) => {
        await contents.debugger.sendCommand("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: value,
          text: value === "Enter" ? "\r" : "",
          windowsVirtualKeyCode: code,
        });
        await contents.debugger.sendCommand("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: value,
          windowsVirtualKeyCode: code,
        });
      };
      await run("document.querySelector('#first').focus()");
      assert.equal(
        await outline(),
        "none",
        "activation/autofocus does not paint a button ring",
      );
      await key("Tab", 9);
      assert.equal(
        await run("document.activeElement.className"),
        "tray-profile",
      );
      assert.equal(
        await outline(),
        "solid",
        "Tab shows the row focus indicator",
      );
      assert.equal(
        await run("getComputedStyle(document.activeElement).boxShadow"),
        "none",
        "only one ring",
      );
      assert.equal(
        await run("getComputedStyle(document.activeElement).outlineOffset"),
        "-3px",
        "tray ring stays inside the scroll area",
      );
      await key("Enter", 13);
      assert.equal(
        await run("document.querySelector('details').open"),
        true,
        "keyboard disclosure still works",
      );
      for (const selector of [
        ".tray-account-summary",
        ".agent-tabs button",
        ".activity-page summary",
      ]) {
        await run(`document.querySelector('${selector}').focus()`);
        assert.equal(
          await outline(),
          "solid",
          `${selector} has keyboard focus`,
        );
        assert.equal(
          await run("getComputedStyle(document.activeElement).boxShadow"),
          "none",
        );
      }
      await run("window.dispatchEvent(new Event('blur'))");
      assert.equal(await outline(), "none", "deactivation clears stale rings");
      await key("Tab", 9);
      assert.equal(
        await outline(),
        "solid",
        "keyboard navigation resumes after activation",
      );
      await run("document.querySelector('#first').focus()");
      const point = await run(
        "(() => { const r = document.querySelector('#first').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()",
      );
      await contents.debugger.sendCommand("Input.dispatchMouseEvent", {
        type: "mousePressed",
        button: "left",
        clickCount: 1,
        ...point,
      });
      await contents.debugger.sendCommand("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        button: "left",
        clickCount: 1,
        ...point,
      });
      assert.equal(
        await outline(),
        "none",
        "mouse use clears even existing keyboard rings",
      );
      await run("document.querySelector('.tray-profile').focus()");
      assert.equal(
        await outline(),
        "none",
        "focus restoration after a mouse action stays quiet",
      );
      await run("document.querySelector('input[type=checkbox]').focus()");
      assert.equal(
        await outline(),
        "none",
        "switches stay quiet after mouse use",
      );
      await run("document.querySelector('input').focus()");
      assert.equal(
        await outline(),
        "solid",
        "text fields retain an editing indicator",
      );
      await key("Tab", 9);
      assert.equal(
        await run("document.activeElement.className"),
        "select-item",
      );
      assert.equal(
        await outline(),
        "none",
        "select options use their highlighted row instead of a ring",
      );
      await contents.debugger.sendCommand("Emulation.setEmulatedMedia", {
        features: [{ name: "forced-colors", value: "active" }],
      });
      await run("document.querySelector('#first').focus()");
      assert.equal(
        await outline(),
        "solid",
        "keyboard outline survives forced colors",
      );
      console.log(
        "Focus checks passed: keyboard, mouse, restoration, text fields, disclosures, menus, forced colors.",
      );
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      clearTimeout(timeout);
      window.destroy();
      app.exit(process.exitCode || 0);
    }
  });
}

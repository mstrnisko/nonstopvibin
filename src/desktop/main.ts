import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  safeStorage,
  screen,
  shell,
  systemPreferences,
  Tray,
  type IpcMainInvokeEvent,
} from "electron";
import { join, resolve } from "node:path";
import { z } from "zod";
import { Application } from "../server/server.ts";
import type { SecretCodec } from "../server/vault.ts";
import { linuxLoginItem, setLinuxLoginItem } from "./autostart.ts";

app.setName("nonstopvibin");
if (process.env.NONSTOPVIBIN_DATA_DIR)
  app.setPath("userData", resolve(process.env.NONSTOPVIBIN_DATA_DIR));
let application: Application;
let mainWindow: BrowserWindow;
let trayWindow: BrowserWindow;
let tray: Tray;
let quitting = false;
const userData = app.getPath("userData");
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on("second-instance", () => {
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.on("activate", () => {
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.on("window-all-closed", () => {
    /* The menu bar and proxy intentionally continue until Quit. */
  });
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    if (application)
      application.close().then(
        () => app.exit(0),
        (error) => {
          dialog.showErrorBox("Could not shut down cleanly", String(error));
          app.exit(1);
        },
      );
    else app.exit(0);
  });
  void app
    .whenReady()
    .then(start)
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`nonstopvibin could not start: ${message}`);
      dialog.showErrorBox("nonstopvibin could not start", message);
      app.quit();
    });
}
const externalHosts = new Set([
  "auth.openai.com",
  "chatgpt.com",
  "claude.ai",
  "console.anthropic.com",
  "platform.claude.com",
  "accounts.google.com",
  "auth.kimi.com",
  "www.kimi.com",
  "kimi.com",
  "accounts.x.ai",
  "auth.x.ai",
  "grok.com",
  "accounts.xai.com",
  "opencode.ai",
]);
function safeExternal(raw: string): string {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !externalHosts.has(url.hostname)
  )
    throw new Error(
      "This external URL is not an approved provider sign-in page.",
    );
  return url.href;
}
async function showMain(profileId?: string) {
  if (profileId) {
    application.store.profile(profileId);
    await mainWindow.loadURL(
      `${application.origin}/?profile=${encodeURIComponent(profileId)}`,
    );
  }
  trayWindow.hide();
  mainWindow.show();
  mainWindow.focus();
}
function assertSender(event: IpcMainInvokeEvent): void {
  const sender = event.senderFrame;
  if (
    !sender ||
    sender !== event.sender.mainFrame ||
    new URL(sender.url).origin !== application.origin ||
    ![mainWindow.webContents.id, trayWindow.webContents.id].includes(
      event.sender.id,
    )
  )
    throw new Error("Untrusted desktop request.");
}
async function start(): Promise<void> {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text")
  )
    throw new Error(
      "A system credential store is required. On Linux, enable GNOME Keyring or KWallet, then reopen nonstopvibin.",
    );
  const codec: SecretCodec = {
    label:
      process.platform === "darwin"
        ? "macOS Keychain"
        : "System secret service",
    encrypt: (value) => safeStorage.encryptString(value).toString("base64"),
    decrypt: (value) => safeStorage.decryptString(Buffer.from(value, "base64")),
  };
  const root = app.getAppPath();
  application = await Application.create({
    directory: userData,
    binary: app.isPackaged
      ? join(process.resourcesPath, "core/cli-proxy-api")
      : join(root, ".vendor/core/cli-proxy-api"),
    clientDirectory: join(root, "dist/client"),
    port: Number(process.env.NONSTOPVIBIN_PORT || 4318),
    codec,
    desktop: true,
  });
  // The UI is dark-only; force the app appearance so native popups (select
  // menus, dialogs) match instead of following a light OS theme.
  nativeTheme.themeSource = "dark";
  const webPreferences = {
    preload: join(__dirname, "preload.cjs"),
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    devTools: !app.isPackaged,
  };
  mainWindow = new BrowserWindow({
    title: "nonstopvibin",
    width: 1240,
    height: 880,
    minWidth: 740,
    minHeight: 580,
    backgroundColor: "#1c1b18",
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 21, y: 17 },
    icon: join(root, "dist/client/icon.png"),
    webPreferences,
  });
  trayWindow = new BrowserWindow({
    title: "nonstopvibin quotas",
    width: 386,
    height: 640,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: "#1c1b18",
    webPreferences,
  });
  for (const window of [mainWindow, trayWindow]) {
    window.webContents.session.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    window.webContents.setWindowOpenHandler(({ url }) => {
      try {
        void shell
          .openExternal(safeExternal(url))
          .catch((error) => application.core.report(String(error)));
      } catch (error) {
        application.core.report(
          error instanceof Error
            ? error.message
            : "Blocked external navigation.",
        );
      }
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      if (!URL.canParse(url) || new URL(url).origin !== application.origin)
        event.preventDefault();
    });
  }
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  trayWindow.on("blur", () => {
    if (!quitting && !trayWindow.isDestroyed()) trayWindow.hide();
  });
  ipcMain.handle("nv:bootstrap", (event) => {
    assertSender(event);
    return { token: application.token, desktop: true };
  });
  // Every privileged handler with a payload validates its sender, then its argument.
  function handle<T, R>(
    channel: string,
    schema: z.ZodType<T>,
    run: (value: T) => R,
  ): void {
    ipcMain.handle(channel, (event, argument) => {
      assertSender(event);
      return run(schema.parse(argument));
    });
  }
  handle("nv:open-external", z.string().max(20_000), (url) =>
    shell.openExternal(safeExternal(url)),
  );
  handle("nv:copy", z.string().max(1_000_000), (text) =>
    clipboard.writeText(text),
  );
  handle("nv:show-window", z.string().uuid().optional(), showMain);
  handle("nv:login-item", z.boolean(), (value) => {
    if (!app.isPackaged)
      throw new Error("Use the packaged app to enable automatic startup.");
    if (process.platform === "linux")
      return setLinuxLoginItem(
        app.getPath("appData"),
        process.env.APPIMAGE || process.execPath,
        value,
      );
    app.setLoginItemSettings({ openAtLogin: value });
    const actual = app.getLoginItemSettings().openAtLogin;
    if (actual !== value)
      throw new Error(
        "macOS did not apply this setting. Add nonstopvibin in System Settings → General → Login Items.",
      );
    return actual;
  });
  ipcMain.handle("nv:get-login-item", (event) => {
    assertSender(event);
    return process.platform === "linux"
      ? linuxLoginItem(app.getPath("appData"))
      : app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle("nv:reveal-data", (event) => {
    assertSender(event);
    shell.showItemInFolder(join(userData, "nonstopvibin.sqlite"));
  });
  ipcMain.handle("nv:choose-project", async (event) => {
    assertSender(event);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Connect Claude Code in a project",
      properties: ["openDirectory"],
      buttonLabel: "Choose project",
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  // Mirrorball status item (statusbar/MENUBAR.md): spins while requests flow,
  // holds a frame while idle, swaps to the stopped asset when no proxy runs.
  // Full color; on macOS the set follows the bar appearance. themeSource is
  // forced dark above, so read the real OS setting instead of nativeTheme.
  const traySet = () =>
    process.platform === "darwin"
      ? systemPreferences.getUserDefault("AppleInterfaceStyle", "string") ===
        "Dark"
        ? "mac-dark"
        : "mac-light"
      : "linux";
  const trayImage = (name: string) =>
    nativeImage.createFromPath(
      join(root, `dist/client/tray/${traySet()}-${name}.png`),
    );
  let frames = Array.from({ length: 12 }, (_, i) =>
    trayImage(String(i).padStart(2, "0")),
  );
  let stoppedImage = trayImage("stopped");
  tray = new Tray(stoppedImage);
  tray.setToolTip("nonstopvibin · proxy off");
  let frame = 0;
  let trayState = "";
  let spinner: ReturnType<typeof setInterval> | undefined;
  const reducedMotion = () =>
    process.platform !== "linux" &&
    systemPreferences.getAnimationSettings().prefersReducedMotion;
  const syncTray = () => {
    const running = application.store
      .profiles()
      .filter((p) => application.core.runtimes.get(p.id)?.state === "running");
    const streaming = running.some(
      (p) => (application.gateway.active.get(p.id) ?? 0) > 0,
    );
    const state = !running.length
      ? "stopped"
      : streaming && !reducedMotion()
        ? "streaming"
        : "idle";
    const names = running.map((p) => p.name).join(", ");
    tray.setToolTip(
      state === "stopped"
        ? "nonstopvibin · proxy off"
        : `nonstopvibin — ${names} · ${streaming ? "streaming" : "idle"}`,
    );
    if (state === trayState) return;
    trayState = state;
    clearInterval(spinner);
    spinner = undefined;
    if (state === "stopped") tray.setImage(stoppedImage);
    else if (state === "idle") tray.setImage(frames[frame]);
    else
      spinner = setInterval(() => {
        frame = (frame + 1) % frames.length;
        tray.setImage(frames[frame]);
      }, 417);
  };
  setInterval(syncTray, 1000);
  nativeTheme.on("updated", () => {
    frames = frames.map((_, i) => trayImage(String(i).padStart(2, "0")));
    stoppedImage = trayImage("stopped");
    trayState = "";
    syncTray();
  });
  const openTray = () => {
    if (trayWindow.isVisible()) {
      trayWindow.hide();
      return;
    }
    const bounds = tray.getBounds();
    const display = screen.getDisplayMatching(bounds).workArea;
    const height = Math.min(640, display.height - 24);
    const x = Math.max(
      display.x + 8,
      Math.min(
        bounds.x + bounds.width / 2 - 193,
        display.x + display.width - 394,
      ),
    );
    trayWindow.setBounds({
      x: Math.round(x),
      y: Math.round(
        process.platform === "darwin"
          ? bounds.y + bounds.height + 7
          : display.y + display.height - height - 8,
      ),
      width: 386,
      height,
    });
    trayWindow.show();
    trayWindow.focus();
  };
  tray.on("click", openTray);
  tray.on("right-click", () =>
    tray.popUpContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Open nonstopvibin",
          click: () => {
            void showMain();
          },
        },
        { label: "Subscription quotas", click: openTray },
        { type: "separator" },
        { label: "Quit nonstopvibin", click: () => app.quit() },
      ]),
    ),
  );
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "nonstopvibin",
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          {
            label: "Subscription quotas",
            accelerator: "CmdOrCtrl+Shift+U",
            click: openTray,
          },
          {
            label: "Open main window",
            accelerator: "CmdOrCtrl+1",
            click: () => {
              void showMain();
            },
          },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { role: "togglefullscreen" },
        ],
      },
      { role: "windowMenu" },
    ]),
  );
  await mainWindow.loadURL(application.origin);
  await trayWindow.loadURL(`${application.origin}/?view=tray`);
  mainWindow.show();
}

import type { AppUpdater } from "electron-updater";
import type { Dialog } from "electron";

// Keep checks, downloads and dialogs serialized, including manual checks during a download.
export function updateChecker(
  updater: Pick<
    AppUpdater,
    "checkForUpdates" | "downloadUpdate" | "quitAndInstall"
  >,
  dialogs: Pick<Dialog, "showMessageBox">,
  restart: (install: () => void) => Promise<void>,
  isQuitting: () => boolean,
) {
  let busy = false;
  let downloaded = false;
  return async (manual = false): Promise<void> => {
    if (busy || isQuitting()) return;
    busy = true;
    try {
      if (!downloaded) {
        const result = await updater.checkForUpdates();
        if (isQuitting()) return;
        if (!result?.isUpdateAvailable) {
          if (manual)
            await dialogs.showMessageBox({
              type: "info",
              message: "No updates available",
              detail: "You are running the latest available version.",
            });
          return;
        }
        await updater.downloadUpdate();
        downloaded = true;
      } else if (!manual) return;
      if (isQuitting()) return;
      const { response } = await dialogs.showMessageBox({
        type: "info",
        message: "An update is ready",
        detail:
          "Restarting stops the local proxy and interrupts connected agents. You can update later from the app or tray menu.",
        buttons: ["Restart to update", "Later"],
        defaultId: 1,
        cancelId: 1,
      });
      if (response === 0 && !isQuitting())
        await restart(() => updater.quitAndInstall());
    } catch {
      // Updater errors can contain remote response bodies; keep diagnostics local and generic.
      console.warn("App update check, download or installation failed.");
      if (manual && !isQuitting())
        await dialogs.showMessageBox({
          type: "error",
          message: "Could not update the app",
          detail:
            "Check your connection and try again later. Your current installation has not been replaced.",
        });
    } finally {
      busy = false;
    }
  };
}

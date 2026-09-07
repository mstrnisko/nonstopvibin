import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../shared/types.ts";

const bridge: DesktopBridge = {
  bootstrap: () => ipcRenderer.invoke("nv:bootstrap"),
  openExternal: (url: string) => ipcRenderer.invoke("nv:open-external", url),
  copy: (text: string) => ipcRenderer.invoke("nv:copy", text),
  showWindow: (profileId?: string) =>
    ipcRenderer.invoke("nv:show-window", profileId),
  setLoginItem: (enabled: boolean) =>
    ipcRenderer.invoke("nv:login-item", enabled),
  getLoginItem: () => ipcRenderer.invoke("nv:get-login-item"),
  revealData: () => ipcRenderer.invoke("nv:reveal-data"),
  chooseProject: () => ipcRenderer.invoke("nv:choose-project"),
};
contextBridge.exposeInMainWorld("nonstopvibin", bridge);

import { existsSync } from "node:fs";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

function desktopEntry(executable: string): string {
  if (/[\n\r=]/.test(executable))
    throw new Error(
      "Move the app to a path without newlines or equals signs to enable automatic startup.",
    );
  // Desktop Entry string escaping is applied before Exec argument escaping.
  const argument = executable
    .replace(/[\\"`$]/g, (character) => `\\${character}`)
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "%%");
  return `[Desktop Entry]\nType=Application\nName=nonstopvibin\nExec="${argument}"\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`;
}
export function linuxLoginItem(configDirectory: string): boolean {
  return existsSync(
    join(configDirectory, "autostart/app.nonstopvibin.desktop"),
  );
}
export async function setLinuxLoginItem(
  configDirectory: string,
  executable: string,
  enabled: boolean,
): Promise<boolean> {
  const directory = join(configDirectory, "autostart");
  const file = join(directory, "app.nonstopvibin.desktop");
  if (enabled) {
    await mkdir(directory, { recursive: true });
    await writeFile(file, desktopEntry(executable), { mode: 0o600 });
  } else await rm(file, { force: true });
  return linuxLoginItem(configDirectory);
}

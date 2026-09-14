import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function dataDirectory(override = process.env.NONSTOPVIBIN_DATA_DIR) {
  return resolve(override || join(homedir(), ".nonstopvibin"));
}

import { readFile, writeFile, chmod } from "fs/promises";
import { config } from "@/utils/config";
import { ensureArcHomeDir, pathExists } from "@/utils/arc-home";

export interface ArcSettings {
  nvidiaApiKey?: string;
}

export async function loadSettings(): Promise<ArcSettings> {
  try {
    if (!(await pathExists(config.paths.settingsFile))) return {};
    const data = await readFile(config.paths.settingsFile, "utf-8");
    return JSON.parse(data) as ArcSettings;
  } catch {
    return {};
  }
}

export async function saveSettings(settings: ArcSettings): Promise<boolean> {
  if (!(await ensureArcHomeDir())) return false;

  try {
    await writeFile(config.paths.settingsFile, JSON.stringify(settings, null, 2), {
      mode: config.storage.settingsFileMode,
    });
    await chmod(config.paths.settingsFile, config.storage.settingsFileMode);
    return true;
  } catch {
    return false;
  }
}

export const SETTINGS_FILE_PATH = config.paths.settingsFile;

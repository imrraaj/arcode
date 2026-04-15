import { readFile, writeFile, chmod, mkdir } from "fs/promises";
import { config } from "@/utils/config";

export interface ArcSettings {
  nvidiaApiKey?: string;
}

export async function loadSettings(): Promise<ArcSettings> {
  try {
    const data = await readFile(config.paths.settingsFile, "utf-8");
    return JSON.parse(data) as ArcSettings;
  } catch {
    return {};
  }
}

export async function saveSettings(settings: ArcSettings): Promise<boolean> {
  try {
    await mkdir(config.paths.dataDir, {
      recursive: true,
      mode: config.storage.directoryMode,
    });
    await writeFile(config.paths.settingsFile, JSON.stringify(settings, null, 2), {
      mode: config.storage.settingsFileMode,
    });
    await chmod(config.paths.settingsFile, config.storage.settingsFileMode);
    return true;
  } catch {
    return false;
  }
}

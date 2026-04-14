import { access, mkdir, readFile, writeFile, chmod } from "fs/promises";
import { join } from "path";
import { WORKSPACE_ROOT } from "./workspace";

const DATA_DIR = process.env.ARC_DATA_DIR ?? join(WORKSPACE_ROOT, ".arc");
const SETTINGS_FILE = join(DATA_DIR, "config.json");

export interface ArcSettings {
  nvidiaApiKey?: string;
}

async function ensureDir(): Promise<boolean> {
  try {
    await access(DATA_DIR);
    return true;
  } catch {
    try {
      await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
      return true;
    } catch {
      return false;
    }
  }
}

export async function loadSettings(): Promise<ArcSettings> {
  try {
    await access(SETTINGS_FILE);
    const data = await readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(data) as ArcSettings;
  } catch {
    return {};
  }
}

export async function saveSettings(settings: ArcSettings): Promise<boolean> {
  if (!(await ensureDir())) return false;

  try {
    await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
      mode: 0o600,
    });
    await chmod(SETTINGS_FILE, 0o600);
    return true;
  } catch {
    return false;
  }
}

export const SETTINGS_FILE_PATH = SETTINGS_FILE;

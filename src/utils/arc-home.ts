import { access, mkdir } from "fs/promises";
import { config } from "@/utils/config";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDirectory(path: string, mode: number): Promise<boolean> {
  try {
    await mkdir(path, { recursive: true, mode });
    return true;
  } catch {
    return false;
  }
}

export async function ensureArcHomeDir(): Promise<boolean> {
  return ensureDirectory(config.paths.dataDir, config.storage.directoryMode);
}

export async function ensureArcSessionsDir(): Promise<boolean> {
  return (
    (await ensureArcHomeDir()) &&
    ensureDirectory(config.paths.sessionsDir, config.storage.directoryMode)
  );
}

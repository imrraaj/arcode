import { resolve, relative, isAbsolute } from "path";

export const WORKSPACE_ROOT =
  process.env.ARC_WORKSPACE_ROOT ??
  resolve(process.cwd());

export function isInsideWorkspace(path: string): boolean {
  const rel = relative(WORKSPACE_ROOT, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function resolveWorkspacePath(path: string): string {
  const resolvedPath = isAbsolute(path) ? resolve(path) : resolve(WORKSPACE_ROOT, path);

  if (!isInsideWorkspace(resolvedPath)) {
    throw new Error(`Path escapes workspace: ${path}`);
  }

  return resolvedPath;
}

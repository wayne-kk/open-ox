import { hashRawWorkspaceFile, normalizeWorkspaceText } from "./contentProtocol";

/** Last known content hash from read_file (protocol-normalized), per relative path. */
const pathToReadHash = new Map<string, string>();

export function recordReadContentHash(relativePath: string, rawContent: string): string {
  const h = hashRawWorkspaceFile(rawContent);
  pathToReadHash.set(relativePath, h);
  return h;
}

export function getLastReadContentHash(relativePath: string): string | undefined {
  return pathToReadHash.get(relativePath);
}

export function compareDiskToBaseHash(relativePath: string, rawFromDisk: string, baseHash: string): boolean {
  return hashRawWorkspaceFile(rawFromDisk) === baseHash;
}

export function clearReadRevisionStore(): void {
  pathToReadHash.clear();
}

export { normalizeWorkspaceText };

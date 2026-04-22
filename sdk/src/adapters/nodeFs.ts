/**
 * Node.js FileSystem adapter using built-in fs module.
 */

import { readFile, writeFile, access, mkdir, readdir, unlink } from "fs/promises";
import { dirname } from "path";
import type { FileSystem } from "../types";

export class NodeFileSystem implements FileSystem {
  async readFile(path: string): Promise<string> {
    return readFile(path, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async readdir(path: string): Promise<string[]> {
    return readdir(path);
  }

  async unlink(path: string): Promise<void> {
    await unlink(path);
  }

  async tryReadFile(path: string): Promise<string | null> {
    try {
      return await this.readFile(path);
    } catch {
      return null;
    }
  }
}

export function createNodeFileSystem(): NodeFileSystem {
  return new NodeFileSystem();
}

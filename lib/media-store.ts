import { db } from './db';

// Imported media files are kept in the Origin Private File System (fast for
// large files); browsers without it fall back to a Blob in IndexedDB.

const MEDIA_DIR = 'media';

async function mediaDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!navigator.storage?.getDirectory) return null;
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(MEDIA_DIR, { create: true });
  } catch {
    return null;
  }
}

export async function saveMedia(name: string, file: Blob): Promise<string> {
  const dir = await mediaDirectory();
  if (dir) {
    try {
      const handle = await dir.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      return `opfs:${MEDIA_DIR}/${name}`;
    } catch {
      // Safari only allows writes from workers in some versions: fall back below.
    }
  }
  await db.blobs.put({ path: `idb:${name}`, blob: file });
  return `idb:${name}`;
}

export async function loadMedia(path: string): Promise<Blob | null> {
  if (path.startsWith('opfs:')) {
    const dir = await mediaDirectory();
    try {
      return dir ? await (await dir.getFileHandle(path.slice(`opfs:${MEDIA_DIR}/`.length))).getFile() : null;
    } catch {
      return null;
    }
  }
  return (await db.blobs.get(path))?.blob ?? null;
}

export async function deleteMedia(path: string): Promise<void> {
  if (path.startsWith('opfs:')) {
    const dir = await mediaDirectory();
    await dir?.removeEntry(path.slice(`opfs:${MEDIA_DIR}/`.length)).catch(() => undefined);
    return;
  }
  await db.blobs.delete(path);
}

export async function storageUsage(): Promise<{ usage: number; quota: number; persisted: boolean }> {
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  return { usage: estimate?.usage ?? 0, quota: estimate?.quota ?? 0, persisted: Boolean(persisted) };
}

// Asks the browser not to evict our data when the device runs low on space.
export async function requestPersistence(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return Boolean(await navigator.storage?.persist?.());
  } catch {
    return false;
  }
}

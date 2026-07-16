import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Atomic JSON write: a sibling temp file, then rename over the target. */
export async function saveJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2));
  await rename(tmp, file);
}

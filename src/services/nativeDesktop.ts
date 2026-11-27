import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export async function nativeSaveTextFile(defaultName: string, content: string, filters: Array<{ name: string; extensions: string[] }>): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    const filePath = await save({
      defaultPath: defaultName,
      filters,
    });
    if (!filePath) return false;
    await writeTextFile(filePath, content);
    return true;
  } catch (err) {
    console.error('Tauri save error:', err);
    return false;
  }
}

export async function nativeOpenTextFile(filters: Array<{ name: string; extensions: string[] }>): Promise<string | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const selected = await open({
      multiple: false,
      filters,
    });
    if (!selected || typeof selected !== 'string') return null;
    return await readTextFile(selected);
  } catch (err) {
    console.error('Tauri open error:', err);
    return null;
  }
}

// 执行环境差异：正式 PWA 与 claude.ai 预览连结（build --mode artifact）。
// 预览连结在受限框架中执行：不能直接下载、不能用动作感测器与系统分享，
// 存档改由平台的 downloads 功能请使用者确认。
import { downloadBlob } from './card';

export const IS_PREVIEW = import.meta.env.MODE === 'artifact';

interface Saver {
  save(req: { filename: string; data: Blob | string }): Promise<{ status: string }>;
}
type ClaudeHost = { use?: (name: string) => Promise<unknown> };

let saverPromise: Promise<Saver | null> | null = null;
function getSaver(): Promise<Saver | null> {
  if (!saverPromise) {
    const host = (window as unknown as { claude?: ClaudeHost }).claude;
    saverPromise = host?.use ? (host.use('downloads') as Promise<Saver | null>).catch(() => null) : Promise.resolve(null);
  }
  return saverPromise;
}

export type SaveOutcome = 'saved' | 'declined' | 'unavailable';

/** 存档：正式版直接下载；预览版请平台跳出确认视窗。 */
export async function saveFile(data: Blob, filename: string): Promise<SaveOutcome> {
  if (!IS_PREVIEW) {
    downloadBlob(data, filename);
    return 'saved';
  }
  const saver = await getSaver();
  if (!saver) return 'unavailable';
  try {
    await saver.save({ filename, data });
    return 'saved';
  } catch (e) {
    return (e as { code?: string })?.code === 'declined' ? 'declined' : 'unavailable';
  }
}

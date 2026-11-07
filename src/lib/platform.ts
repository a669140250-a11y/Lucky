// 執行環境差異：正式 PWA 與 claude.ai 預覽連結（build --mode artifact）。
// 預覽連結在受限框架中執行：不能直接下載、不能用動作感測器與系統分享，
// 存檔改由平台的 downloads 功能請使用者確認。
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

/** 存檔：正式版直接下載；預覽版請平台跳出確認視窗。 */
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

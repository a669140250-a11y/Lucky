import { useRef, useState } from 'preact/hooks';
import { ProfileForm } from '../components/ProfileForm';
import { Footer, ScreenHeader } from '../components/ui';
import { canVibrate } from '../lib/haptics';
import { saveFile } from '../lib/platform';
import { SOURCES } from '../lib/qian';
import { type Backup, type Profile, type Settings as S, type ThemePref, makeBackup, parseBackup } from '../lib/storage';

interface Props {
  profile: Profile;
  settings: S;
  onProfile: (p: Profile) => void;
  onSettings: (s: S) => void;
  onImport: (b: Backup) => void;
  onClear: () => void;
}

export function Settings(props: Props) {
  const { settings: s } = props;
  const [savedMsg, setSavedMsg] = useState('');
  const [dataMsg, setDataMsg] = useState('');
  const [pending, setPending] = useState<Backup | null>(null); // 等待確認的匯入
  const [askClear, setAskClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<S>) => props.onSettings({ ...s, ...patch });

  const exportData = async () => {
    const blob = new Blob([JSON.stringify(makeBackup(), null, 1)], { type: 'application/json' });
    const d = new Date();
    const r = await saveFile(blob, `今日一籤備份-${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}.json`);
    setDataMsg(r === 'saved' ? '已匯出備份檔。' : r === 'declined' ? '' : '這裡無法存檔，請改用正式版匯出。');
  };

  const importData = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      setPending(parseBackup(await f.text()));
      setDataMsg('');
    } catch (err) {
      setDataMsg(`匯入失敗：${(err as Error).message}`);
    } finally {
      (e.target as HTMLInputElement).value = '';
    }
  };

  return (
    <section class="screen-body">
      <ScreenHeader title="設定" />

      <div class="card">
        <h2 class="card-title">個人資料</h2>
        <ProfileForm
          initial={props.profile}
          submitLabel="儲存個人資料"
          onSubmit={(p) => {
            props.onProfile(p);
            setSavedMsg('已儲存。');
            setTimeout(() => setSavedMsg(''), 2000);
          }}
        />
        {savedMsg && <p class="hint center" role="status">{savedMsg}</p>}
      </div>

      <div class="card">
        <h2 class="card-title">求籤</h2>
        <fieldset class="radio-group">
          <legend>擲筊確認籤支</legend>
          <label>
            <input type="radio" name="cm" checked={s.confirmMode === 1} onChange={() => set({ confirmMode: 1 })} />
            一個聖筊即可（預設）
          </label>
          <label>
            <input type="radio" name="cm" checked={s.confirmMode === 3} onChange={() => set({ confirmMode: 3 })} />
            需連續三個聖筊
          </label>
        </fieldset>
      </div>

      <div class="card">
        <h2 class="card-title">外觀與回饋</h2>
        <fieldset class="radio-group inline">
          <legend>深色模式</legend>
          {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
            <label key={t}>
              <input type="radio" name="theme" checked={s.theme === t} onChange={() => set({ theme: t })} />
              {t === 'system' ? '跟隨系統' : t === 'light' ? '淺色' : '深色'}
            </label>
          ))}
        </fieldset>
        <label class="switch">
          <span>音效</span>
          <input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: (e.target as HTMLInputElement).checked })} />
        </label>
        <label class="switch">
          <span>
            震動回饋
            {!canVibrate() && <small class="hint">（此裝置不支援，例如 iPhone）</small>}
          </span>
          <input type="checkbox" checked={s.vibrate} onChange={(e) => set({ vibrate: (e.target as HTMLInputElement).checked })} />
        </label>
      </div>

      <div class="card">
        <h2 class="card-title">資料</h2>
        <p class="hint">所有資料只存在本機瀏覽器。清除瀏覽器資料會一併刪除，建議定期匯出備份。</p>
        <div class="row">
          <button class="btn ghost" onClick={exportData}>匯出備份</button>
          <button class="btn ghost" onClick={() => fileRef.current?.click()}>匯入備份</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importData} />
        </div>
        {pending && (
          <div class="confirm-box" role="group" aria-label="確認匯入">
            <p>以備份檔取代目前資料？備份內有籤本 {pending.journal.length} 筆，目前的資料會被覆蓋。</p>
            <div class="row">
              <button class="btn ghost" onClick={() => setPending(null)}>取消</button>
              <button
                class="btn primary"
                onClick={() => {
                  props.onImport(pending);
                  setPending(null);
                  setDataMsg('已匯入備份。');
                }}
              >
                確定匯入
              </button>
            </div>
          </div>
        )}
        {askClear ? (
          <div class="confirm-box danger" role="group" aria-label="確認清除">
            <p>清除個人資料、設定與全部籤本？此動作無法復原。</p>
            <div class="row">
              <button class="btn ghost" onClick={() => setAskClear(false)}>取消</button>
              <button class="btn primary" onClick={() => props.onClear()}>確定清除</button>
            </div>
          </div>
        ) : (
          <button class="link danger" onClick={() => setAskClear(true)}>
            清除所有資料
          </button>
        )}
        {dataMsg && <p class="hint" role="status">{dataMsg}</p>}
      </div>

      <div class="card about">
        <h2 class="card-title">關於</h2>
        <p>
          曆法、干支、黃曆宜忌由開源函式庫 lunar-javascript 計算。籤詩為傳統六十甲子籤，原文依下列三個來源逐字比對、多數決定稿；白話解說、分類建議與吉凶等級為本 App 撰寫。
        </p>
        <ul>
          {SOURCES.map((x) => (
            <li key={x.id}>{x.name}</li>
          ))}
        </ul>
        <p>運勢規則：依今日日干與日主的十神關係判斷；官殺、食傷取印，財取比劫，印、比劫取食傷為幸運五行；幸運數字取河圖數。</p>
      </div>

      <Footer />
    </section>
  );
}

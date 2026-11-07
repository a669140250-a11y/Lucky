import { useMemo, useState } from 'preact/hooks';
import { HOURS, type HourKey, computeBazi, isValidDate } from '../lib/lunar';
import type { Profile } from '../lib/storage';

const pad = (n: number) => String(n).padStart(2, '0');

export function ProfileForm(props: { initial?: Profile | null; submitLabel: string; onSubmit: (p: Profile) => void }) {
  const init = props.initial;
  const [nickname, setNickname] = useState(init?.nickname ?? '');
  const [date, setDate] = useState(init ? `${init.birth.y}-${pad(init.birth.m)}-${pad(init.birth.d)}` : '');
  const [hour, setHour] = useState<HourKey | ''>(init?.birth.hour ?? '');
  const [touched, setTouched] = useState(false);

  const parsed = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isValidDate(y, mo, d) ? { y, m: mo, d } : null;
  }, [date]);

  const bazi = useMemo(
    () => (parsed ? computeBazi({ ...parsed, hour: hour || null }) : null),
    [parsed, hour],
  );

  const name = nickname.trim();
  const errors = {
    nickname: !name ? '請輸入暱稱' : '',
    date: !parsed ? '請選擇 1901–2099 年之間的出生日期' : '',
  };
  const ok = !errors.nickname && !errors.date;

  const submit = (e: Event) => {
    e.preventDefault();
    setTouched(true);
    if (!ok || !parsed) return;
    props.onSubmit({ nickname: name, birth: { ...parsed, hour: hour || null } });
  };

  return (
    <form class="profile-form" onSubmit={submit} noValidate>
      <label class="field">
        <span>暱稱</span>
        <input
          type="text"
          value={nickname}
          maxLength={12}
          placeholder="例如：小安"
          autocomplete="nickname"
          onInput={(e) => setNickname((e.target as HTMLInputElement).value)}
        />
        {touched && errors.nickname && <em class="err">{errors.nickname}</em>}
      </label>

      <label class="field">
        <span>出生日期（國曆）</span>
        <input
          type="date"
          value={date}
          min="1901-01-01"
          max="2099-12-31"
          onInput={(e) => setDate((e.target as HTMLInputElement).value)}
        />
        {touched && errors.date && <em class="err">{errors.date}</em>}
      </label>

      <label class="field">
        <span>出生時辰（可不填）</span>
        <select value={hour} onChange={(e) => setHour((e.target as HTMLSelectElement).value as HourKey | '')}>
          <option value="">不確定／不填</option>
          {HOURS.map((h) => (
            <option key={h.key} value={h.key}>
              {h.label}（{h.range}）
            </option>
          ))}
        </select>
        <small class="hint">晚子時（23:00 後）出生，日柱依子初換日算到隔天。</small>
      </label>

      {bazi && (
        <div class="bazi-preview">
          <div>
            <span class="k">日主</span>
            <b>{bazi.dayMaster}{bazi.element}</b>
            <small>（{bazi.yang ? '陽' : '陰'}{bazi.element}）</small>
          </div>
          <div>
            <span class="k">生肖</span>
            <b>{bazi.shengxiao}</b>
            <small>（以立春換年）</small>
          </div>
          <div class="wide">
            <span class="k">四柱</span>
            <b class="pillars">
              {bazi.pillars.year}　{bazi.pillars.month}　{bazi.pillars.day}　{bazi.pillars.time ?? '－－'}
            </b>
          </div>
          <div class="wide">
            <span class="k">農曆</span>
            <span>{bazi.lunarBirth}</span>
          </div>
        </div>
      )}

      <p class="hint">資料只存在這支手機的瀏覽器裡，不會上傳。</p>
      <button type="submit" class="btn primary big">{props.submitLabel}</button>
    </form>
  );
}

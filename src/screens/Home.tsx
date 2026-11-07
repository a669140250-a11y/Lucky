import { useEffect, useState } from 'preact/hooks';
import { Footer, Icon, Modal, ScreenHeader } from '../components/ui';
import { canShareFiles, renderFortuneCard, shareImage } from '../lib/card';
import { IS_PREVIEW, saveFile } from '../lib/platform';
import type { DailyFortune } from '../lib/fortune';
import { type Bazi, type DayInfo, ganElement } from '../lib/lunar';
import type { Profile } from '../lib/storage';

interface Props {
  profile: Profile;
  bazi: Bazi;
  day: DayInfo;
  fortune: DailyFortune;
  onDraw: () => void;
}

export function Home({ profile, bazi, day, fortune: f, onDraw }: Props) {
  const [cardOpen, setCardOpen] = useState(false);
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [cardErr, setCardErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => () => card && URL.revokeObjectURL(card.url), [card]);

  const makeCard = async () => {
    setCardOpen(true);
    setCardErr('');
    setMsg('');
    try {
      const blob = await renderFortuneCard({
        nickname: profile.nickname,
        day,
        fortune: f,
        dayMaster: bazi.dayMaster,
        element: bazi.element,
      });
      setCard((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
    } catch (e) {
      setCardErr((e as Error).message || '圖卡產生失敗');
    }
  };

  const filename = `今日一籤-${day.key}.png`;
  const share = async () => {
    if (!card) return;
    const r = await shareImage(card.blob, filename);
    setMsg(r === 'downloaded' ? '已下載圖片' : '');
  };
  const save = async () => {
    if (!card) return;
    const r = await saveFile(card.blob, filename);
    setMsg(r === 'saved' ? '已儲存圖片' : r === 'declined' ? '' : '這裡無法直接存檔，請長按上方圖片儲存。');
  };

  const day2 = day.solarText.match(/(\d+)年(\d+)月(\d+)日/)!;

  return (
    <section class="screen-body">
      <ScreenHeader title="今日運勢" sub={`${profile.nickname}，${greeting()}`} />

      <div class="card date-card">
        <div class="date-big">
          <span class="d">{day2[3]}</span>
          <span class="m">{day2[2]}月・{day.weekday}</span>
          <span class="y">{day2[1]}</span>
        </div>
        <div class="date-lunar">
          <div class="lunar-main">農曆{day.lunarText}</div>
          <div>{day.lunarYearGz}年（{day.lunarYearSx}）</div>
          <div class="gz">
            <b>{day.dayGz}日</b>
            {day.jieqi && <span class="tag gold">{day.jieqi}</span>}
          </div>
        </div>
      </div>

      <div class="card yiji">
        <div class="yiji-row">
          <span class="yiji-badge yi">宜</span>
          <div class="chips">{day.yi.map((w) => <span class="chip" key={w}>{w}</span>)}</div>
        </div>
        <div class="yiji-row">
          <span class="yiji-badge ji">忌</span>
          <div class="chips">{day.ji.map((w) => <span class="chip" key={w}>{w}</span>)}</div>
        </div>
        <p class="yiji-foot">沖{day.chongDesc}・煞{day.sha}</p>
      </div>

      {f.chong && (
        <div class="card alert" role="note">
          <Icon name="alert" />
          <div>
            <b>{f.chong.title}</b>
            <p>{f.chong.text}</p>
          </div>
        </div>
      )}

      <div class="card fortune-card">
        <div class="fortune-top">
          <div class="seal" aria-label={`十神：${f.god}`}>
            <span>{f.god[0]}</span>
            <span>{f.god[1]}</span>
          </div>
          <div>
            <p class="kicker">今日主題</p>
            <h2 class="theme">{f.theme}</h2>
            <p class="relation">
              今日日干{day.dayGan}{ganElement(day.dayGan)}，對你的日主{bazi.dayMaster}{bazi.element}為「{f.god}」。
            </p>
          </div>
        </div>
        <p class="fortune-line">{f.line}</p>
        <div class="lucky">
          <div class="lucky-item">
            <span class="k">幸運五行</span>
            <b class={`el el-${f.element}`}>{f.element}</b>
          </div>
          <div class="lucky-item">
            <span class="k">幸運色</span>
            <b>
              <i class="swatch" style={{ background: f.colorHex }} />
              {f.color}色
            </b>
          </div>
          <div class="lucky-item">
            <span class="k">幸運數字</span>
            <b>{f.numbers.join('・')}</b>
          </div>
        </div>
        <p class="hint small">{f.summary}</p>
      </div>

      <div class="actions">
        <button class="btn primary big" onClick={onDraw}>擲筊求籤</button>
        <button class="btn ghost big" onClick={makeCard}>
          <Icon name="image" /> 生成今日運勢圖卡
        </button>
      </div>

      <Footer />

      <Modal open={cardOpen} onClose={() => setCardOpen(false)} title="今日運勢圖卡">
        {cardErr && <p class="err">{cardErr}</p>}
        {!card && !cardErr && <p class="hint center">圖卡繪製中…</p>}
        {card && (
          <>
            <img class="card-preview" src={card.url} alt="今日運勢圖卡" />
            <p class="hint center small">手機上也可以長按圖片直接儲存。</p>
            <div class="row">
              {canShareFiles() && (
                <button class="btn primary" onClick={share}>
                  <Icon name="share" /> 分享
                </button>
              )}
              <button class={`btn ${IS_PREVIEW ? 'primary' : 'ghost'}`} onClick={save}>
                <Icon name="download" /> 存圖
              </button>
            </div>
            {msg && <p class="hint center">{msg}</p>}
          </>
        )}
      </Modal>
    </section>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return '夜深了，早點休息';
  if (h < 11) return '早安';
  if (h < 14) return '午安';
  if (h < 18) return '午後好';
  return '晚安';
}

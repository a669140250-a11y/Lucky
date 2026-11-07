import { useEffect, useRef, useState } from 'preact/hooks';
import { JiaoLegend, JiaoThrow } from '../components/Jiao';
import { QianTong } from '../components/QianTong';
import { QianView } from '../components/QianView';
import { Footer, Icon, ScreenHeader } from '../components/ui';
import { playBell, playLow, playRattle, playStickDrop, unlockAudio } from '../lib/audio';
import { type DailyFortune, drawReminder } from '../lib/fortune';
import { vibrate } from '../lib/haptics';
import { JIAO_LABEL, type JiaoResult, type Toss } from '../lib/jiao';
import { type Bazi, type DayInfo, HOURS } from '../lib/lunar';
import { listenShake, motionSupport, requestMotionPermission } from '../lib/motion';
import { QIAN_COUNT, cnNumber, getQian } from '../lib/qian';
import { randInt } from '../lib/random';
import { CATEGORIES, type CategoryId, type JournalEntry, type Profile, type Settings, categoryLabel, newId } from '../lib/storage';

type Step = 'category' | 'report' | 'ask' | 'shake' | 'confirm' | 'result';
const STEPS: { id: Step; label: string }[] = [
  { id: 'category', label: '問事' },
  { id: 'report', label: '稟告' },
  { id: 'ask', label: '請示' },
  { id: 'shake', label: '搖籤' },
  { id: 'confirm', label: '確認' },
  { id: 'result', label: '解籤' },
];

const SHAKE_GOAL = 6;

interface Props {
  active: boolean;
  profile: Profile;
  bazi: Bazi;
  day: DayInfo;
  fortune: DailyFortune;
  settings: Settings;
  onSave: (e: JournalEntry) => void;
  onOpenJournal: () => void;
}

export function Draw(props: Props) {
  const { profile, bazi, day, settings } = props;
  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [question, setQuestion] = useState('');
  const [askResult, setAskResult] = useState<JiaoResult | null>(null);
  const [qianNo, setQianNo] = useState<number | null>(null);
  const [dropKey, setDropKey] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [confirmCount, setConfirmCount] = useState(0);
  const [confirmFail, setConfirmFail] = useState<JiaoResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const needed = settings.confirmMode;

  // ---- 搖籤 ----
  const support = motionSupport();
  const [motionOn, setMotionOn] = useState(support === 'available');
  const [motionActive, setMotionActive] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [progress, setProgress] = useState(0);
  const energy = useRef(0);
  const dropping = useRef(false);
  const shakeOff = useRef<number>();
  const holdTimer = useRef<number>();
  const topRef = useRef<HTMLDivElement>(null);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const go = (s: Step) => {
    setStep(s);
    requestAnimationFrame(scrollTop);
  };

  const addEnergy = (n: number) => {
    if (dropping.current) return;
    energy.current += n;
    setProgress(Math.min(1, energy.current / SHAKE_GOAL));
    if (energy.current >= SHAKE_GOAL) drop();
  };

  const drop = () => {
    if (dropping.current) return;
    dropping.current = true;
    stopHold();
    setShaking(false);
    const no = randInt(QIAN_COUNT) + 1;
    setQianNo(no);
    setDropKey((k) => k + 1);
    setTimeout(() => {
      playStickDrop();
      vibrate(70);
    }, 880);
  };

  const onDropDone = () => go('confirm');

  // 搖動偵測：只在搖籤步驟、且畫面在前景時監聽
  useEffect(() => {
    if (!props.active || step !== 'shake' || !motionOn) return;
    return listenShake(
      (intensity) => {
        if (dropping.current) return;
        playRattle(intensity);
        setShaking(true);
        clearTimeout(shakeOff.current);
        shakeOff.current = window.setTimeout(() => setShaking(false), 380);
        addEnergy(intensity);
      },
      () => setMotionActive(true),
    );
  }, [props.active, step, motionOn, attempt]);

  const enableMotion = async () => {
    unlockAudio();
    const ok = await requestMotionPermission();
    setMotionOn(ok);
    setPermDenied(!ok);
  };

  const startHold = (e: PointerEvent) => {
    e.preventDefault();
    if (dropping.current) return;
    unlockAudio();
    setShaking(true);
    clearInterval(holdTimer.current);
    holdTimer.current = window.setInterval(() => {
      playRattle(0.8);
      addEnergy(0.5);
    }, 130);
  };
  const stopHold = () => {
    clearInterval(holdTimer.current);
    holdTimer.current = undefined;
    if (!dropping.current) setShaking(false);
  };
  useEffect(() => () => { stopHold(); clearTimeout(shakeOff.current); }, []);
  useEffect(() => { if (!props.active) stopHold(); }, [props.active]);

  // ---- 擲筊 ----
  const onAsk = (t: Toss) => {
    setAskResult(t.result);
    if (t.result === 'sheng') playBell(523);
    else playLow();
  };

  const onConfirm = (t: Toss) => {
    if (t.result === 'sheng') {
      const c = confirmCount + 1;
      setConfirmCount(c);
      if (c >= needed) {
        setTimeout(() => {
          playBell();
          vibrate([40, 60, 120]);
          go('result');
        }, 900);
      }
    } else {
      setConfirmFail(t.result);
      playLow();
    }
  };

  const putBack = () => {
    setConfirmFail(null);
    setConfirmCount(0);
    setQianNo(null);
    setProgress(0);
    energy.current = 0;
    dropping.current = false;
    setAttempt((a) => a + 1);
    go('shake');
  };

  // ---- 存入籤本 ----
  useEffect(() => {
    if (step !== 'result' || !qianNo || !category || savedId) return;
    const q = getQian(qianNo);
    const entry: JournalEntry = {
      id: newId(),
      ts: Date.now(),
      dateKey: day.key,
      solarText: day.solarText,
      lunarText: `${day.lunarYearGz}年${day.lunarText}`,
      dayGz: day.dayGz,
      category,
      question: question.trim(),
      qianNo,
      qianGz: q.ganzhi,
      grade: q.grade,
      outcome: 'pending',
      note: '',
    };
    props.onSave(entry);
    setSavedId(entry.id);
  }, [step]);

  const restart = () => {
    setCategory(null);
    setQuestion('');
    setAskResult(null);
    setQianNo(null);
    setConfirmCount(0);
    setConfirmFail(null);
    setSavedId(null);
    setProgress(0);
    energy.current = 0;
    dropping.current = false;
    setAttempt((a) => a + 1);
    go('category');
  };

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const hourLabel = profile.birth.hour ? HOURS.find((h) => h.key === profile.birth.hour)?.label : '';
  const qian = qianNo ? getQian(qianNo) : null;

  return (
    <section class="screen-body">
      <div ref={topRef} />
      <ScreenHeader title="擲筊求籤" sub="誠心正意，一事一問" />
      <ol class="steps" aria-label="求籤步驟">
        {STEPS.map((s, i) => (
          <li key={s.id} class={i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''} aria-current={i === stepIdx ? 'step' : undefined}>
            <span>{i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>

      {step === 'category' && (
        <div class="card">
          <h2 class="card-title">想請示哪一方面？</h2>
          <div class="cat-grid" role="radiogroup" aria-label="問事類別">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={category === c.id}
                class={`cat ${category === c.id ? 'on' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label class="field">
            <span>想問的事（可不填）</span>
            <textarea
              rows={3}
              maxLength={100}
              value={question}
              placeholder="例如：這份新工作適合我嗎？"
              onInput={(e) => setQuestion((e.target as HTMLTextAreaElement).value)}
            />
          </label>
          <p class="hint">問題越具體越好，一次只問一件事。</p>
          <button class="btn primary big" disabled={!category} onClick={() => { unlockAudio(); go('report'); }}>
            下一步：稟告
          </button>
        </div>
      )}

      {step === 'report' && category && (
        <div class="card report">
          <h2 class="card-title">稟告</h2>
          <div class="report-text">
            <p>弟子　<b>{profile.nickname}</b></p>
            <p>
              國曆{profile.birth.y}年{profile.birth.m}月{profile.birth.d}日{hourLabel ? `${hourLabel}` : ''}生
              <br />
              （農曆{bazi.lunarBirth}，屬{bazi.shengxiao}）
            </p>
            <p>今日{day.solarText}，{day.dayGz}日，誠心祈求指點：</p>
            <p class="ask">
              【{categoryLabel(category)}】{question.trim() || '（心中默念所問之事）'}
            </p>
            <p>懇請神明慈悲，賜予靈籤，指點迷津。</p>
          </div>
          <p class="hint">請在心中默念以上內容，準備好後擲筊，請示神明是否允許求籤。</p>
          <div class="row">
            <button class="btn ghost" onClick={() => go('category')}>
              <Icon name="back" /> 修改
            </button>
            <button class="btn primary" onClick={() => { setAskResult(null); go('ask'); }}>
              稟告完畢，擲筊請示
            </button>
          </div>
        </div>
      )}

      {step === 'ask' && (
        <div class="card">
          <h2 class="card-title">擲筊請示：可否求籤？</h2>
          <JiaoThrow onResult={onAsk} label="擲筊" disabled={askResult !== null} />
          {askResult === null && <JiaoLegend />}
          {askResult === 'sheng' && (
            <div class="verdict good">
              <p><b>聖筊！</b>神明應允，請誠心搖動籤筒。</p>
              <button class="btn primary big" onClick={() => go('shake')}>開始搖籤</button>
            </div>
          )}
          {askResult && askResult !== 'sheng' && (
            <div class="verdict bad">
              <p>
                <b>{JIAO_LABEL[askResult]}。</b>
                {askResult === 'xiao'
                  ? '神明笑而不答，可能問題還不夠明確。'
                  : '神明尚未應允，請再想想心中所問之事。'}
                請換個問法再試一次。
              </p>
              <button class="btn primary big" onClick={() => { setAskResult(null); go('category'); }}>
                換個問法
              </button>
            </div>
          )}
        </div>
      )}

      {(step === 'shake' || step === 'confirm') && (
        <div class="card shake-card">
          <h2 class="card-title">{step === 'shake' ? '搖動籤筒' : '擲筊確認'}</h2>
          <QianTong key={attempt} shaking={shaking} dropKey={dropKey} onDropDone={onDropDone} />

          {step === 'shake' && (
            <>
              <div class="meter" aria-hidden="true"><i style={{ width: `${progress * 100}%` }} /></div>
              {support === 'needs-permission' && !motionOn && (
                <button class="btn ghost" onClick={enableMotion}>
                  <Icon name="phone" /> 啟用「搖一搖」
                </button>
              )}
              {permDenied && <p class="hint center">未取得動作感測權限，請改用下方按鈕。</p>}
              <p class="hint center">
                {motionOn && motionActive ? '握緊手機上下搖動，或按住下方按鈕' : '按住下方按鈕搖動籤筒'}
              </p>
              <button
                class="btn primary big hold"
                onPointerDown={startHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                onContextMenu={(e) => e.preventDefault()}
              >
                按住搖籤
              </button>
            </>
          )}

          {step === 'confirm' && qian && (
            <>
              <div class="stick-card">
                <span class="stick-no">第{cnNumber(qian.no)}籤</span>
                <span class="stick-gz">{qian.ganzhi}</span>
              </div>
              <p class="hint center">
                {needed === 1 ? '擲出一個聖筊，即是神明所賜之籤。' : `需連續擲出三個聖筊，才算數。`}
              </p>
              {needed > 1 && (
                <div class="dots" aria-label={`已擲出 ${confirmCount} 個聖筊`}>
                  {Array.from({ length: needed }, (_, i) => <i key={i} class={i < confirmCount ? 'on' : ''} />)}
                </div>
              )}
              <JiaoThrow key={`c${attempt}`} onResult={onConfirm} disabled={confirmFail !== null || confirmCount >= needed} label={confirmCount ? `再擲（第 ${confirmCount + 1} 次）` : '擲筊確認'} />
              {confirmCount >= needed && <p class="verdict good center"><b>聖筊！</b>就是這支籤。</p>}
              {confirmFail && (
                <div class="verdict bad">
                  <p>
                    <b>{JIAO_LABEL[confirmFail]}。</b>
                    這支籤不是神明要給的，請放回籤筒重新抽一支。
                  </p>
                  <button class="btn primary big" onClick={putBack}>放回籤筒重抽</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === 'result' && qian && category && (
        <>
          <div class="card">
            <QianView qian={qian} category={category} reminder={drawReminder(props.fortune)} />
          </div>
          <p class="hint center">已自動存入籤本，日後可標記是否應驗。</p>
          <div class="actions">
            <button class="btn primary big" onClick={props.onOpenJournal}>查看籤本</button>
            <button class="btn ghost big" onClick={restart}>再求一籤</button>
          </div>
        </>
      )}

      <Footer />
    </section>
  );
}

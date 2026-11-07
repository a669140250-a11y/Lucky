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
  { id: 'category', label: '问事' },
  { id: 'report', label: '禀告' },
  { id: 'ask', label: '请示' },
  { id: 'shake', label: '摇签' },
  { id: 'confirm', label: '确认' },
  { id: 'result', label: '解签' },
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

  // ---- 摇签 ----
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

  // 摇动侦测：只在摇签步骤、且画面在前景时监听
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

  // ---- 掷筊 ----
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

  // ---- 存入签本 ----
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
      <ScreenHeader title="掷筊求签" sub="诚心正意，一事一问" />
      <ol class="steps" aria-label="求签步骤">
        {STEPS.map((s, i) => (
          <li key={s.id} class={i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''} aria-current={i === stepIdx ? 'step' : undefined}>
            <span>{i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>

      {step === 'category' && (
        <div class="card">
          <h2 class="card-title">想请示哪一方面？</h2>
          <div class="cat-grid" role="radiogroup" aria-label="问事类别">
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
            <span>想问的事（可不填）</span>
            <textarea
              rows={3}
              maxLength={100}
              value={question}
              placeholder="例如：这份新工作适合我吗？"
              onInput={(e) => setQuestion((e.target as HTMLTextAreaElement).value)}
            />
          </label>
          <p class="hint">问题越具体越好，一次只问一件事。</p>
          <button class="btn primary big" disabled={!category} onClick={() => { unlockAudio(); go('report'); }}>
            下一步：禀告
          </button>
        </div>
      )}

      {step === 'report' && category && (
        <div class="card report">
          <h2 class="card-title">禀告</h2>
          <div class="report-text">
            <p>弟子　<b>{profile.nickname}</b></p>
            <p>
              公历{profile.birth.y}年{profile.birth.m}月{profile.birth.d}日{hourLabel ? `${hourLabel}` : ''}生
              <br />
              （农历{bazi.lunarBirth}，属{bazi.shengxiao}）
            </p>
            <p>今日{day.solarText}，{day.dayGz}日，诚心祈求指点：</p>
            <p class="ask">
              【{categoryLabel(category)}】{question.trim() || '（心中默念所问之事）'}
            </p>
            <p>恳请神明慈悲，赐予灵签，指点迷津。</p>
          </div>
          <p class="hint">请在心中默念以上内容，准备好后掷筊，请示神明是否允许求签。</p>
          <div class="row">
            <button class="btn ghost" onClick={() => go('category')}>
              <Icon name="back" /> 修改
            </button>
            <button class="btn primary" onClick={() => { setAskResult(null); go('ask'); }}>
              禀告完毕，掷筊请示
            </button>
          </div>
        </div>
      )}

      {step === 'ask' && (
        <div class="card">
          <h2 class="card-title">掷筊请示：可否求签？</h2>
          <JiaoThrow onResult={onAsk} label="掷筊" disabled={askResult !== null} />
          {askResult === null && <JiaoLegend />}
          {askResult === 'sheng' && (
            <div class="verdict good">
              <p><b>圣筊！</b>神明应允，请诚心摇动签筒。</p>
              <button class="btn primary big" onClick={() => go('shake')}>开始摇签</button>
            </div>
          )}
          {askResult && askResult !== 'sheng' && (
            <div class="verdict bad">
              <p>
                <b>{JIAO_LABEL[askResult]}。</b>
                {askResult === 'xiao'
                  ? '神明笑而不答，可能问题还不够明确。'
                  : '神明尚未应允，请再想想心中所问之事。'}
                请换个问法再试一次。
              </p>
              <button class="btn primary big" onClick={() => { setAskResult(null); go('category'); }}>
                换个问法
              </button>
            </div>
          )}
        </div>
      )}

      {(step === 'shake' || step === 'confirm') && (
        <div class="card shake-card">
          <h2 class="card-title">{step === 'shake' ? '摇动签筒' : '掷筊确认'}</h2>
          <QianTong key={attempt} shaking={shaking} dropKey={dropKey} onDropDone={onDropDone} />

          {step === 'shake' && (
            <>
              <div class="meter" aria-hidden="true"><i style={{ width: `${progress * 100}%` }} /></div>
              {support === 'needs-permission' && !motionOn && (
                <button class="btn ghost" onClick={enableMotion}>
                  <Icon name="phone" /> 启用“摇一摇”
                </button>
              )}
              {permDenied && <p class="hint center">未取得动作感测权限，请改用下方按钮。</p>}
              <p class="hint center">
                {motionOn && motionActive ? '握紧手机上下摇动，或按住下方按钮' : '按住下方按钮摇动签筒'}
              </p>
              <button
                class="btn primary big hold"
                onPointerDown={startHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                onContextMenu={(e) => e.preventDefault()}
              >
                按住摇签
              </button>
            </>
          )}

          {step === 'confirm' && qian && (
            <>
              <div class="stick-card">
                <span class="stick-no">第{cnNumber(qian.no)}签</span>
                <span class="stick-gz">{qian.ganzhi}</span>
              </div>
              <p class="hint center">
                {needed === 1 ? '掷出一个圣筊，即是神明所赐之签。' : `需连续掷出三个圣筊，才算数。`}
              </p>
              {needed > 1 && (
                <div class="dots" aria-label={`已掷出 ${confirmCount} 个圣筊`}>
                  {Array.from({ length: needed }, (_, i) => <i key={i} class={i < confirmCount ? 'on' : ''} />)}
                </div>
              )}
              <JiaoThrow key={`c${attempt}`} onResult={onConfirm} disabled={confirmFail !== null || confirmCount >= needed} label={confirmCount ? `再掷（第 ${confirmCount + 1} 次）` : '掷筊确认'} />
              {confirmCount >= needed && <p class="verdict good center"><b>圣筊！</b>就是这支签。</p>}
              {confirmFail && (
                <div class="verdict bad">
                  <p>
                    <b>{JIAO_LABEL[confirmFail]}。</b>
                    这支签不是神明要给的，请放回签筒重新抽一支。
                  </p>
                  <button class="btn primary big" onClick={putBack}>放回签筒重抽</button>
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
          <p class="hint center">已自动存入签本，日后可标记是否应验。</p>
          <div class="actions">
            <button class="btn primary big" onClick={props.onOpenJournal}>查看签本</button>
            <button class="btn ghost big" onClick={restart}>再求一签</button>
          </div>
        </>
      )}

      <Footer />
    </section>
  );
}

import { useEffect, useMemo, useState } from 'preact/hooks';
import { ProfileForm } from './components/ProfileForm';
import { Footer, Icon } from './components/ui';
import { setSoundEnabled } from './lib/audio';
import { dailyFortune } from './lib/fortune';
import { setVibrateEnabled } from './lib/haptics';
import { computeBazi, dateKey, getDayInfo } from './lib/lunar';
import {
  type Backup,
  type JournalEntry,
  type Profile,
  type Settings as S,
  clearAll,
  loadJournal,
  loadProfile,
  loadSettings,
  saveJournal,
  saveProfile,
  saveSettings,
} from './lib/storage';
import { Draw } from './screens/Draw';
import { Home } from './screens/Home';
import { Journal } from './screens/Journal';
import { Settings } from './screens/Settings';

type Tab = 'home' | 'draw' | 'journal' | 'settings';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: '今日', icon: 'today' },
  { id: 'draw', label: '求签', icon: 'draw' },
  { id: 'journal', label: '签本', icon: 'book' },
  { id: 'settings', label: '设置', icon: 'settings' },
];

// 启动时外层（例如预览连结的检视器）可能已设置 data-theme，“跟随系统”时还原它
const hostTheme = document.documentElement.dataset.theme;

function applyTheme(pref: S['theme']) {
  const root = document.documentElement;
  if (pref === 'system') {
    if (hostTheme) root.dataset.theme = hostTheme;
    else delete root.dataset.theme;
  } else root.dataset.theme = pref;
  const effective = pref === 'system' ? hostTheme : pref;
  const dark = effective ? effective === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1310' : '#9e2a20');
}

export function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [settings, setSettings] = useState<S>(loadSettings);
  const [journal, setJournal] = useState<JournalEntry[]>(loadJournal);
  const [tab, setTab] = useState<Tab>('home');
  const [now, setNow] = useState(() => new Date());

  // 主题、音效、震动
  useEffect(() => {
    applyTheme(settings.theme);
    setSoundEnabled(settings.sound);
    setVibrateEnabled(settings.vibrate);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme(settings.theme);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [settings]);

  // 跨日时自动更新（回到前景或每分钟检查）
  useEffect(() => {
    const tick = () => setNow((old) => (dateKey(old) === dateKey(new Date()) ? old : new Date()));
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const todayKey = dateKey(now);
  const day = useMemo(() => getDayInfo(now), [todayKey]);
  const bazi = useMemo(() => (profile ? computeBazi(profile.birth) : null), [profile]);
  const fortune = useMemo(
    () => (profile && bazi ? dailyFortune(bazi, day, `${profile.nickname}|${profile.birth.y}${profile.birth.m}${profile.birth.d}`) : null),
    [profile, bazi, day],
  );

  const switchTab = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  const updateSettings = (s: S) => {
    setSettings(s);
    saveSettings(s);
  };
  const updateJournal = (j: JournalEntry[]) => {
    setJournal(j);
    saveJournal(j);
  };

  if (!profile || !bazi || !fortune) {
    return (
      <div class="app onboarding">
        <div class="hero">
          <div class="hero-seal">签</div>
          <h1>今日一签</h1>
          <p>每日运势・掷筊求签</p>
        </div>
        <div class="card">
          <h2 class="card-title">初次见面，先认识你</h2>
          <p class="hint">输入昵称与生日，就能算出你的日主与生肖，提供每日运势。之后可在设置中修改。</p>
          <ProfileForm
            submitLabel="开始使用"
            onSubmit={(p) => {
              saveProfile(p);
              setProfile(p);
            }}
          />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div class="app">
      <main>
        <div hidden={tab !== 'home'}>
          <Home profile={profile} bazi={bazi} day={day} fortune={fortune} onDraw={() => switchTab('draw')} />
        </div>
        <div hidden={tab !== 'draw'}>
          <Draw
            active={tab === 'draw'}
            profile={profile}
            bazi={bazi}
            day={day}
            fortune={fortune}
            settings={settings}
            onSave={(e) => updateJournal([e, ...journal])}
            onOpenJournal={() => switchTab('journal')}
          />
        </div>
        {tab === 'journal' && (
          <Journal
            journal={journal}
            onUpdate={(id, patch) => updateJournal(journal.map((e) => (e.id === id ? { ...e, ...patch } : e)))}
            onDelete={(id) => updateJournal(journal.filter((e) => e.id !== id))}
            onDraw={() => switchTab('draw')}
          />
        )}
        {tab === 'settings' && (
          <Settings
            profile={profile}
            settings={settings}
            onProfile={(p) => {
              saveProfile(p);
              setProfile(p);
            }}
            onSettings={updateSettings}
            onImport={(b: Backup) => {
              if (b.profile) {
                saveProfile(b.profile);
                setProfile(b.profile);
              }
              updateSettings({ ...settings, ...b.settings });
              updateJournal(b.journal);
            }}
            onClear={() => {
              clearAll();
              setJournal([]);
              setSettings(loadSettings());
              setProfile(null);
              setTab('home');
            }}
          />
        )}
      </main>
      <nav class="tabbar" aria-label="主菜单">
        {TABS.map((t) => (
          <button key={t.id} class={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => switchTab(t.id)}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

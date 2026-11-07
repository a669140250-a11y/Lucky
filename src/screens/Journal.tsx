import { useState } from 'preact/hooks';
import { QianView } from '../components/QianView';
import { Footer, GradeSeal, Icon, ScreenHeader } from '../components/ui';
import { cnNumber, getQian } from '../lib/qian';
import { type JournalEntry, type Outcome, categoryLabel } from '../lib/storage';

const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: 'pending', label: '未定' },
  { id: 'yes', label: '应验' },
  { id: 'no', label: '未应验' },
];

interface Props {
  journal: JournalEntry[];
  onUpdate: (id: string, patch: Partial<JournalEntry>) => void;
  onDelete: (id: string) => void;
  onDraw: () => void;
}

export function Journal({ journal, onUpdate, onDelete, onDraw }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [askDelete, setAskDelete] = useState<string | null>(null);
  const list = [...journal].sort((a, b) => b.ts - a.ts);
  const yes = journal.filter((j) => j.outcome === 'yes').length;
  const no = journal.filter((j) => j.outcome === 'no').length;

  return (
    <section class="screen-body">
      <ScreenHeader
        title="签本"
        sub={journal.length ? `共 ${journal.length} 签・应验 ${yes}・未应验 ${no}` : '每次求签都会自动记在这里'}
      />

      {list.length === 0 && (
        <div class="card empty">
          <p>还没有求过签。</p>
          <button class="btn primary" onClick={onDraw}>去求第一支签</button>
        </div>
      )}

      {list.map((e) => {
        const expanded = open === e.id;
        const time = new Date(e.ts);
        return (
          <article class="card entry" key={e.id}>
            <header class="entry-head">
              <div>
                <p class="entry-date">
                  {e.solarText} {String(time.getHours()).padStart(2, '0')}:{String(time.getMinutes()).padStart(2, '0')}
                </p>
                <p class="entry-sub">农历{e.lunarText}・{e.dayGz}日</p>
              </div>
              <GradeSeal grade={e.grade} size="sm" />
            </header>
            <p class="entry-q">
              <span class="tag">{categoryLabel(e.category)}</span>
              {e.question || <span class="muted">（未填写问题）</span>}
            </p>
            <button class="entry-qian" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : e.id)}>
              <b>第{cnNumber(e.qianNo)}签</b>　{e.qianGz}
              <span class="muted">{expanded ? '收起' : '看签诗'}</span>
              <Icon name="chevron" size={18} />
            </button>
            {expanded && <QianView qian={getQian(e.qianNo)} category={e.category} compact />}

            <div class="seg" role="radiogroup" aria-label="是否应验">
              {OUTCOMES.map((o) => (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={e.outcome === o.id}
                  class={`seg-btn ${o.id} ${e.outcome === o.id ? 'on' : ''}`}
                  onClick={() => onUpdate(e.id, { outcome: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <NoteField value={e.note} onSave={(note) => onUpdate(e.id, { note })} />
            <div class="entry-foot">
              {askDelete === e.id ? (
                <div class="confirm-inline" role="group" aria-label="确认删除">
                  <span>删除这笔纪录？</span>
                  <button class="link" onClick={() => setAskDelete(null)}>取消</button>
                  <button class="link danger strong" onClick={() => { onDelete(e.id); setAskDelete(null); }}>
                    确定删除
                  </button>
                </div>
              ) : (
                <button class="link danger" onClick={() => setAskDelete(e.id)}>
                  <Icon name="trash" size={16} /> 删除
                </button>
              )}
            </div>
          </article>
        );
      })}

      <Footer />
    </section>
  );
}

function NoteField(props: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(props.value);
  const [saved, setSaved] = useState(false);
  const dirty = v !== props.value;
  return (
    <label class="field note">
      <span>备注</span>
      <textarea
        rows={2}
        maxLength={500}
        value={v}
        placeholder="后来的发展、心得…"
        onInput={(e) => { setV((e.target as HTMLTextAreaElement).value); setSaved(false); }}
        onBlur={() => { if (dirty) { props.onSave(v); setSaved(true); } }}
      />
      {saved && <small class="hint">已保存</small>}
    </label>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import {
  CalendarCheck,
  Check,
  Layers3,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
} from 'lucide-react';

type ActionKind = 'hunt' | 'battle' | 'daily' | 'collection';
type Activity = { id: string; kind: ActionKind; amount: number; createdAt: number };
type AppData = {
  name: string;
  counts: Record<ActionKind, number>;
  history: Activity[];
  unlocked: Record<string, number>;
};

const STORAGE_KEY = 'etm-achievements-v1';
const ACTIONS: { kind: ActionKind; label: string; description: string; icon: typeof Target }[] = [
  { kind: 'hunt', label: 'Lượt săn', description: 'Ghi nhận lượt săn', icon: Target },
  { kind: 'battle', label: 'Trận thắng', description: 'Ghi nhận trận thắng', icon: Swords },
  { kind: 'daily', label: 'Điểm danh', description: 'Ghi nhận điểm danh', icon: CalendarCheck },
  { kind: 'collection', label: 'Sưu tầm', description: 'Thêm vào bộ sưu tập', icon: Layers3 },
];
const ACHIEVEMENTS = [
  { id: 'first-hunt', title: 'Bước chân đầu tiên', description: 'Ghi lại lượt săn đầu tiên của bạn.', kind: 'hunt' as const, goal: 1, mark: '01' },
  { id: 'hunter-10', title: 'Thợ săn bền bỉ', description: 'Tự ghi nhận 10 lượt săn.', kind: 'hunt' as const, goal: 10, mark: '10' },
  { id: 'first-win', title: 'Chiến thắng đầu tay', description: 'Ghi lại trận thắng đầu tiên.', kind: 'battle' as const, goal: 1, mark: 'W' },
  { id: 'win-5', title: 'Vững tay chiến đấu', description: 'Đạt 5 trận thắng được ghi nhận.', kind: 'battle' as const, goal: 5, mark: '05' },
  { id: 'daily-7', title: 'Hẹn gặp mỗi ngày', description: 'Ghi nhận 7 lần điểm danh.', kind: 'daily' as const, goal: 7, mark: '7D' },
  { id: 'collector-5', title: 'Người gom chuyện hay', description: 'Thêm 5 món vào bộ sưu tập.', kind: 'collection' as const, goal: 5, mark: '05' },
];

const emptyData: AppData = {
  name: '',
  counts: { hunt: 0, battle: 0, daily: 0, collection: 0 },
  history: [],
  unlocked: {},
};

function loadData(): AppData {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<AppData> | null;
    if (!parsed) return emptyData;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      counts: {
        hunt: Number(parsed.counts?.hunt) || 0,
        battle: Number(parsed.counts?.battle) || 0,
        daily: Number(parsed.counts?.daily) || 0,
        collection: Number(parsed.counts?.collection) || 0,
      },
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 80) : [],
      unlocked: parsed.unlocked && typeof parsed.unlocked === 'object' ? parsed.unlocked : {},
    };
  } catch {
    return emptyData;
  }
}

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(timestamp);

function Home() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [selected, setSelected] = useState<ActionKind>('hunt');
  const [amount, setAmount] = useState(1);
  const [draftName, setDraftName] = useState(data.name);
  const [editingName, setEditingName] = useState(!data.name);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const total = useMemo(() => Object.values(data.counts).reduce((sum, count) => sum + count, 0), [data.counts]);
  const unlockedCount = useMemo(() => ACHIEVEMENTS.filter(item => data.counts[item.kind] >= item.goal).length, [data.counts]);

  const recordAction = () => {
    const safeAmount = Math.max(1, Math.min(999, Math.floor(amount) || 1));
    const now = Date.now();
    const nextCounts = { ...data.counts, [selected]: data.counts[selected] + safeAmount };
    const nextUnlocks = { ...data.unlocked };
    const newlyUnlocked = ACHIEVEMENTS.filter(item =>
      !nextUnlocks[item.id] && nextCounts[item.kind] >= item.goal
    );
    newlyUnlocked.forEach(item => { nextUnlocks[item.id] = now; });
    setData(current => ({
      ...current,
      counts: nextCounts,
      unlocked: nextUnlocks,
      history: [{ id: `${now}-${Math.random().toString(36).slice(2, 7)}`, kind: selected, amount: safeAmount, createdAt: now }, ...current.history].slice(0, 80),
    }));
    setAmount(1);
    setNotice(newlyUnlocked.length ? `Mở khóa thành tựu: ${newlyUnlocked[0].title}` : 'Đã ghi lại tiến trình của bạn.');
  };

  const saveName = () => {
    const name = draftName.trim().slice(0, 24);
    setData(current => ({ ...current, name }));
    setDraftName(name);
    setEditingName(false);
    setNotice(name ? 'Đã cập nhật tên hiển thị.' : 'Tên hiển thị đã được xóa.');
  };

  const resetProgress = () => {
    const fresh = { ...emptyData };
    setData(fresh);
    setDraftName('');
    setEditingName(true);
    setConfirmReset(false);
    setNotice('Tiến trình đã được đặt lại.');
  };

  const latestAchievement = [...ACHIEVEMENTS]
    .filter(item => data.counts[item.kind] >= item.goal)
    .sort((a, b) => (data.unlocked[b.id] || 0) - (data.unlocked[a.id] || 0))[0];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" data-testid="brand-etm"><span className="brand-mark">ETM</span><span>Thành tựu của tôi</span></div>
        <div className="top-note"><span className="status-dot" />Bảng theo dõi cá nhân</div>
      </header>

      <div className="page">
        <section className="hero">
          <div>
            <div className="eyebrow"><Sparkles size={13} strokeWidth={2.5} /> Nhật ký hành trình OWO</div>
            <h1 className="hero-title">Mỗi dấu mốc<br />là một <em>chiến tích.</em></h1>
            <p className="hero-copy">Tự ghi lại những gì bạn đã làm, rồi nhìn hành trình nhỏ của mình dần đầy lên. Thành tựu ở đây được mở khóa từ những dấu mốc bạn chủ động nhập.</p>
          </div>
          <div className="hero-art" aria-label="Minh họa hành trình thành tựu">
            <span className="orbit" /><span className="orbit two" /><span className="orbit three" />
            <span className="spark s1" /><span className="spark s2" />
            <div className="art-core"><strong>{latestAchievement ? 'Đang tiến bước' : 'Bắt đầu hành trình'}</strong><span>{unlockedCount} / {ACHIEVEMENTS.length} thành tựu</span></div>
          </div>
        </section>

        <section aria-label="Tổng quan tiến trình">
          <div className="metrics">
            <Metric label="Tổng dấu mốc" value={total} detail="lần đã ghi" />
            <Metric label="Lượt săn" value={data.counts.hunt} detail="được tự ghi nhận" />
            <Metric label="Trận thắng" value={data.counts.battle} detail="được tự ghi nhận" />
            <Metric label="Đã mở khóa" value={unlockedCount} detail={`trên ${ACHIEVEMENTS.length} thành tựu`} />
          </div>
        </section>

        <div className="content-grid">
          <div>
            <section className="panel" aria-labelledby="record-heading">
              <div className="panel-head">
                <div><h2 className="panel-title" id="record-heading">Ghi lại dấu mốc</h2><div className="panel-kicker">Chọn hoạt động bạn vừa hoàn thành</div></div>
                <span className="eyebrow"><Plus size={13} /> Thủ công</span>
              </div>
              <div className="record-body">
                <div className="action-grid" role="group" aria-label="Chọn loại dấu mốc">
                  {ACTIONS.map(({ kind, label, description, icon: Icon }) => (
                    <button key={kind} type="button" className={`action-choice ${selected === kind ? 'selected' : ''}`} onClick={() => setSelected(kind)} aria-pressed={selected === kind} aria-label={description} data-testid={`select-action-${kind}`}>
                      <span className="action-glyph"><Icon size={15} strokeWidth={2.2} /></span><span className="action-name">{label}</span>
                    </button>
                  ))}
                </div>
                <div className="record-controls">
                  <div className="stepper" aria-label="Số lượng">
                    <button type="button" onClick={() => setAmount(value => Math.max(1, value - 1))} aria-label="Giảm số lượng" data-testid="button-decrease-count">−</button>
                    <input type="number" min="1" max="999" value={amount} onChange={event => setAmount(Math.max(1, Math.min(999, Number(event.target.value) || 1)))} aria-label="Số lần cần ghi" data-testid="input-action-count" />
                    <button type="button" onClick={() => setAmount(value => Math.min(999, value + 1))} aria-label="Tăng số lượng" data-testid="button-increase-count">+</button>
                  </div>
                  <button type="button" className="primary-button" onClick={recordAction} data-testid="button-record-action"><Plus size={15} /> Ghi dấu mốc</button>
                </div>
                <p className="record-hint">Tiến trình chỉ thay đổi khi bạn chủ động ghi lại. Không có kết nối hay thao tác tự động với OWO.</p>
              </div>
            </section>

            <section className="achievements-section" aria-labelledby="achievements-heading">
              <div className="section-heading">
                <div><h2 id="achievements-heading">Bộ sưu tập thành tựu</h2><p>Những cột mốc do ETM tuyển chọn, mở khóa theo nhật ký của bạn.</p></div>
                <span className="mono" style={{ color: '#758378', fontSize: 11 }}>{unlockedCount} / {ACHIEVEMENTS.length} đã đạt</span>
              </div>
              <div className="achievement-grid">
                {ACHIEVEMENTS.map(item => {
                  const progress = Math.min(data.counts[item.kind], item.goal);
                  const isUnlocked = progress >= item.goal;
                  const Icon = isUnlocked ? Trophy : ShieldCheck;
                  return (
                    <article className={`achievement-card ${isUnlocked ? 'unlocked' : ''}`} key={item.id} data-testid={`achievement-${item.id}`}>
                      <div className="achievement-top"><span className="achievement-stamp"><Icon size={17} /></span><span className="badge-tag">{isUnlocked ? 'ĐÃ MỞ' : 'ĐANG THEO ĐUỔI'}</span></div>
                      <h3 className="achievement-name">{item.title}</h3>
                      <p className="achievement-desc">{item.description}</p>
                      <div className="progress-line" aria-label={`Tiến độ ${progress} trên ${item.goal}`}><span style={{ width: `${Math.max(isUnlocked ? 100 : 0, (progress / item.goal) * 100)}%` }} /></div>
                      <div className="progress-copy"><span>{isUnlocked ? 'Hoàn thành' : 'Tiến độ'}</span><span>{progress} / {item.goal}</span></div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="side-stack">
            <section className="panel" aria-labelledby="profile-heading">
              <div className="panel-head"><div><h2 className="panel-title" id="profile-heading">Góc của bạn</h2><div className="panel-kicker">Chỉ lưu trên thiết bị này</div></div><span className="achievement-stamp"><Pencil size={15} /></span></div>
              <div className="profile-content">
                {editingName ? (
                  <form onSubmit={event => { event.preventDefault(); saveName(); }}>
                    <label htmlFor="display-name" className="metric-label">Tên hiển thị</label>
                    <div className="name-row" style={{ marginTop: 7 }}>
                      <input id="display-name" value={draftName} onChange={event => setDraftName(event.target.value)} maxLength={24} placeholder="Tên bạn muốn dùng" data-testid="input-display-name" />
                      <button className="icon-button" type="submit" aria-label="Lưu tên hiển thị" data-testid="button-save-name"><Save size={15} /></button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div className="metric-label">Tên hiển thị</div>
                    <div className="name-row" style={{ marginTop: 7 }}>
                      <div className="name-display" data-testid="text-display-name">{data.name || 'Người chơi OWO'}</div>
                      <button type="button" className="icon-button" onClick={() => { setDraftName(data.name); setEditingName(true); }} aria-label="Chỉnh sửa tên hiển thị" data-testid="button-edit-name"><Pencil size={15} /></button>
                    </div>
                  </div>
                )}
                <p className="profile-note">Xin chào{data.name ? `, ${data.name}` : ''}. Hành trình này là của riêng bạn.</p>
                <button type="button" className="reset-button" onClick={() => setConfirmReset(true)} data-testid="button-open-reset"><RotateCcw size={13} /> Đặt lại toàn bộ tiến trình</button>
              </div>
            </section>

            <section className="panel" aria-labelledby="activity-heading">
              <div className="panel-head"><div><h2 className="panel-title" id="activity-heading">Dấu mốc gần đây</h2><div className="panel-kicker">Nhật ký ghi nhận của bạn</div></div><span className="mono" style={{ fontSize: 10, color: '#829087' }}>{data.history.length} MỤC</span></div>
              <div className="activity-list" data-testid="list-recent-activity">
                {data.history.length ? data.history.slice(0, 6).map(entry => {
                  const action = ACTIONS.find(item => item.kind === entry.kind)!;
                  const Icon = action.icon;
                  return <div className="activity-row" key={entry.id} data-testid={`activity-${entry.id}`}>
                    <span className="activity-icon"><Icon size={14} /></span>
                    <span className="activity-info"><span className="activity-title">{action.label}</span><span className="activity-time">{formatDate(entry.createdAt)}</span></span>
                    <span className="activity-count">+{entry.amount}</span>
                  </div>;
                }) : <div className="empty-activity" data-testid="empty-activity">Chưa có dấu mốc nào.<br />Bắt đầu bằng một lượt bạn vừa hoàn thành.</div>}
              </div>
            </section>
          </aside>
        </div>

        <footer className="footnote"><span><strong>ETM Achievements</strong> là công cụ theo dõi cá nhân do cộng đồng tạo ra, không phải sản phẩm chính thức của OWO.</span></footer>
      </div>

      {notice && <div className="notice" role="status" data-testid="status-notice"><Check size={14} style={{ verticalAlign: 'middle', marginRight: 7 }} />{notice}</div>}
      {confirmReset && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmReset(false); }}>
        <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" data-testid="dialog-reset-confirm">
          <h3 id="reset-title">Bắt đầu lại từ đầu?</h3>
          <p>Tên hiển thị, các bộ đếm, nhật ký và thành tựu đã mở khóa sẽ bị xóa khỏi thiết bị này. Thao tác này không thể hoàn tác.</p>
          <div className="modal-actions">
            <button type="button" className="quiet-button" onClick={() => setConfirmReset(false)} data-testid="button-cancel-reset">Giữ tiến trình</button>
            <button type="button" className="danger-button" onClick={resetProgress} data-testid="button-confirm-reset">Xóa tiến trình</button>
          </div>
        </section>
      </div>}
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="metric" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><div className="metric-sub">{detail}</div></div>;
}

const queryClient = new QueryClient();
function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;

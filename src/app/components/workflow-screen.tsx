'use client';
import { useEffect, useState } from 'react';
import { Archive, ArrowLeft, Bell, BookOpen, Check, Download, FolderOpen, LoaderCircle, LogOut, Menu, Palette, Plus, Search, Wrench } from 'lucide-react';
import { type Task, canAssignCategory, reportCsv } from '@/lib/domain';
import { type Notice, type WorkflowState, categoryLabels, workflowState, workflowStates } from '@/lib/workflow';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Board, StateRail, TaskList } from './board';
import { Avatar, ConfirmAction, EmptyState, Panel, type Props, formatDate, paths } from './screen-kit';
import { TaskDetail } from './task-detail';

export type { Props } from './screen-kit';

const nav: [string, string][] = [['/', 'Ana sayfa'], ['/islerim', 'İşlerim'], ['/actiklarim', 'Açtıklarım'], ['/raporlar', 'Raporlar'], ['/ekip', 'Ekip']];

const departments = [
  { slug: 'teknik', title: 'Teknik Destek', desc: 'Site, sunucu, alan adı ve hata bildirimleri.', Icon: Wrench },
  { slug: 'grafik', title: 'Grafik Tasarım', desc: 'Banner, sosyal medya, katalog ve revizeler.', Icon: Palette },
  { slug: 'diger', title: 'Diğer Talepler', desc: 'Ekip içi bilgi, onay ve koordinasyon işleri.', Icon: FolderOpen },
] as const;

const subtitles: Record<string, string> = {
  '/islerim': 'Sana atanan işler.',
  '/actiklarim': 'Senin açtığın talepler.',
  '/talepler': 'Ekibin bütün açık işleri.',
  '/arsiv': 'Tamamlanan ve iptal edilen işler burada saklanır. Geri almak için işi açıp “Arşivden çıkar”a bas.',
  '/raporlar': 'Tarih aralığı seç, özeti gör, CSV olarak indir. Arşivdeki işler de dahildir.',
  '/ekip': 'Ekipteki herkes ve bölüm sorumlulukları.',
  '/kayitlar': 'Talep, yorum, dosya ve kullanıcı işlemlerinin kaydı.',
  '/bildirimler': 'Sana yazılan yorumlar ve atamalar.',
  '/nasil-yapilir': 'Ekibin yazdığı adım adım rehberler.',
};

export default function WorkflowScreen(p: Props) {
  const [route, setRoute] = useState('/'), [search, setSearch] = useState(''), [filter, setFilter] = useState('Tümü'), [layout, setLayout] = useState('board'), [priority, setPriority] = useState('Tümü'), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const read = () => setRoute(window.location.pathname); read(); window.addEventListener('popstate', read); return () => window.removeEventListener('popstate', read); }, []);
  function go(path: string) { window.history.pushState(null, '', path); setRoute(new URL(path, window.location.origin).pathname); setSearch(''); setFilter('Tümü'); setPriority('Tümü'); setMenuOpen(false); window.scrollTo({ top: 0 }); }
  useEffect(() => { const id = new URLSearchParams(location.search).get('yorum'); if (id) { const timer = setTimeout(() => { const el = document.getElementById('yorum-' + id); el?.classList.add('wf-highlight'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150); return () => clearTimeout(timer); } }, [route, p.data.messages.length]);
  const taskPath = (t: Task) => '/talep/' + t.id;
  const notices = p.notices.filter(n => n.recipient_id === p.person.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const unread = notices.filter(n => !n.read_at);
  async function openNotice(n: Notice) { if (await p.onRead([n.id])) { go('/talep/' + n.task_id + (n.message_id ? '?yorum=' + n.message_id : '')); if (n.message_id) setTimeout(() => document.getElementById('yorum-' + n.message_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200); } }
  const category = paths[route.split('/')[2]];
  const selected = p.data.tasks.find(t => route === '/talep/' + t.id);
  const guide = p.guides.find(g => route === '/rehber/' + g.id);
  // Yeni talep penceresi açıkken (/yeni) arkada ana sayfa görünür.
  const home = route === '/' || route === '/yeni', reports = route === '/raporlar', team = route === '/ekip', logs = route === '/kayitlar', notifications = route === '/bildirimler', guides = route === '/nasil-yapilir';
  const mine = route === '/islerim', created = route === '/actiklarim', archive = route === '/arsiv';
  const listing = !!category || mine || created || archive || route === '/talepler' || reports;
  // Raporlar arşivi de kapsar; arşiv sayfası yalnızca arşivi, diğer ekranlar yalnızca açık panoyu gösterir.
  const inScope = (t: Task) => (!category || t.category === category) && (!mine || t.assignee_id === p.person.id) && (!created || t.creator_id === p.person.id) && (reports || (archive ? !!t.archived_at : !t.archived_at));
  const tasks = p.data.tasks.filter(t => inScope(t) && (filter === 'Tümü' || workflowState(t) === filter) && (priority === 'Tümü' || t.priority === priority) && (`${t.title} ${t.brand} ${t.number}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))) && (!reports || ((!from || t.created_at.slice(0, 10) >= from) && (!to || t.created_at.slice(0, 10) <= to))));
  const titles: Record<string, string> = { '/islerim': 'İşlerim', '/actiklarim': 'Açtıklarım', '/arsiv': 'Arşiv', '/talepler': 'Tüm talepler', '/raporlar': 'Raporlar', '/ekip': 'Ekip', '/kayitlar': 'Denetim kayıtları', '/bildirimler': 'Bildirimler', '/nasil-yapilir': 'Nasıl yapılır' };
  const events = [...p.data.events, ...p.data.tasks.filter(t => !p.data.events.some(e => e.task_id === t.id && e.action === 'Talep oluşturuldu')).map(t => ({ id: 'created-' + t.id, task_id: t.id, actor_id: t.creator_id, action: 'Talep oluşturuldu', details: t.title, created_at: t.created_at }))].sort((a, b) => b.created_at.localeCompare(a.created_at));
  function saveCsv() { const url = URL.createObjectURL(new Blob([reportCsv(tasks, p.data.profiles)], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'akis-rapor.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  const counts = Object.fromEntries(workflowStates.map(s => [s, p.data.tasks.filter(t => inScope(t) && workflowState(t) === s).length])) as Record<WorkflowState, number>;
  const archivedCount = p.data.tasks.filter(t => t.archived_at && (!category || t.category === category) && (!mine || t.assignee_id === p.person.id) && (!created || t.creator_id === p.person.id)).length;
  const firstName = p.person.name.split(' ')[0];
  const title = selected ? selected.title : guide ? guide.title : category ? categoryLabels[category] : titles[route] ?? 'Sayfa bulunamadı';
  const subtitle = selected ? `#${selected.number}, ${selected.brand}` : category ? departments.find(d => paths[d.slug] === category)?.desc : subtitles[route];

  const noticeRow = (n: Notice) => (
    <li key={n.id}>
      <button
        type="button" onClick={() => openNotice(n)}
        className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none"
      >
        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-primary')} />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm', !n.read_at && 'font-semibold')}>{n.body}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {p.data.tasks.find(t => t.id === n.task_id)?.title ?? 'Talep'}, {formatDate(n.created_at)}
          </span>
        </span>
      </button>
    </li>
  );

  const navLinks = (vertical: boolean) => nav.map(([path, label]) => (
    <a
      key={path} href={path} aria-current={route === path ? 'page' : undefined}
      onClick={e => { e.preventDefault(); go(path); }}
      className={cn(
        'text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        vertical
          ? cn('rounded-md px-3 py-2', route === path ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted')
          : cn('flex h-full items-center border-b-2 px-1', route === path ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'),
      )}
    >
      {label}
    </a>
  ));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-6 px-4 sm:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2 md:hidden" aria-label="Menüyü aç"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SheetTitle className="mb-4">Menü</SheetTitle>
              <nav className="flex flex-col gap-1">{navLinks(true)}</nav>
            </SheetContent>
          </Sheet>
          <a href="/" onClick={e => { e.preventDefault(); go('/'); }} className="shrink-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded">
            <img src="/logo.svg" alt="dijitaldesin" className="h-11 w-auto" />
          </a>
          <nav className="hidden h-full items-stretch gap-5 md:flex" aria-label="Ana menü">{navLinks(false)}</nav>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="relative" aria-label={`Bildirimler, ${unread.length} okunmamış`} onClick={() => go('/bildirimler')}>
              <Bell />
              {unread.length > 0 && (
                <span key={unread.length} className="motion-pop absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white">{unread.length}</span>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Hesap menüsü"><Avatar name={p.person.name} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block font-semibold">{p.person.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.person.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => p.onPassword(p.person)}>Şifremi değiştir</DropdownMenuItem>
                <DropdownMenuItem onSelect={p.onLogout}><LogOut /> Çıkış yap</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-4 pt-6 pb-16 sm:px-6">
        {p.demo && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--prio-high-line)] bg-[var(--prio-high-bg)] px-3 py-2 text-sm text-[var(--prio-high-ink)]">
            Örnek çalışma alanındasın. Veriler yalnızca bu tarayıcıda saklanır.
            <Select value={p.person.id} onValueChange={v => p.onUser(p.data.profiles.find(u => u.id === v)!)}>
              <SelectTrigger aria-label="Deneme kullanıcısı" size="sm" className="ml-auto w-44 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>{p.data.profiles.filter(u => u.active).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {p.error && <div className="motion-reveal mb-6 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive" role="alert">{p.error}</div>}

        <div key={route} className="motion-page">

        {home ? (
          <Home p={p} go={go} unread={unread} noticeRow={noticeRow} events={events} firstName={firstName} />
        ) : (
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              {selected ? (
                <Button
                  variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground"
                  onClick={() => go(selected.archived_at ? '/arsiv' : '/alan/' + (Object.keys(paths).find(k => paths[k] === selected.category) ?? 'diger'))}
                >
                  <ArrowLeft /> {selected.archived_at ? 'Arşive dön' : `${categoryLabels[selected.category]} panosu`}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground" onClick={() => go('/')}><ArrowLeft /> Ana sayfa</Button>
              )}
              <h1 className="text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{title}</h1>
              {subtitle && <p className="mt-2 max-w-[70ch] text-muted-foreground">{subtitle}</p>}
            </div>
            {!selected && !guide && (listing || guides) && (
              <Button size="lg" onClick={() => p.onCreate(category ?? 'Teknik İşlemler')}><Plus /> Yeni talep</Button>
            )}
          </div>
        )}

        {listing && (
          <>
            {reports && (
              <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
                <div className="grid gap-1.5"><Label htmlFor="from">Başlangıç</Label><Input id="from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" /></div>
                <div className="grid gap-1.5"><Label htmlFor="to">Bitiş</Label><Input id="to" type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" /></div>
                <Button variant="outline" onClick={saveCsv}><Download /> Raporu indir</Button>
                <dl className="ml-auto flex gap-6 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Talep</dt><dd className="font-semibold tabular-nums">{tasks.length}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Revize</dt><dd className="font-semibold tabular-nums">{tasks.reduce((n, t) => n + t.revision_count, 0)}</dd></div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Ortalama tamamlanma</dt>
                    <dd className="font-semibold tabular-nums">{(() => { const done = tasks.filter(t => t.completed_at); return done.length ? (done.reduce((n, t) => n + (Date.parse(t.completed_at!) - Date.parse(t.created_at)) / 86400000, 0) / done.length).toFixed(1) + ' gün' : 'Henüz yok'; })()}</dd>
                  </div>
                </dl>
              </div>
            )}
            {!archive && <StateRail counts={counts} filter={filter} onFilter={setFilter} />}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Talep ara" placeholder="Başlık, müşteri veya numara ara" value={search} onChange={e => setSearch(e.target.value)} className="bg-card pl-8" />
              </div>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger aria-label="Önceliğe göre filtrele" className="w-40 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tümü">Tüm öncelikler</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Yüksek">Yüksek</SelectItem>
                  <SelectItem value="Acil">Acil</SelectItem>
                </SelectContent>
              </Select>
              {!archive && (
                <div className="ml-auto inline-flex rounded-lg bg-secondary p-0.5" role="group" aria-label="Görünüm">
                  {[['board', 'Pano'], ['list', 'Liste']].map(([key, label]) => (
                    <button
                      key={key} type="button" aria-pressed={layout === key} onClick={() => setLayout(key)}
                      className={cn('rounded-md px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50', layout === key ? 'bg-card shadow-[0_0_0_1px_var(--border)]' : 'text-muted-foreground hover:text-foreground')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!archive && layout === 'board' && tasks.length > 0 && (
              <p className="mb-3 text-xs text-muted-foreground">Kartı başka sütuna sürükleyerek durumunu değiştir. Ayrıntılar için karta tıkla.</p>
            )}
            {!tasks.length
              ? <EmptyState>{archive ? 'Arşiv boş.' : search || priority !== 'Tümü' || filter !== 'Tümü' ? 'Bu filtrelerle eşleşen talep yok. Filtreleri temizlemeyi dene.' : 'Burada henüz talep yok. “Yeni talep” ile ilkini aç.'}</EmptyState>
              : layout === 'board' && !archive ? <Board tasks={tasks} p={p} open={t => go(taskPath(t))} /> : <TaskList tasks={tasks} profiles={p.data.profiles} open={task => go(taskPath(task))} />}
            {!archive && !reports && (
              <Button variant="ghost" className="mt-6 -ml-2 text-muted-foreground" onClick={() => go('/arsiv')}><Archive /> Arşivi aç ({archivedCount})</Button>
            )}
          </>
        )}

        {selected && <TaskDetail task={selected} p={p} go={go} />}

        {notifications && (
          <Panel
            className="max-w-3xl p-2"
            action={<Button variant="ghost" size="sm" className="mt-2 mr-2" disabled={p.busy || !unread.length} onClick={() => p.onRead(unread.map(n => n.id))}><Check /> Tümünü okundu işaretle</Button>}
          >
            {notices.length ? <ul>{notices.map(noticeRow)}</ul> : <p className="px-3 py-8 text-center text-sm text-muted-foreground">Henüz bildirim yok. Biri sana yorum yazınca ya da iş atayınca burada görünür.</p>}
          </Panel>
        )}

        {guides && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="grid content-start gap-3 sm:grid-cols-2">
              {p.guides.map(g => (
                <button
                  key={g.id} type="button" onClick={() => go('/rehber/' + g.id)}
                  className="rounded-xl border bg-card p-5 text-left transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <BookOpen className="size-5 text-primary" />
                  <h2 className="mt-3 text-lg font-semibold">{g.title}</h2>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{g.body}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{formatDate(g.created_at)}</p>
                </button>
              ))}
              {!p.guides.length && <div className="sm:col-span-2"><EmptyState>Henüz rehber yok. Bildiğin bir işi yanda adım adım yazarak ilkini ekle.</EmptyState></div>}
            </div>
            <GuideForm p={p} />
          </div>
        )}

        {guide && (
          <article className="max-w-3xl rounded-xl border bg-card p-6">
            <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground" onClick={() => go('/nasil-yapilir')}><ArrowLeft /> Tüm rehberler</Button>
            <p className="max-w-[70ch] leading-relaxed whitespace-pre-wrap">{guide.body}</p>
            <p className="mt-6 text-sm text-muted-foreground">{p.data.profiles.find(u => u.id === guide.author_id)?.name}, {formatDate(guide.created_at)}</p>
          </article>
        )}

        {team && <Team p={p} go={go} />}

        {logs && (
          <Panel className="max-w-4xl">
            {p.person.role === 'super_admin' ? (
              <ul className="divide-y">
                {p.data.logs.map(l => (
                  <li key={l.id} className="grid gap-1 py-3 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
                    <span className="text-sm font-semibold">{l.action}</span>
                    <span className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">{l.details}</span>
                    <span className="text-xs text-muted-foreground">{p.data.profiles.find(u => u.id === l.actor_id)?.name ?? 'Sistem'}, {formatDate(l.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Bu sayfayı yalnızca süper admin görebilir.</p>}
          </Panel>
        )}

        {!home && !listing && !selected && !guide && !guides && !team && !logs && !notifications && (
          <EmptyState>Bu sayfa bulunamadı. Üst menüden devam edebilirsin.</EmptyState>
        )}

        </div>

        <footer className="mt-16 border-t pt-4 text-xs text-muted-foreground">
          {p.demo ? 'Örnek veriler bu tarayıcıya kaydedilir.' : 'İşler ve bildirimler 30 saniyede bir kendiliğinden yenilenir.'}
        </footer>
      </main>

      <Toast message={p.toast} />
      {p.busy && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          <LoaderCircle className="size-3.5 animate-spin" /> Kaydediliyor
        </div>
      )}
    </div>
  );
}

function Home({ p, go, unread, noticeRow, events, firstName }: {
  p: Props; go: (path: string) => void; unread: Notice[]; noticeRow: (n: Notice) => React.ReactNode;
  events: { id: string; task_id: string; actor_id: string | null; action: string; details: string; created_at: string }[]; firstName: string;
}) {
  const myOpen = p.data.tasks.filter(t => t.assignee_id === p.person.id && !t.archived_at && workflowState(t) !== 'Tamamlandı');
  const stuck = myOpen.filter(t => workflowState(t) === 'Sorun Var').length;
  const sentence = myOpen.length === 0
    ? 'Üzerinde açık iş yok.'
    : `Üzerinde ${myOpen.length} açık iş var${stuck ? `, ${stuck} tanesinde sorun bildirildi` : ''}.`;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <section className="pt-4 pb-10">
          <p className="text-muted-foreground">Merhaba {firstName}.</p>
          <h1 className="mt-2 max-w-[18ch] text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">{sentence}</h1>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button size="lg" onClick={() => p.onCreate('Teknik İşlemler')}><Plus /> Yeni talep</Button>
            <Button size="lg" variant="outline" className="bg-card" onClick={() => go('/islerim')}>İşlerimi göster</Button>
          </div>
        </section>

        {unread.length > 0 && (
          <section className="mb-10">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">Sana gelenler</h2>
              <Button variant="link" size="sm" className="px-0" onClick={() => go('/bildirimler')}>Bütün bildirimler</Button>
            </div>
            <ul className="rounded-xl border bg-card p-1">{unread.slice(0, 3).map(noticeRow)}</ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-lg font-semibold">Bölümler</h2>
          <ul className="divide-y border-y">
            {departments.map(({ slug, title, desc, Icon }) => {
              const open = p.data.tasks.filter(t => t.category === paths[slug] && !t.archived_at && workflowState(t) !== 'Tamamlandı').length;
              return (
                <li key={slug} className="flex flex-wrap items-center gap-4 py-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-5" /></span>
                  <a
                    href={'/alan/' + slug} onClick={e => { e.preventDefault(); go('/alan/' + slug); }}
                    className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="block font-display text-lg font-semibold hover:underline">{title}</span>
                    <span className="block text-sm text-muted-foreground">{desc}</span>
                  </a>
                  <span className="text-sm text-muted-foreground tabular-nums"><span className="font-semibold text-foreground">{open}</span> açık iş</span>
                  <Button variant="outline" size="sm" className="bg-card" onClick={() => p.onCreate(paths[slug])}><Plus /> Talep aç</Button>
                </li>
              );
            })}
            <li className="flex flex-wrap items-center gap-4 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><BookOpen className="size-5" /></span>
              <a href="/nasil-yapilir" onClick={e => { e.preventDefault(); go('/nasil-yapilir'); }} className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <span className="block font-display text-lg font-semibold hover:underline">Nasıl yapılır</span>
                <span className="block text-sm text-muted-foreground">Ekibin yazdığı adım adım rehberler.</span>
              </a>
              <span className="text-sm text-muted-foreground tabular-nums"><span className="font-semibold text-foreground">{p.guides.length}</span> rehber</span>
            </li>
          </ul>
          <Button variant="link" className="mt-3 px-0" onClick={() => go('/talepler')}>Bütün açık talepleri gör</Button>
        </section>
      </div>

      <aside className="lg:pt-4">
        <h2 className="text-lg font-semibold">Ekibin son adımları</h2>
        {events.length ? (
          <ol className="mt-4 ml-1 border-l border-foreground/15 pl-5">
            {events.slice(0, 12).map(e => (
              <li key={e.id} className="relative pb-4">
                <span className="absolute top-2 -left-[25px] size-2 rounded-full border-2 border-background bg-primary" />
                <button type="button" onClick={() => go('/talep/' + e.task_id)} className="w-full rounded text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <span className="block text-xs text-muted-foreground">{e.action}</span>
                  <span className="block text-sm font-medium hover:underline [overflow-wrap:anywhere]">{p.data.tasks.find(t => t.id === e.task_id)?.title ?? e.details}</span>
                  <span className="block text-xs text-muted-foreground">{p.data.profiles.find(u => u.id === e.actor_id)?.name ?? 'Sistem'}, {formatDate(e.created_at)}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : <p className="mt-3 text-sm text-muted-foreground">İlk talep açılınca ekibin adımları burada görünür.</p>}
      </aside>
    </div>
  );
}

function Team({ p, go }: { p: Props; go: (path: string) => void }) {
  const admin = p.person.role === 'super_admin';
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {admin && <Button onClick={p.onAddUser}><Plus /> Kullanıcı ekle</Button>}
        <Button variant="outline" className="bg-card" onClick={() => p.onPassword(p.person)}>Şifremi değiştir</Button>
        {admin && <Button variant="ghost" className="ml-auto text-muted-foreground" onClick={() => go('/kayitlar')}>Denetim kayıtları</Button>}
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {p.data.profiles.map(u => (
          <li key={u.id} className={cn('flex flex-col rounded-xl border bg-card p-5', !u.active && 'bg-card/60')}>
            <div className="flex items-start gap-3">
              <Avatar name={u.name} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold">{u.name}</h3>
                <p className="text-sm text-muted-foreground">{u.team}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span className={cn('rounded-md px-1.5 py-px text-[11px] font-semibold', u.active ? 'bg-state-done/12 text-state-done' : 'bg-secondary text-muted-foreground')}>
                {u.active ? 'Aktif' : 'Erişim kapalı'}
              </span>
            </div>
            {admin && u.active && (
              <fieldset className="mt-4 rounded-lg bg-background p-3">
                <legend className="sr-only">Bölüm sorumlulukları</legend>
                <p className="mb-2 text-xs text-muted-foreground">Bu bölümlerin işleri atanabilir:</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox disabled={p.busy} checked={canAssignCategory(u, 'Teknik İşlemler')} onCheckedChange={c => p.onResponsibilities(u.id, c === true, canAssignCategory(u, 'Grafik İşlemleri'))} />
                    Yazılım destek
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox disabled={p.busy} checked={canAssignCategory(u, 'Grafik İşlemleri')} onCheckedChange={c => p.onResponsibilities(u.id, canAssignCategory(u, 'Teknik İşlemler'), c === true)} />
                    Grafik tasarım
                  </label>
                </div>
              </fieldset>
            )}
            {admin && u.role !== 'super_admin' && (
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                <Button variant="ghost" size="sm" onClick={() => p.onPassword(u)}>Şifre belirle</Button>
                {u.active ? (
                  <ConfirmAction
                    destructive
                    title={`${u.name} kullanıcısının erişimi kapatılsın mı?`}
                    description="Hesap silinmez; açtığı ve üstlendiği işler yerinde kalır. Erişimi istediğin zaman yeniden açabilirsin."
                    confirmLabel="Erişimi kapat"
                    onConfirm={() => p.onActive(u)}
                    trigger={<Button variant="ghost" size="sm" className="ml-auto text-destructive hover:bg-destructive/8 hover:text-destructive" disabled={p.busy}>Erişimi kapat</Button>}
                  />
                ) : (
                  <Button variant="ghost" size="sm" className="ml-auto" disabled={p.busy} onClick={() => p.onActive(u)}>Erişimi yeniden aç</Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GuideForm({ p }: { p: Props }) {
  const [title, setTitle] = useState(''), [body, setBody] = useState('');
  return (
    <form
      className="grid content-start gap-4 rounded-xl border bg-card p-5"
      onSubmit={async e => { e.preventDefault(); if (await p.onGuide(title, body)) { setTitle(''); setBody(''); } }}
    >
      <h2 className="text-lg font-semibold">Bir rehber yaz</h2>
      <div className="grid gap-2"><Label htmlFor="guide-title">Başlık</Label><Input id="guide-title" required minLength={3} maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="Örn. Meta pikseli nasıl kontrol edilir" /></div>
      <div className="grid gap-2"><Label htmlFor="guide-body">Adımlar</Label><Textarea id="guide-body" required minLength={10} maxLength={20000} rows={8} placeholder={'1. İlk adım\n2. İkinci adım'} value={body} onChange={e => setBody(e.target.value)} /></div>
      <Button type="submit" disabled={p.busy}>Rehberi yayımla</Button>
    </form>
  );
}

// Bildirim mesajı kapanırken metni korur ki aynı kenardan kayarak çıkabilsin.
function Toast({ message }: { message: string }) {
  const [text, setText] = useState(message);
  if (message && message !== text) setText(message);
  if (!text) return null;
  return (
    <div
      role="status" aria-live="polite" data-open={!!message}
      className="motion-toast fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm text-background shadow-lg"
    >
      <Check className="size-4" /> {text}
    </div>
  );
}

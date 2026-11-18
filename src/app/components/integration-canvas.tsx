'use client';
// Giriş ekranının sol tarafındaki entegrasyon tuvali (dashboard-intro'daki IntegrationCanvas'ın uyarlaması).
// framer-motion yerine CSS animasyonları kullanılır; renkler globals.css'teki --intro-* belirteçlerinden gelir (kaynakla birebir).
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { type LucideIcon, Megaphone, RefreshCw, Share2, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

type Side = 'left' | 'right';
type Group = { title: string; icon: LucideIcon; dot: string; items: string[] };

const groups: Group[] = [
  {
    title: 'E-Ticaret',
    icon: ShoppingBag,
    dot: 'bg-intro-violet',
    items: ['Ticimax', 'Ikas', 'Ideasoft', 'Shopify', 'Tsoft', 'Qukasoft', 'WooCommerce'],
  },
  { title: 'Sosyal Medya', icon: Share2, dot: 'bg-intro-pink', items: ['Instagram', 'TikTok'] },
  { title: 'Reklam & Analitik', icon: Megaphone, dot: 'bg-intro-sky', items: ['Meta Ads', 'Google Ads', 'GA4'] },
];
const leftGroups = groups.slice(0, 1);
const rightGroups = groups.slice(1);
const platformCount = groups.reduce((n, g) => n + g.items.length, 0);

type ColumnProps = {
  groups: Group[];
  side: Side;
  register: (name: string, side: Side) => (el: HTMLLIElement | null) => void;
  hovered: string | null;
  onHover: (name: string | null) => void;
};

function Column({ groups, side, register, hovered, onHover }: ColumnProps) {
  let order = 0;
  return (
    <div className="space-y-5">
      {groups.map(g => (
        <div key={g.title}>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-intro-ink/50">
            <g.icon className="size-3.5" aria-hidden />
            {g.title}
          </p>
          <ul className="space-y-1.5">
            {g.items.map(name => {
              const delay = (side === 'left' ? 100 : 200) + order++ * 50;
              return (
                <li
                  key={name}
                  ref={register(name, side)}
                  onPointerEnter={() => onHover(name)}
                  onPointerLeave={() => onHover(null)}
                  style={{ animationDelay: `${delay}ms` } as CSSProperties}
                  className={cn(
                    'canvas-node flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-intro-ink transition-[background-color,border-color,scale]',
                    side === 'left' ? 'canvas-from-left' : 'canvas-from-right',
                    hovered === name ? 'scale-[1.03] border-intro-ink/25 bg-intro-raised' : 'border-intro-line bg-intro-surface',
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', g.dot)} aria-hidden />
                  <span className="truncate">{name}</span>
                  <span className="ml-auto pl-2 text-[11px] font-normal text-intro-ok/80">Bağlı</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Platform düğümleri, ortadaki panele akan bağlantılarla birleşir.
export function IntegrationCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, { el: HTMLLIElement; side: Side }>());
  const [paths, setPaths] = useState<{ name: string; d: string }[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  const register = (name: string, side: Side) => (el: HTMLLIElement | null) => {
    if (el) nodes.current.set(name, { el, side });
    else nodes.current.delete(name);
  };

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // Giriş animasyonundaki transform'lar ölçümü bozmasın diye offset tabanlı konum.
    const box = (el: HTMLElement) => {
      let x = 0;
      let y = 0;
      for (let n: HTMLElement | null = el; n && n !== wrap; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      return { left: x, top: y, right: x + el.offsetWidth, height: el.offsetHeight };
    };
    const measure = () => {
      if (!hubRef.current) return;
      const hub = box(hubRef.current);
      const next: { name: string; d: string }[] = [];
      nodes.current.forEach(({ el, side }, name) => {
        const r = box(el);
        const x1 = side === 'left' ? r.right : r.left;
        const y1 = r.top + r.height / 2;
        const x2 = side === 'left' ? hub.left : hub.right;
        const y2 = hub.top + hub.height / 2;
        const mid = (x1 + x2) / 2;
        next.push({ name, d: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}` });
      });
      setPaths(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  return (
    // Sol panel genişliği ekrana göre değişir; düzen pencereye değil kapsayıcıya göre kurulur.
    <div className="@container w-full">
      <div ref={wrapRef} className="relative mx-auto max-w-4xl">
        <svg className="pointer-events-none absolute inset-0 hidden size-full @2xl:block" aria-hidden>
          {paths.map((p, i) => {
            const active = hovered === p.name;
            const dimmed = hovered !== null && !active;
            return (
              <g key={p.name}>
                <path
                  id={`canvas-link-${i}`}
                  d={p.d}
                  pathLength={1}
                  fill="none"
                  strokeWidth={1}
                  className="canvas-draw stroke-intro-ink/12"
                  style={{ animationDelay: `${400 + i * 50}ms` }}
                />
                <path
                  d={p.d}
                  fill="none"
                  strokeWidth={active ? 2 : 1.2}
                  className={cn(
                    'canvas-flow stroke-intro-link transition-opacity duration-300',
                    active ? 'opacity-100' : dimmed ? 'opacity-15' : 'opacity-55',
                  )}
                />
                <circle
                  r={active ? 3.5 : 2.5}
                  className={cn('fill-intro-ink motion-reduce:hidden', dimmed ? 'opacity-20' : 'opacity-90')}
                >
                  <animateMotion dur={`${2.4 + (i % 4) * 0.5}s`} begin={`${1.6 + i * 0.15}s`} repeatCount="indefinite">
                    <mpath href={`#canvas-link-${i}`} />
                  </animateMotion>
                </circle>
              </g>
            );
          })}
        </svg>

        <div className="relative grid gap-8 @2xl:grid-cols-[1fr_auto_1fr] @2xl:items-center @2xl:gap-12">
          <div className="order-2 @2xl:order-1">
            <Column groups={leftGroups} side="left" register={register} hovered={hovered} onHover={setHovered} />
          </div>

          <div ref={hubRef} className="canvas-hub relative order-1 mx-auto rounded-2xl border border-intro-line bg-intro-surface text-intro-ink @2xl:order-2">
            <div className="w-56 p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-intro-ink text-sm font-bold text-intro-night">d</span>
                <div>
                  <p className="text-sm font-semibold">Yönetim Paneli</p>
                  <p className="text-[11px] text-intro-ink/50">dashboard.dijitaldesin.com</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-intro-line bg-intro-raised px-3 py-2 text-xs">
                <span className="flex items-center gap-2 text-intro-ink/70">
                  <RefreshCw className="size-3.5 animate-[spin_3s_linear_infinite]" aria-hidden />
                  Otomatik senkron
                </span>
                <span className="font-semibold text-intro-ok">15 dk</span>
              </div>
              <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-intro-ink/50">
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-intro-ok-dot opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-intro-ok-dot" />
                </span>
                {platformCount} platform aktif
              </div>
            </div>
          </div>

          <div className="order-3">
            <Column groups={rightGroups} side="right" register={register} hovered={hovered} onHover={setHovered} />
          </div>
        </div>
      </div>
    </div>
  );
}

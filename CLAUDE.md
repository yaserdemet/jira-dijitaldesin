@AGENTS.md

# Akış — Ajans iş takip uygulaması

Trello tarzı, sade bir ajans iş panosu. Next.js 16 (App Router, React 19, TypeScript) + Supabase (Postgres, Auth, Storage).
Arayüz dili Türkçe; kod ve tanımlayıcılar İngilizce, kullanıcıya görünen her metin Türkçe.

## Komutlar

Yalnızca **npm** kullan (pnpm/yarn yok; `package-lock.json` tek kilit dosyası). Paketleri `--save-exact` ile tam sürümde ekle.

```sh
npm run dev        # http://127.0.0.1:3000
npm run typecheck  # tsc --noEmit
npm test           # node:test + tsx; veritabanı testleri PGlite üzerinde
npm run build
npm run temizle -- --deneme   # tamamlanmış işleri silme raporu (silmez)
```

`npm run temizle` canlı veritabanından tamamlanmış BÜTÜN işleri ve bağlı kayıtlarını kalıcı siler ("SIL" onayı ister). Kullanıcı açıkça istemedikçe yalnızca `--deneme` ile çalıştır. Yeni bir tablo `tasks`'a bağlanırsa `scripts/temizle.ts` silme sırasına ve ilgili teste ekle.

Bir işi bitmiş saymadan önce `typecheck`, `test` ve `build` geçmeli. Arayüz değişikliğini tarayıcıda gözle kontrol et.
Makinede RAM az: `next.config.ts` içindeki `experimental.cpus: 1` ayarını kaldırma (kaldırılınca derleme "Jest worker ... child process exceptions" ile çöker).

## Yapı

- `src/app/components/workspace.tsx` — veri katmanı: oturum, Supabase okuma/yazma, deneme modu, formlar (oluştur, kullanıcı ekle, şifre).
- `src/app/components/workflow-screen.tsx` — ekranlar: pano (sürükle-bırak, `@dnd-kit/core`), liste, detay, ekip, raporlar, arşiv. Yönlendirme `history.pushState` ile istemcide.
- `src/app/components/request-forms.ts` — bölümlere göre talep formu alanları.
- `src/lib/domain.ts` — tipler, zod şemaları, yetki yardımcıları (`canEdit`, `canManage`, `assignableProfiles`).
- `src/lib/workflow.ts` — 4 durumlu akış (`Bekliyor`, `Yapılıyor`, `Tamamlandı`, `Sorun Var`) ile veritabanı durumları arasındaki eşleme.
- `src/app/api/admin/users/route.ts` — service role anahtarıyla çalışan tek sunucu ucu (kullanıcı ekleme, şifre, erişim, bölüm sorumluları).
- `supabase/migrations/NNN_*.sql` — şema ve iş kuralları. `tests/database.test.ts` bunları sırayla uygular.

## İş kuralları (değiştirmeden önce sor)

- Onay adımı yok: sorumlu işi doğrudan Tamamlandı yapabilir.
- Revize yalnızca talep sahibi/süper admin tarafından, Yapılıyor veya Tamamlandı işe istenir.
- İptali yalnızca talebi açan veya süper admin yapar; iptal edilen iş arşive gider. Uygulamadan iş silinmez, yalnızca arşivlenir (toplu silme `npm run temizle`).
- Çalışan kalıcı silme (`delete_employee`, 007): giriş hesabı ve kişisel bilgiler silinir, profil satırı "Silinmiş kullanıcı" olarak kalır ki geçmiş bozulmasın; açık işlerden sorumluluk düşer. Süper admin ve kişinin kendisi silinemez. Silinenler (`deleted_at`) ekip listesinde görünmez.
- Bölümde işaretli sorumlu yoksa herkes atanabilir; varsa yalnızca işaretli sorumlular.
- Teslim tarihi yok (bilinçli olarak kaldırıldı).
- Yetki kuralları **hem** istemcide (kullanıcıya erken hata) **hem** veritabanında (asıl güvence: RLS + tetikleyiciler) uygulanır. Yalnızca istemcide kontrol yeterli değildir.

## Supabase ve migration kuralları

- Şema değişikliği her zaman yeni numaralı dosyayla: `supabase/migrations/00N_kisa_ad.sql`. Canlıya uygulanmış bir migration'ı düzenleme.
- Mümkünse tekrar çalıştırılabilir yaz (`if exists`, `create or replace`). Tetikleyici fonksiyonlarında `security definer set search_path = ''` kullan.
- Her yeni kural için `tests/database.test.ts` içine PGlite testi ekle (yetkili ve yetkisiz kullanıcı için).
- Canlı veritabanı üretimdir: migration'ı canlıya uygulamadan önce kullanıcıdan onay al; uygulandıktan sonra doğrulama sorgusu çalıştır.
- `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucuda (`route.ts`, `scripts/`). Asla `NEXT_PUBLIC_` önekiyle veya istemci koduna koyma; `.env.local` Git'e girmez.
- Deneme modu (`NEXT_PUBLIC_DEMO_MODE=true`) aynı iş kurallarını tarayıcıda taklit eder. Bir kural değişince `workspace.tsx` içindeki demo dalını da güncelle.

## React en iyi pratikleri

**Bileşen ve durum**
- Türetilebilen değeri state'e koyma; render sırasında hesapla (ör. filtrelenmiş görevler, sayılar). Pahalıysa `useMemo` kullan, ama yalnızca gerçekten ölçülebilir fark varsa.
- `useEffect` yalnızca dış sistemle senkronizasyon için (abonelik, zamanlayıcı, tarayıcı API'si). Prop'tan state türetmek veya olay sonrası iş yapmak için effect yazma; olay işleyicide yap.
- Prop değişince formu sıfırlamak için effect yerine `key` kullan (ör. `<StatusForm key={task.updated_at} />`).
- Her effect temizleme fonksiyonu döndürsün (interval, listener, abonelik). Asenkron işlerde bileşen/oturum değiştiyse sonucu yazma.
- State'i kullanıldığı en alt bileşende tut; paylaşılan veri `workspace.tsx`'te, ekran durumu `workflow-screen.tsx`'te.
- State'i doğrudan değiştirme; her zaman yeni nesne/dizi üret (`{...t, ...patch}`, `map`, `filter`).
- Liste öğelerinde kararlı `key` (kayıt `id`'si); dizi indeksini yalnızca sırası hiç değişmeyen statik listelerde kullan.
- Bileşeni başka bir bileşenin gövdesi içinde tanımlama (her render'da yeniden oluşur ve state'i sıfırlanır).
- `React.memo`/`useCallback` varsayılan değil; yalnızca ölçülmüş bir performans sorunu varsa ekle.

**Tipler ve veri**
- `any` yok. Dış veriyi (form, API gövdesi) sınırda zod ile doğrula; içeride tiplere güven.
- Supabase hatalarını yutma: `if (error) throw error` ve kullanıcıya Türkçe, ne yapacağını söyleyen mesaj göster.
- Eşzamanlı düzenlemeye karşı güncellemelerde `.eq('updated_at', t.updated_at)` desenini koru.
- Async işlemleri `run(...)` yardımcısıyla sar (meşgul durumu, hata gösterimi tek yerde).

**Erişilebilirlik ve arayüz**
- Tıklanabilir her şey `button` veya `a`; `div onClick` kullanma. Sürüklenebilir kartlar klavyeyle de açılabilmeli (Enter).
- Her form alanının görünür `label`'ı olsun; seçim grupları `role="radiogroup"` + `aria-checked`.
- Görünür klavye odağı (`:focus-visible`) koru; renk tek başına bilgi taşımasın (durumlar metinle de yazılı).
- Tarayıcı `alert`/`prompt` kullanma; onay için kısa bir modal veya yalnızca geri alınamaz işlerde `confirm`.
- Kullanıcı metnini asla `dangerouslySetInnerHTML` ile basma.
- Mobil genişlikte (≤720px) yatay kaydırma olmamalı.

**Kod biçimi**
- Yeni kodu okunur, çok satırlı yaz; mevcut sıkıştırılmış tek satırlık kodu dokunduğun yerde ayrıştırabilirsin ama ilgisiz dosyaları yeniden biçimlendirme.
- Kullanılmayan import/değişken bırakma (`npx tsc --noEmit --noUnusedLocals` temiz kalmalı).
- Yorumlar "neden"i anlatsın, Türkçe ve kısa olsun.
- Stil: Tailwind CSS v4 + shadcn/ui (Radix). Renk ve yazı tipi belirteçleri yalnızca `src/app/globals.css` içinde (`:root` + `@theme inline`); bileşenlerde sabit hex renk yazma, belirteç kullan (`bg-primary`, `text-state-problem`, `var(--prio-high-bg)`).
- shadcn bileşenleri `src/components/ui/` altında; yenisini `npx shadcn@latest add <ad>` ile ekle, sonra sürümleri `package.json`'da tam sürüme sabitle. Ekran okuyucu metinlerini Türkçeleştir.
- Görsel dil: baskı provası. Soğuk kâğıt zemin, mürekkep metin, proses camgöbeği eylem rengi, proses macenta sorun/iptal; öncelikler pastel CMY. Başlıklar Bricolage Grotesque (`font-display`), arayüz Instrument Sans. Kartlarda gölge yok, yalnızca kenarlık; gölge sadece havada duran öğelerde (diyalog, sürüklenen kart).
- Kullanıcı görünüm ayarları: `/ayarlar` sayfası (üst menüdeki dişli). Tema (açık/koyu/sistem), ana renk, zemin rengi, gri tonu (shadcn base color), köşeler (`--radius`), yoğunluk (Tailwind `--spacing`) ve yazı tipi. `<html data-{grup}>` öznitelikleriyle uygulanır, tarayıcıda saklanır; `<head>`'deki betik sayfa çizilmeden uygular. Seçenekler `src/lib/theme.ts`, CSS `globals.css`. Koyu tema dosyanın sonunda ve `.dark` sınıfıyla birlikte gelir. Yeni renk belirteci eklersen açık ve koyu tema için ayrı ayrı tanımla ve kontrastı (en az 4.5:1) ölç. `--state-*` renkleri anlam taşır, temayla yalnızca koyu karşılığına döner. components.json stili (radix-nova) sabittir.
- Ekran dosyaları: `workflow-screen.tsx` (yönlendirme + sayfalar), `board.tsx` (pano, renk barı, liste), `task-detail.tsx` (talep ayrıntısı), `forms.tsx` (giriş + diyaloglar), `screen-kit.tsx` (ortak rozetler, onay penceresi). `workspace.tsx` yalnızca veri ve iş mantığı.

## Tasarım

Arayüz değişikliklerinde `.claude/skills/frontend-design` skill'ini kullan; ama ürünün hedefi **sade ve anlaşılır** olmak. Yeni kavram, alan veya buton eklemeden önce gerçekten gerekli mi diye sor; kartlar yalnızca başlık, marka, öncelik, sorumlu ve yorum sayısını gösterir.

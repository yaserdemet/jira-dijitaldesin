# Akış — Ajans çalışma alanı

15 kişilik ajans için Next.js, TypeScript ve Supabase tabanlı ilk sürüm.

## Bu sürümde

- Grafik İşlemleri, Teknik İşlemler ve Diğer Talepler.
- Talep açma, sorumlu atama, öncelik ve teslim tarihi.
- Liste/pano görünümü, arama, durum ve öncelik filtreleri.
- Yorum, çözüm açıklaması, teslim dosyaları ve açıklamalı revize.
- Dört renkli durum ve ilerleme yüzdesi; revize sayacı ve önceki dosyaların korunması.
- Tarih aralığıyla rapor ve ilerleme bilgisi içeren CSV dışa aktarımı.
- E-posta ve şifreyle çalışan ekleme, erişim kapatma/açma ve yalnızca süper admine açık denetim kayıtları.
- Veritabanında rol kontrolleri, özel dosya deposu, kısa süreli indirme bağlantıları.

## Yerel ön izleme

Node.js 22 veya üzeri ve npm kullanın. Proje klasöründe:

```sh
npm install
```

`.env.example` dosyasını `.env.local` adıyla kopyalayın. Yalnızca deneme için:

```dotenv
NEXT_PUBLIC_DEMO_MODE=true
```

```sh
npm run dev
```

Tarayıcıda `http://127.0.0.1:3000` adresini açın ve **Örnek çalışma alanını keşfet** düğmesine basın.

Deneme modunda gerçek hesap açılmaz, e-posta gönderilmez. Kayıtlar localStorage, dosyalar IndexedDB içinde yalnızca kullanılan tarayıcıda tutulur. Oturumu kapatmak verileri silmez. Deneme kullanıcısı menüsü rol senaryolarını göstermek içindir ve güvenlik sınırı değildir. Deneme modu üretim derlemesinde kapalıdır; bu alana gerçek müşteri verisi girmeyin.


## Gerçek ekip kullanımını açma

1. Hesapları ajansın sahip olduğu e-posta adresiyle açın. Bir Supabase projesi oluşturun; uygulama, veritabanı ve dosya depolama için uygun bölgeyi seçin.
2. SQL Editor içinde yeni, boş projede sırasıyla `001_initial.sql`, `002_disable_mfa.sql` `003_workflow.sql` ve `004_department_assignees.sql` dosyalarını bir kez çalıştırın.
3. Authentication ayarlarında **Allow new users to sign up** seçeneğini kapatın. Uygulamada açık kayıt bulunmasa da bu ayar doğrudan API üzerinden kaydı kapatır. E-posta OTP ve davet akışını açık tutun.
4. Authentication URL Configuration altında Site URL'yi gerçek HTTPS alan adınız yapın; davet/giriş dönüş adresini Redirect URLs listesine ekleyin. Yerel test gerekiyorsa `http://127.0.0.1:3000` adresini ayrıca ekleyin.
5. Supabase Authentication panelinden ilk yöneticiyi davet edin. Ardından yalnızca SQL Editor'da, doğru e-posta adresini kullanarak çalıştırın:

```sql
update public.profiles
set role = 'super_admin', active = true, team = 'Yönetim'
where email = 'SIZIN_YONETICI_EPOSTANIZ';
```

6. `.env.local` içine Supabase URL'sini ve anon/publishable anahtarını ekleyin. Yönetici davetleri için `SUPABASE_SERVICE_ROLE_KEY` sunucu değişkenini ayarlayın. Bu gizli anahtar `NEXT_PUBLIC_` ile başlamamalı, tarayıcıya veya Git'e konulmamalıdır.
7. Güvenilir davet ve giriş e-postaları için Supabase'e ajansın SMTP hizmetini bağlayın. Gönderici alan adı doğrulamalarını tamamlayın. SMTP parolasını uygulama koduna koymayın.
8. `APP_URL` değerini gerçek uygulama adresi yapın. Demo değişkenini `false` yapın.
9. Vercel'de proje kökü olarak bu klasörü seçin, aynı ortam değişkenlerini ekleyin ve Next.js olarak yayınlayın. HTTPS alan adını bağlayın.
10. `supabase/migrations/002_disable_mfa.sql` dosyasını SQL Editor'da yeni bir sorguda çalıştırın. Yönetici davetini kabul edip giriş yapın; çalışanları **Ekip → Kullanıcı ekle** üzerinden ekleyin.

Hesaplar silinmez; erişimi kapatılır. Böylece eski işlerdeki talep sahibi, sorumlu ve yorum kayıtları korunur. İlk sürümde süper admin yetkisi uygulamadan dağıtılmaz; değişiklik yalnızca güvenilir veritabanı yöneticisi tarafından yapılır.

## Yetki modeli

| İşlem | Çalışan | Süper admin |
|---|---|---|
| İşleri, yorumları ve dosyaları görme | Evet | Evet |
| Talep açma, yorum ve referans ekleme | Evet | Evet |
| İş durumu/sorumlu güncelleme ve teslim | Kendi açtığı veya kendisine atanmış işler | Tüm işler |
| Revize isteme | Talep sahibi | Tüm işler |
| Çalışan daveti, erişim açma/kapatma | Hayır | Evet |
| Güvenlik denetim kayıtları | Hayır | Evet |
| Geçmiş kayıt ve dosya silme | Hayır | İlk sürümde uygulamadan sunulmaz |

Talep sahibi, sorumlu veya süper admin işi doğrudan tamamlayabilir. Teslim dosyaları ve çözüm açıklamaları işin içinde korunur. Revize açıklaması ve durum değişikliği tek veritabanı işlemi içinde kaydedilir. İş durumu güncellenirken önceki güncelleme zamanı kontrol edilir; eş zamanlı değişiklikte yeniden yükleme istenir.

## Güvenlik ve işletim sınırları

- Canlı Supabase/Vercel hesapları bu teslim sırasında oluşturulmadı veya bağlanmadı. Gerçek e-posta daveti, oturum ve bulut dosya depolama akışları hesaplar bağlandıktan sonra ayrıca kabul testinden geçirilmelidir.
- Denetim ekranı talep, yorum, dosya ve uygulamadan yapılan kullanıcı yönetimi işlemlerini kapsar. Giriş/IP/başarısız giriş gibi kimlik olayları için Supabase Authentication kayıtları ayrıca izlenmelidir. Bunlar bu ekrana henüz aktarılmıyor.
- Giriş yöneticinin oluşturduğu e-posta ve şifreyle yapılır; iki aşamalı doğrulama (TOTP) `002_disable_mfa.sql` ile kaldırıldı. Çalışanın e-posta hesabını ele geçiren kişi uygulamaya da girebilir; e-posta hesaplarında güçlü parola ve iki aşamalı doğrulama kullanın. Bulut sağlayıcı yönetici hesaplarında MFA'yı ayrıca açın.
- Veritabanı yedeği dosya içeriklerinin yedeği değildir. Her ikisi için bağımsız, erişimi kısıtlı yedek ve düzenli geri yükleme denemesi oluşturun. Bu proje şu an otomatik yedekleme kurmaz.
- Dosya başına 20 MB, izin verilen türler PDF/PNG/JPG/WebP. Dosya deposu MIME türünü ve boyutu sınırlar; tarayıcı uzantıyı da kontrol eder. Antivirüs/zararlı içerik taraması henüz yoktur.
- Uygulama verileri 500 satırlık sayfalarla alır ve 10 saniyede bir yeniler. Supabase API satır sınırı en az 500 olmalıdır. Çok büyük arşivlerde tüm veriyi almak yerine ekran bazında sorgulama ve sunucu raporları eklenmelidir.
- Kayıt saklama/silme politikası, kapasite uyarıları, hata izleme, SMTP giderleri ve yedekleme bütçesi canlı kurulumda belirlenmelidir.
- Sistem raporundaki teslim süresi çalışma saati değildir; açılış ile son tamamlama arasında geçen takvim süresidir.

## Kontroller

```sh
npm run typecheck
npm test
npm run build
```

Veritabanı testleri PGlite üzerinde PostgreSQL yetki politikalarını çalıştırır; Supabase'e özgü auth/storage altyapısı için minimal test şeması kullanır. Bulut hizmetinin entegrasyon testinin yerine geçmez.

Tarayıcıda yerel örnek talep açma, sorumlu atama, teslim açıklaması, revize, dosya yükleme ve indirme akışları ayrıca kontrol edildi.


## Sade ekranlar güncellemesi

Ana sayfa kişisel bildirimleri, Teknik Destek / Grafik Tasarım / Diğer Talepler / Nasıl Yapılır kutularını ve ekip akışını gösterir. Bölümler ve talep ayrıntıları ayrı adreslerde açılır; geri/ileri ve doğrudan bağlantı desteklenir. Yeni talep formu da tam sayfadır. Kullanıcı ve şifre yönetimi mevcut yönetici pencerelerini korur.

**Mevcut kurulum:** Uygulamayı yayımlamadan önce Supabase SQL Editor üzerinden `supabase/migrations/003_workflow.sql` dosyasını bir kez uygulayın. Yeni kurulumda sırasıyla 001, 002 ve 003 dosyalarını çalıştırın. Önce veritabanının yedeğini alın. 003 geçişi mevcut işleri, dosyaları, kullanıcıları ve geçmiş kayıtlarını silmez. Mevcut e-posta/şifre girişi korunur.

Dört görünür durum: Bekliyor (sarı), Yapılıyor (mavi), Tamamlandı (yeşil), Sorun Var (kırmızı). Önceki durumlar ve loglar veritabanında korunur: Yeni/Atandı → Bekliyor, İşlemde/Onay Bekliyor → Yapılıyor, Bilgi Bekliyor/Revize İstendi/İptal → Sorun Var. Önceden iptal edilmiş işlerin açıklamasında bu durum belirtilir. Tamamlanan işler %100, bekleyen işler %0; devam eden işler %5–95 ilerler. Sorun belirtirken açıklama zorunludur ve mevcut ilerleme korunur.

Bu sürümde talep sahibi, sorumlu veya süper admin işi doğrudan tamamlayabilir; ayrı bir onay durumu yoktur. Dosya teslimi, teslim açıklaması ve talep sahibinin gerekçeli revize istemesi korunur. CSV raporu dört görünür durumu ve ilerleme yüzdesini içerir.

Yorumlarda alıcı seçilebilir; Yanıtla düğmesi alıcıyı yorumun yazarına bağlar. Yanıtın aynı işe ait olması sunucuda doğrulanır. Kişi kendisine bildirim göndermez. Bildirimler yalnızca alıcı tarafından okunabilir; diğer çalışanlar ve süper admin başkasının bildirim kutusunu okuyamaz. Bildirim metni ve alıcısı çalışan tarafından değiştirilemez. Canlı çalışma alanı 10 saniyede bir yenilenir; bu sürüm tarayıcı/telefon push veya e-posta bildirimi göndermez. Bildirim ekranında en son 500 bildirim gösterilir.

Nasıl Yapılır bölümünde çalışanlar metin tabanlı adım adım rehber yayımlayabilir. Rehberler ortak okunur ve yayımlama denetim kaydına eklenir. Örnek çalışma alanının eski kayıtları korunur; yeni bildirimler ve rehberler yalnızca aynı tarayıcıda saklanır. Gerçek ortak kullanım için Supabase bağlantısı gerekir.

Kontroller: `npm test`, `npm run typecheck`, `npm run build`.


Bölüm sorumluluklarını etkinleştirmek için mevcut Supabase veritabanında 003 sonrasında
`supabase/migrations/004_department_assignees.sql` dosyasını çalıştırın.
Süper admin, Ekip ekranından aktif kullanıcılara Yazılım Destek ve Grafik Tasarım
sorumluluğu verebilir. İlk kurulumda teknik sorumlular Harun ve Yaser adlı mevcut
hesaplardan, grafik sorumluları Grafik Tasarım ekibinden seçilir. Kullanıcı kaldırma
hesabın erişimini kapatır. Auth ayarlarında herkese açık kullanıcı kaydını kapalı tutun.

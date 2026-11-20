// Yeni kullanıcıya ekranları adım adım tanıtan turlar (driver.js).
// Her tur, kullanıcı o ekranı ilk açtığında bir kez kendiliğinden başlar: ana sayfa, ayarlar ve
// yeni talep penceresi. "Görüldü" bilgisi tarayıcıda kullanıcıya özel anahtarla saklanır.
// Hesap menüsündeki "Tanıtım turu" ana turu yeniden başlatır, diğerlerini de yeniden gösterilir yapar.
import { useEffect } from 'react';
import { type DriveStep, driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export type TourName = 'ana' | 'ayarlar' | 'talep';

const storageKey = (name: TourName, userId: string) => `akis-tur-${name}-${userId}`;

export function tourSeen(name: TourName, userId: string) {
  try {
    return localStorage.getItem(storageKey(name, userId)) === '1';
  } catch {
    return true; // Depolama kapalıysa her seferinde tur açılmasın.
  }
}

function markSeen(name: TourName, userId: string) {
  try {
    localStorage.setItem(storageKey(name, userId), '1');
  } catch {
    // Depolama kapalıysa saklanamaz; tur yine de kapanır.
  }
}

/** Turları yeniden "görülmedi" yapar; ilgili ekran bir sonraki açılışta turu yeniden gösterir. */
export function forgetTours(names: TourName[], userId: string) {
  try {
    for (const name of names) localStorage.removeItem(storageKey(name, userId));
  } catch {
    // Depolama kapalıysa yapılacak bir şey yok.
  }
}

// Ekranda gerçekten görünen ilk öğe. Menü masaüstünde üst çubukta, mobilde hamburger düğmesinde.
function visible(...selectors: string[]) {
  return () => {
    for (const selector of selectors) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && el.getClientRects().length > 0) return el;
    }
    return document.body;
  };
}

// Açıklamalar driver.js tarafından HTML olarak basılır. Kullanıcı verisi (ad) yalnızca escapeHtml'den geçerek girer.
function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Turu anlatan kişi: Yaser. Karşılamada ve kapanışta avatarıyla görünür.
function fromYaser(text: string) {
  return `<span class="akis-tour-host"><img src="/avatars/avatar-4.webp" alt="" width="48" height="48" /><span>${text}</span></span>`;
}

const tours: Record<TourName, (firstName: string) => DriveStep[]> = {
  ana: firstName => [
    {
      popover: {
        title: 'Dijitaldesin Jira\'ya hoş geldin',
        description: fromYaser(`Merhaba${firstName ? ' ' + escapeHtml(firstName) : ''}, ben <b>Yaser</b>. Şimdi seninle projeyi kısa bir turla tanıyalım.`),
      },
    },
    {
      element: '[data-tour="yeni-talep"]',
      popover: {
        title: 'Talep aç',
        description: 'Bir işe ihtiyacın olduğunda buradan talep aç. Bölümü seç, formu doldur; iş ilgili ekibin panosuna düşer. Formu ilk açtığında onu da birlikte tanıyacağız.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="bolumler"]',
      popover: {
        title: 'Bölümler',
        description: 'Her bölümün kendi panosu var. Bir bölüme tıklayınca işleri <b>Bekliyor</b>, <b>Yapılıyor</b>, <b>Tamamlandı</b> ve <b>Sorun Var</b> sütunlarında görürsün. Kartı sürükleyerek durumunu değiştirirsin.',
        side: 'top',
      },
    },
    {
      element: visible('[data-tour="menu"]', '[data-tour="menu-mobil"]'),
      popover: {
        title: 'Menü',
        description: '<b>İşlerim</b> sana atanan işleri, <b>Açtıklarım</b> senin açtığın talepleri gösterir. Raporlar ve ekip listesi de burada.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="son-adimlar"]',
      popover: {
        title: 'Ekibin son adımları',
        description: 'Kim hangi talebi açtı, hangi iş ilerledi; en yeni hareketler burada. Satıra tıklayınca talebe gidersin.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="bildirimler"]',
      popover: {
        title: 'Bildirimler',
        description: 'Biri sana iş atadığında ya da talebine yorum yazdığında burada sayı belirir.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="ayarlar"]',
      popover: {
        title: 'Ayarlar',
        description: 'Avatarını, temayı, renkleri ve yazı tipini buradan kendine göre ayarlarsın.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="hesap"]',
      popover: {
        title: 'Hesabın',
        description: 'Şifre değişikliği ve çıkış burada.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      popover: {
        title: 'İyi çalışmalar',
        description: fromYaser('Proje hakkında geliştirme için tavsiye ve önerilerin olursa <b>Yaser</b> ile temasa geçebilirsin.'),
      },
    },
  ],

  ayarlar: () => [
    {
      element: '[data-tour="ayar-avatar"]',
      popover: {
        title: 'Avatarını seç',
        description: 'Üst menüde ve kartlarda adının yanında bu görünür. İstemezsen baş harfin kalır.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="ayar-mode"]',
      popover: {
        title: 'Açık veya koyu tema',
        description: '<b>Sistem</b> seçersen bilgisayarının ayarını izler. Üst menüdeki ay simgesiyle de hızlıca değiştirebilirsin.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="ayar-accent"]',
      popover: {
        title: 'Ana renk',
        description: 'Butonlar, bağlantılar ve seçili öğeler bu renkle boyanır. Zemin, gri tonu, köşeler, yoğunluk ve yazı tipi aşağıda.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="ayar-onizleme"]',
      popover: {
        title: 'Önizleme',
        description: 'Değişiklikler hemen uygulanır; bir kartın nasıl görüneceğini burada izlersin.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="ayar-sifirla"]',
      popover: {
        title: 'Varsayılana dön',
        description: 'Beğenmezsen tek tıkla eski görünüme dönersin. Ayarlar yalnızca bu tarayıcıda saklanır.',
        side: 'top',
      },
    },
  ],

  talep: () => [
    {
      element: '[data-tour="talep-bolum"]',
      popover: {
        title: 'Önce bölümü seç',
        description: 'Talep hangi ekibe gidecek? Bölüm değişince form da değişir ve o işe uygun soruları sorar.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="talep-baslik"]',
      popover: {
        title: 'Kısa bir başlık',
        description: 'Panoda kartın üstünde görünecek ad. Ne istediğini bir bakışta anlatsın. Altındaki alanlar seçtiğin bölüme göre değişir.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="talep-sorumlu"]',
      popover: {
        title: 'Müşteri ve sorumlu',
        description: 'İşin hangi marka için olduğunu yaz. Sorumluyu bilmiyorsan <b>Şimdilik atama</b> olarak bırak; ekip üstlenir.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="talep-oncelik"]',
      popover: {
        title: 'Öncelik',
        description: 'Çoğu iş <b>Normal</b>dir. <b>Acil</b>i gerçekten bekleyemeyecek işlere sakla ki ekip neye önce bakacağını bilsin.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="talep-dosya"]',
      popover: {
        title: 'Dosya ekle',
        description: 'Örnek görsel, metin veya brif varsa ekle. PDF, PNG, JPG veya WebP olabilir.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="talep-gonder"]',
      popover: {
        title: 'Talebi aç',
        description: 'Gönderdiğinde talep ilgili bölümün panosunda <b>Bekliyor</b> sütununa düşer ve bütün ekip görür.',
        side: 'top',
        align: 'end',
      },
    },
  ],
};

export function startTour(name: TourName, userId: string, firstName = '') {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tour = driver({
    steps: tours[name](firstName),
    animate: !reduceMotion,
    smoothScroll: !reduceMotion,
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: 'İleri',
    prevBtnText: 'Geri',
    doneBtnText: 'Bitir',
    closeBtnLabel: 'Turu kapat',
    popoverClass: 'akis-tour',
    stagePadding: 6,
    stageRadius: 10,
    // Tanıtım sırasında vurgulanan öğeye yanlışlıkla basılıp sayfadan çıkılmasın.
    disableActiveInteraction: true,
    // Kapatma, Esc veya bitirme fark etmez: kullanıcı turu gördü, bir daha kendiliğinden açılmasın.
    onDestroyed: () => markSeen(name, userId),
  });
  tour.drive();
  return tour;
}

/** Ekran ilk kez açıldığında turu bir kez başlatır; ekran kapanınca tur da kapanır. */
export function useFirstVisitTour(name: TourName, userId: string, active = true, firstName = '') {
  useEffect(() => {
    if (!active || tourSeen(name, userId)) return;
    let tour: ReturnType<typeof startTour> | undefined;
    // Ekran yerleşsin diye kısa bir bekleme (pencere açılış animasyonu dahil); aksi halde vurgu yanlış yere çizilebilir.
    const timer = setTimeout(() => { tour = startTour(name, userId, firstName); }, 500);
    return () => {
      clearTimeout(timer);
      tour?.destroy();
    };
  }, [name, userId, active, firstName]);
}

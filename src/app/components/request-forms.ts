import type { Category } from '@/lib/domain';

type Field = {
  label: string;
  required?: boolean;
  multiline?: boolean;
  options?: string[];
  example?: string;
  when?: string;
};

type RequestForm = {
  heading: string;
  titleExample: string;
  attachmentLabel: string;
  types: string[];
  fields: Field[];
};

export const requestForms: Record<Category, RequestForm> = {
  'Grafik İşlemleri': {
    heading: 'Grafik tasarım talebi',
    titleExample: 'Örn. Kasım kampanyası için mobil ve masaüstü banner',
    attachmentLabel: 'Logo, ürün görseli ve tasarım referanslarını ekle',
    types: ['Web banner', 'Sosyal medya ve reklam', 'Video ve hareketli tasarım', 'Katalog ve baskı', 'Mevcut tasarım revizesi', 'Diğer tasarım'],
    fields: [
      {label:'İstenen tasarım ve kampanya amacı',required:true,multiline:true},
      {label:'Tasarımda kullanılacak metin ve çağrı',multiline:true,example:'Başlık, kampanya koşulu, buton metni'},
      {label:'Önceki tasarım bağlantısı',when:'Mevcut tasarım revizesi'},
      {label:'Değişecek ve korunacak öğeler',when:'Mevcut tasarım revizesi',required:true,multiline:true},
    ],
  },
  'Teknik İşlemler': {
    heading: 'Teknik destek talebi',
    titleExample: 'Örn. Mobilde sepetten ödeme sayfasına geçilemiyor',
    attachmentLabel: 'Ekran görüntüsü veya hata çıktısı ekle',
    types: [],
    fields: [
      {label:'Domain',required:true,example:'ornek.com'},
      {label:'Mevcut durum veya hata mesajı',required:true,multiline:true},
    ],
  },
  'Diğer Talepler': {
    heading: 'Ekip içi talep',
    titleExample: 'Örn. Müşteri toplantısı için haftalık sonuçları paylaş',
    attachmentLabel: 'İlgili belgeleri veya referansları ekle',
    types: ['Bilgi ve belge', 'Onay ve geri bildirim', 'Koordinasyon', 'Operasyon', 'Diğer'],
    fields: [
      {label:'İstenen iş veya çıktı',required:true,multiline:true},
      {label:'İlgili ekip veya kişi'},
      {label:'Bağlam, bağlantılar ve bağımlılıklar',multiline:true},
    ],
  },
};

export const designSizes = [
  'Instagram kare gönderi · 1080 × 1080 px',
  'Instagram dikey gönderi · 1080 × 1350 px',
  'Instagram hikâye / Reels · 1080 × 1920 px',
  'Web banner, masaüstü · 1920 × 880 px',
  'Web banner · 1080 × 485 px',
  'Dikey reklam görseli · 1080 × 1440 px',
  'Kategori görseli · 468 × 585 px',
];

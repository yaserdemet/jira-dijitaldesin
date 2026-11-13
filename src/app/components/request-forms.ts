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
      {label:'Ürün, logo ve referans bağlantıları',multiline:true},
      {label:'Çıktı formatı ve varyasyonlar',example:'PNG, WebP, PDF veya kaynak dosya. Renk ve dil varyasyonları'},
      {label:'Yayın tarihi ve saati',example:'Teslimden farklıysa belirtin'},
      {label:'Önceki tasarım bağlantısı',when:'Mevcut tasarım revizesi'},
      {label:'Değişecek ve korunacak öğeler',when:'Mevcut tasarım revizesi',required:true,multiline:true},
    ],
  },
  'Teknik İşlemler': {
    heading: 'Teknik destek talebi',
    titleExample: 'Örn. Mobilde sepetten ödeme sayfasına geçilemiyor',
    attachmentLabel: 'Ekran görüntüsü veya hata çıktısı ekle',
    types: ['Site ve erişim', 'Tema ve mobil görünüm', 'Sepet, ödeme ve iade', 'Kargo, fatura ve entegrasyon', 'Alan adı ve yönlendirme', 'Piksel ve ölçüm', 'Diğer teknik işlem'],
    fields: [
      {label:'Platform ve etkilenen sayfa',required:true,example:'Platform, site adresi ve sorunlu sayfanın bağlantısı'},
      {label:'Mevcut durum veya hata mesajı',required:true,multiline:true},
      {label:'Beklenen sonuç',required:true,multiline:true},
      {label:'Tekrar adımları, cihaz ve tarayıcı',multiline:true,example:'Hangi adımlarda oluyor? Mobilde ve masaüstünde tekrarlanıyor mu?'},
      {label:'Etki kapsamı',options:['Tek kullanıcı veya işlem','Bazı müşteriler veya sayfalar','Satış ya da site genelinde kesinti','Henüz bilinmiyor']},
      {label:'Başlangıç zamanı ve denenen çözümler',multiline:true},
      {label:'Sağlayıcı ve destek kaydı',example:'Varsa firma adı ve destek talebi numarası. Şifre veya API anahtarı eklemeyin.'},
      {label:'Ödeme sağlayıcısı ve işlem referansı',when:'Sepet, ödeme ve iade',example:'Varsa sipariş numarası. Kart bilgisi eklemeyin.'},
      {label:'Bağlanacak sistem ve veri akışı',when:'Kargo, fatura ve entegrasyon',multiline:true,example:'Hangi veriler hangi sistemler arasında aktarılacak?'},
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

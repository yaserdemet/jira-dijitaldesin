// Kullanıcının seçtiği avatar. Tarayıcıda, kullanıcıya özel anahtarla saklanır; aynı tarayıcıyı
// kullanan farklı hesapların seçimleri karışmaz. Seçim değişince aynı sekmedeki bütün bileşenler
// (üst menü, ayarlar sayfası) özel bir olayla, diğer sekmeler 'storage' olayıyla güncellenir.
import { useCallback, useSyncExternalStore } from 'react';

export const avatarOptions = [1, 2, 3, 4, 5, 6, 7].map(n => ({ id: String(n), src: `/avatars/avatar-${n}.webp` }));

const CHANGE_EVENT = 'akis-avatar-change';
const storageKey = (userId: string) => `akis-avatar-${userId}`;

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Seçili avatarın kimliği ve görsel yolu (seçim yoksa null) ile değiştirme fonksiyonu. */
export function useAvatar(userId: string) {
  const read = useCallback(() => {
    try {
      const id = localStorage.getItem(storageKey(userId));
      return avatarOptions.some(a => a.id === id) ? id : null;
    } catch {
      return null; // Depolama kapalıysa baş harf gösterilir.
    }
  }, [userId]);
  const id = useSyncExternalStore(subscribe, read, () => null);

  const setAvatar = useCallback((next: string | null) => {
    try {
      if (next) localStorage.setItem(storageKey(userId), next);
      else localStorage.removeItem(storageKey(userId));
    } catch {
      // Depolama kapalıysa seçim saklanamaz; sessizce baş harfte kalır.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [userId]);

  return { avatarId: id, avatarSrc: avatarOptions.find(a => a.id === id)?.src ?? null, setAvatar };
}

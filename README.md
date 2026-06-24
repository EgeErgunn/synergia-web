# Synergia Web — Kurulum Rehberi

## Proje Yapısı

```
synergia-web/
├── app/
│   ├── page.tsx              ← Ana sayfa (oyun başlat / katıl)
│   ├── host/[code]/          ← Host (oyun yöneticisi) ekranı
│   ├── join/[code]/          ← QR okuyunca açılan katılım sayfası
│   └── room/[code]/          ← Oyuncu oyun ekranı (sıralama, bekleme)
├── components/
│   ├── QRDisplay.tsx         ← QR kodu canvas bileşeni
│   └── Avatar.tsx            ← Renkli avatar bileşeni
├── lib/
│   ├── firebase.ts           ← Firebase başlatma
│   ├── db.ts                 ← Realtime DB okuma/yazma
│   └── gameEngine.ts         ← Puanlama algoritması (Java'dan port)
└── .env.local.example        ← Ortam değişkenleri şablonu
```

## Adım 1 — Firebase Projesi Kur

1. https://console.firebase.google.com → "Add project"
2. Proje adı: `synergia` (istediğin herhangi bir şey)
3. **Realtime Database** → "Create database" → "Start in test mode"
4. **Project Settings** → "Web" uygulaması ekle → Config değerlerini kopyala

## Adım 2 — .env.local Oluştur

```bash
cp .env.local.example .env.local
# Ardından .env.local içindeki değerleri Firebase'den yapıştır
```

## Adım 3 — Kur ve Çalıştır

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Adım 4 — Firebase Realtime DB Kuralları

Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    "sessions": {
      "$code": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> Production'da auth ekle, bu kurallar sadece geliştirme içindir.

## Adım 5 — Vercel'e Deploy

```bash
npm install -g vercel
vercel
# Vercel sana .env değerlerini sorar, Firebase'den kopyala yapıştır
```

Deploy sonrası `vercel.app` URL'ini al, arkadaşlarına gönder!

## Oyun Akışı

```
Host → Ana sayfa → "Oyun başlat"
     → /host/ABC123 (QR gösterilir)

Oyuncu → QR okut → /join/ABC123
       → İsim gir → /room/ABC123

Host → Tema seç → "Turu başlat"
     → Oyuncular sıralar → "Turu bitir"
     → Sonuçlar + Adjacency Matrix

(Yeni tur veya oyunu bitir)
```

## Puanlama

5 oyunculu bir oyunda sıralayan kişi:
- 1. sıraya koyduğuna → 4 puan
- 2. sıraya koyduğuna → 3 puan
- 3. sıraya koyduğuna → 2 puan
- 4. (son) sıraya koyduğuna → 1 puan

## Sonraki Adımlar

- `lib/gameEngine.ts` içine yeni puanlama stratejisi ekle
- Firebase Auth ile gerçek kimlik doğrulama
- D3.js ile Adjacency Matrix → Network Graph görselleştirmesi
- Özel tema ekleme (host kendi tema listesini girebilsin)

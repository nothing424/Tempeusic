# 🎵 TempeMusic
**Aplikasi Streaming Musik – Playlist Gila & Asik**

> Source musik dari YouTube Music via [Piped API](https://github.com/TeamPiped/Piped) (open-source, bebas, tanpa API key!)
> Inspired by [MetrolistGroup/Metrolist](https://github.com/MetrolistGroup/Metrolist)

---

## 🚀 Cara Pakai

Cukup buka `index.html` di browser — tidak perlu server atau npm!

```
TempeMusic/
├── index.html     → Halaman utama app
├── style.css      → Semua styling (tema teal/cyan sesuai logo)
├── app.js         → Logic app, API calls, player controls
├── utils.py       → Python utility: cek instance, fetch metadata
├── logo.png       → Logo TempeMusic
└── README.md      → Panduan ini
```

---

## 🎨 Desain

| Token | Nilai |
|---|---|
| Warna utama | `#1ab8c8` (Teal Accent) |
| Warna cerah | `#2dd4e4` (Teal Bright) |
| Background | `#0a2a2e` (Deep Teal) |
| Font display | Nunito 900 |
| Font body | Space Grotesk |

Warna diambil langsung dari logo TempeMusic (teal/cyan gradient).

---

## 🔌 Source Musik – Piped API

TempeMusic menggunakan **Piped API**, proxy open-source untuk YouTube Music.
Tidak perlu API key, tidak perlu login.

Instance yang dicoba (auto-fallback):
1. `https://pipedapi.kavin.rocks`
2. `https://piped-api.privacy.com.de`  
3. `https://api.piped.yt`

---

## 🐍 Python Utility

```bash
python utils.py
```

Fungsi:
- Cek instance Piped mana yang aktif
- Fetch trending lagu Indonesia
- Cari lagu berdasarkan query
- Simpan cache ke folder `.cache/`

---

## ✨ Fitur

- 🔍 **Search** – Cari lagu, artis, album via YouTube Music
- 🔥 **Trending** – Lagu trending Indonesia real-time
- ❤️ **Library** – Simpan lagu favorit (localStorage)
- 🕐 **Riwayat** – Riwayat putar otomatis tersimpan
- 🔀 **Shuffle & Repeat** – Kontrol playback lengkap
- 📱 **Responsive** – Mobile-friendly

---

## ⚠️ Catatan

- Pemutaran menggunakan YouTube IFrame Player (butuh koneksi internet)
- Piped API adalah layanan pihak ketiga, ketersediaan tergantung instance
- Untuk penggunaan pribadi / non-komersial

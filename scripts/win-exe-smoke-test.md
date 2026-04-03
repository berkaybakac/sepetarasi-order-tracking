# Windows .exe Smoke Test Checklist

## Onkosul
- Pi4 (veya dev makine) uzerinde sunucu calisiyor: `npm start`
- Sunucunun LAN IP'si biliniyor (orn: 192.168.1.100:3000)
- Windows 10/11 makine ayni LAN'da

## Build
macOS uzerinde:
```bash
cd packages/kasa
npm run build:win
```
Cikti: `packages/kasa/release/` altinda `.exe` installer

## Test Adimlari

### 1. Kurulum
- [ ] `.exe` dosyasini Windows makineye kopyala
- [ ] Cift tikla ile yukle (NSIS installer)
- [ ] Uygulama otomatik acildi mi?

### 2. Sunucu Baglantisi
- [ ] "Sunucu adresi" ekrani geldi mi?
- [ ] `http://192.168.1.100:3000` gir, "Baglan" tikla
- [ ] Basarili baglanti sonrasi kasa ekrani geldi mi?
- [ ] Sag ustte yesil nokta (bagli) gorunuyor mu?

### 3. Siparis Olusturma
- [ ] "Yeni Siparis" formunda urun adi gir: "Doner"
- [ ] Miktar: 2, Fiyat: 150.00 TL
- [ ] "+ Urun ekle" ile ikinci urun ekle: "Ayran", 2x, 30.00 TL
- [ ] "Siparis Olustur" tikla
- [ ] Siparis listesinde #1 gorundu mu?
- [ ] Durum: "Hazirlaniyor" (sari badge)?

### 4. Durum Guncelleme
- [ ] #1 siparisinde "Hazir" butonuna tikla
- [ ] Badge "Hazir" (yesil) oldu mu?
- [ ] "Teslim" butonu gorundu mu?
- [ ] "Teslim" tikla -> badge "Teslim" (mavi), butonlar kayboldu mu?

### 5. Gecersiz Gecis
- [ ] Yeni siparis olustur (#2)
- [ ] "Teslim" butonu YOK (sadece Hazir ve Iptal gorunuyor mu?)

### 6. WebSocket Canli Guncelleme
- [ ] Sunucuya baska bir yerden (curl/browser) siparis ekle
- [ ] Kasa .exe'de yeni siparis otomatik gorundu mu? (sayfa yenilemeden)

### 7. Baglanti Kopma / Tekrar Baglanti
- [ ] Sunucuyu durdur (Ctrl+C)
- [ ] Kasa'da sag ust kirmizi nokta oldu mu?
- [ ] Sunucuyu tekrar baslat
- [ ] Kasa otomatik baglanip verileri yeniledi mi? (yesil nokta)

### 8. Ikinci Calistirma
- [ ] Uygulamayi kapat ve tekrar ac
- [ ] Sunucu adresi hatirlanmis mi? (direkt kasa ekranina gecti mi?)

## Basarisizlik Durumunda
- Sunucuya baglanamiyor: Windows Firewall -> port 3000 izni
- Beyaz ekran: DevTools ac (Ctrl+Shift+I), console hatalari kontrol et
- .exe acilmiyor: Antivirus'u kontrol et (imzasiz Electron app engellenebilir)

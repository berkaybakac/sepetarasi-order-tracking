# TB1 Hızlı Kurulum

Bu not operasyon içindir. Sırayla uygula.

`<PI_ADRESI>` yerine sahadaki Raspberry Pi adresini yaz.

Örnek:

- SSH: `admin@192.168.1.30`
- Browser / TB1: `http://192.168.1.30:3000/...`

## 1. Deploy

```bash
bash scripts/deploy.sh
```

## 2. Yönetim Panelini Aç

```text
http://<PI_ADRESI>:3000/admin
```

`Ekran` sekmesinde sadece şunları kontrol et:

1. `Restoran Adı` doğru mu
2. `Tema` `Karanlık` mı
3. `Hazır Gösterim Süresi` `30 dk` mı
4. Değişiklik yaptıysan `Kaydet`

## 3. Panel URL'lerini Gir

Her panel için doğru URL'yi kullan:

1. `256x512`

```text
http://<PI_ADRESI>:3000/display/index-256x512.html
```

2. `344x344`

```text
http://<PI_ADRESI>:3000/display/index-344x344.html
```

3. `512x512`

```text
http://<PI_ADRESI>:3000/display/index-512x512.html
```

## 4. Kullanma

Aşağıdaki linkleri TB1 için kullanma:

```text
http://<PI_ADRESI>:3000/display
http://<PI_ADRESI>:3000/display.html
http://<PI_ADRESI>:3000/display/index.html
```

## 5. Hızlı Kontrol

Önce bağlantıyı kontrol et:

```text
http://<PI_ADRESI>:3000/ping
```

Sonra:

1. Üç panel de açılıyor mu
2. Saat görünüyor mu
3. Sipariş oluşturunca ekran `1-2 saniye` içinde güncelleniyor mu
4. Çok sipariş varsa sayfa değişimi oluyor mu

## 6. READY Davranışı

`READY` olduğunda TB1 ekranında beklenen davranış:

1. Yeni hazır sipariş varsa ekran ilgili `Hazır` sayfasına gider
2. İlgili sipariş yaklaşık `4 saniye` farklı renkle vurgulanır
3. Aynı anda peş peşe gelen yeni hazır siparişler varsa sistem en fazla `5` tanesini sırayla gösterir
4. Bu sırada sayfa geçişi kısa süre durur
5. Sıra bitince normal sayfa akışı devam eder

## 7. Son Kontrol

Kurulum bitince sahada kullanılacak ekranlar sadece bunlar:

1. `LED 256x512`
2. `LED 344x344`
3. `LED 512x512`

Admin'deki `Web Önizleme` sadece test içindir.

## 8. Sorun Olursa

Daha detaylı runbook:

[novastar-field-checklist.local.md](/Users/berkaybakac/sepetarasi-order-tracking/docs/novastar-field-checklist.local.md)

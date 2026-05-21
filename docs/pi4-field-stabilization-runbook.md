# Pi4 Saha Runbook

Bu dosya Pi4 saha kontrolu icin tek kaynak dokumandir. Uzaktan ilk bakilacak komut:

```bash
ssh admin@192.168.1.101 sepetarasi-health
```

## Cihaz

| Alan | Deger |
| --- | --- |
| Hostname | `sepetarasi` |
| SSH | `admin@192.168.1.101` |
| Web | `http://192.168.1.101:3000` |
| Model | Raspberry Pi 4 |
| MAC | `88:A2:9E:93:A0:D1` |
| IP | `192.168.1.101` |
| Alpemix | `sepetarasi` alt kullanicisiyla bagli |
| Alpemix dosyasi | `/home/admin/Desktop/Alpemix` |
| Alpemix autostart | `/home/admin/.config/autostart/alpemix.desktop` |

Sifreyi repoya yazma.

## Saglik Kriteri

`sepetarasi-health` ciktisinda beklenen kritik degerler:

```text
eth0 ip: 192.168.1.101/24
gateway ping: OK
dns resolve: OK
internet http: OK
local /health: OK (200)
tcp listen :3000: 1
raw: 0x0
PipeWire default sink: Volume: 0.90
duplicate_ip_recent: 0
```

LAN'dan hizli app kontrolu:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.1.101:3000/health
```

Beklenen: `200`.

## Sahaya Gitmeden

- Pi4 icin kaliteli/resmi `5.1V 3A` adaptör kullan. `5V 3A` yazan zayif adaptör/kablo yuk altinda yetmeyebilir.
- Kisa/kalin USB-C kablo kullan.
- Eski adaptör/kabloyu geri gonderme.
- Router'da DHCP reservation yap:

```text
88:A2:9E:93:A0:D1 -> 192.168.1.101
```

- `.101` ile cakisan eski MAC router'da bu IP'den alinmali:

```text
54:B5:6C:22:4D:11
```

Pi icine statik IP yazma; ana cozum router reservation.

## Kurulu Mekanizma

| Parca | Gorev |
| --- | --- |
| `sepetarasi-health` | Tek komut health raporu |
| `sepetarasi-metrics.timer` | Her dakika JSONL metrik yazar |
| `sepetarasi-audio-normalize.timer` | Boot'tan sonra sesi bir kez 90% / 0.90 yapar |
| `sepetarasi-boot-marker.service` | Boot baslangic/kapanis marker'i yazar |
| `pi4-ensure-audio.sh` | App servis baslangicinda ALSA baseline uygular |

## Loglar

| Log | Komut |
| --- | --- |
| Son health | `ssh admin@192.168.1.101 sepetarasi-health` |
| Metrikler | `ssh admin@192.168.1.101 "tail -n 100 /var/log/sepetarasi/system-metrics.log"` |
| Ses normalize | `ssh admin@192.168.1.101 "tail -n 100 /var/log/sepetarasi/audio-normalize.log"` |
| Audit | `ssh admin@192.168.1.101 "tail -n 100 /var/log/sepetarasi/audit.log"` |
| Boot listesi | `ssh admin@192.168.1.101 "journalctl --list-boots --no-pager"` |
| IP cakismasi | `ssh admin@192.168.1.101 "journalctl -u NetworkManager --since '7 days ago' -g 'already in use' --no-pager"` |
| Guc/voltaj | `ssh admin@192.168.1.101 "vcgencmd get_throttled"` |

Log retention: `/var/log/sepetarasi/*.log*` icin 14 gun. Journal persistent, limit `300M`.

## Throttling Yorumu

`throttled` sadece isinma demek degildir. Pi dusuk/stabil olmayan voltajda da kendini korumak icin performans kisar.

| Deger | Anlam |
| --- | --- |
| `0x0` | Temiz |
| `0x50005` | Aktif undervoltage + aktif throttling + bu boot icinde daha once de yasanmis |
| `0x50000` | Bu boot icinde undervoltage/throttling yasanmis, anlik aktif olmayabilir |

`0x50005` gorulurse once adaptör, kablo, priz/coklayici ve UPS/guc kalitesi kontrol edilir.

## Ariza Karari

| Belirti | Ilk karar |
| --- | --- |
| `raw` `0x0` degil | Guc/adaptör/kablo sorunu oncelikli |
| `duplicate_ip_recent: 1` | Router DHCP/IP cakismasi |
| `/health` 200 degil | `sepetarasi.service` ve port 3000 kontrol |
| Internet fail | Gateway/DNS/router kontrol |
| Ses kisik | `audio-normalize.log` ve PipeWire `0.90` kontrol |
| Cok reboot | Guc kesintisi veya unclean shutdown arastir |

## Deploy Kurali

Bu Pi sahaya hazir. Sadece sahaya goturulecekse yeni deploy gerekmez.

Teknik ekip bu cihazda eski repo'dan deploy yapmamali. Deploy gerekiyorsa once bu stabilizasyon degisiklikleri commit/push edilmeli.

Teknik ekibe verilecek kisa not:

```text
Pi4 sahaya hazir.
Eski repo'dan deploy yapmayin.
Router DHCP reservation: 88:A2:9E:93:A0:D1 -> 192.168.1.101
Kontrol: ssh admin@192.168.1.101 sepetarasi-health
```

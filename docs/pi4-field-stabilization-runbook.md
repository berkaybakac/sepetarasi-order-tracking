# Pi4 Saha Runbook

Bu dosya Pi4 saha kontrolu icin tek kaynak dokumandir. Uzaktan ilk bakilacak komut:

```bash
ssh <ssh-user>@<tailscale-ip> sepetarasi-health
```

## Cihaz

| Alan | Deger |
| --- | --- |
| Hostname | `sepetarasi` |
| SSH (Tailscale) | `<ssh-user>@<tailscale-ip>` |
| SSH (musteri LAN) | `<ssh-user>@<reserved-lan-ip>` |
| Web (musteri LAN) | `http://<reserved-lan-ip>:3000` |
| Model | Raspberry Pi 4 |
| MAC | `<pi-mac>` |
| LAN IP | `<reserved-lan-ip>` |
| Tailscale IP | `<tailscale-ip>` |
| Tailscale hostname | `<tailscale-hostname>` |
| Tailscale key expiry | Disabled |
| Remote support tool | Degerleri local/private runbook'ta tutulur |

Sifre, gercek IP, MAC, Tailscale hesabi ve musteriye ozel cihaz bilgilerini public repoya yazma.

## Saha Agi

Kalici ag modeli:

```text
Pi MAC: <pi-mac>
Router DHCP reservation: <pi-mac> -> <reserved-lan-ip>
Pi NetworkManager: ipv4.method auto
Tailscale IP: <tailscale-ip>
Tailscale service: enabled, active
Tailscale key expiry: disabled
```

Pi icine statik IP yazma. Pi DHCP'de kalir; sabit LAN IP router reservation ile verilir. Onceki/degerlendirme IP'leri baska cihazlara gidebilir; gercek degerleri local/private runbook'ta tut.

## Saglik Kriteri

`sepetarasi-health` ciktisinda beklenen kritik degerler:

```text
eth0 ip: <reserved-lan-ip>/24
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
curl -s -o /dev/null -w '%{http_code}\n' http://<reserved-lan-ip>:3000/health
```

Beklenen: `200`.

## Sahaya Gitmeden

- Pi4 icin kaliteli/resmi `5.1V 3A` adaptör kullan. `5V 3A` yazan zayif adaptör/kablo yuk altinda yetmeyebilir.
- Kisa/kalin USB-C kablo kullan.
- Eski adaptör/kabloyu geri gonderme.
- Router'da DHCP reservation yap:

```text
<pi-mac> -> <reserved-lan-ip>
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
| Son health | `ssh <ssh-user>@<tailscale-ip> sepetarasi-health` |
| Metrikler | `ssh <ssh-user>@<tailscale-ip> "tail -n 100 /var/log/sepetarasi/system-metrics.log"` |
| Ses normalize | `ssh <ssh-user>@<tailscale-ip> "tail -n 100 /var/log/sepetarasi/audio-normalize.log"` |
| Audit | `ssh <ssh-user>@<tailscale-ip> "tail -n 100 /var/log/sepetarasi/audit.log"` |
| Boot listesi | `ssh <ssh-user>@<tailscale-ip> "journalctl --list-boots --no-pager"` |
| IP cakismasi | `ssh <ssh-user>@<tailscale-ip> "journalctl -u NetworkManager --since '7 days ago' -g 'already in use' --no-pager"` |
| Guc/voltaj | `ssh <ssh-user>@<tailscale-ip> "vcgencmd get_throttled"` |
| Tailscale servis | `ssh <ssh-user>@<tailscale-ip> "systemctl is-enabled tailscaled && systemctl is-active tailscaled && tailscale status"` |

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
Router DHCP reservation: <pi-mac> -> <reserved-lan-ip>
Tailscale: <tailscale-hostname> / <tailscale-ip> / key expiry disabled
Kontrol: ssh <ssh-user>@<tailscale-ip> sepetarasi-health
```

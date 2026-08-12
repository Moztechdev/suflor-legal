# suflor-legal

Suflor'un gizlilik politikası ve kullanım şartlarının herkese açık adresi. App Store Connect ve Google Play
buraya bir URL istiyor; uygulama mağaza sayfasında bu bağlantı görünüyor.

## Nasıl çalışıyor

Metnin sahibi bu repo değil. Gizlilik politikası ve kullanım şartları **prod Supabase veritabanında**
(`legal_document_texts` tablosu) duruyor; aynı satırları Flutter uygulaması okuyor ve yönetim paneli
(`suflor-admin` → İçerik → Hukuki metinler) düzenliyor.

`build.mjs` o tabloyu okuyup `docs/` klasörüne statik HTML yazıyor. Yani:

```
Supabase (tek kaynak)  →  build.mjs  →  docs/*.html  →  GitHub Pages  →  herkese açık URL
```

Metni **bu repodaki HTML dosyalarını elle düzenleyerek değiştirme.** Bir sonraki üretim üzerine yazar ve
uygulama içinde başka, sitede başka bir politika görünür. Metin panelden düzenlenir, sonra site yeniden
üretilir.

`docs/` klasörü üretilmiş olmasına rağmen repoya commit ediliyor — GitHub Pages'in yayınladığı şey o
klasör, ve neyin yayında olduğunun git geçmişinde görünmesi hukuki bir metin için istenen şey.

## Kavramlar (bu iş ilk kez yapılıyorsa)

**GitHub Pages**, GitHub'ın repodaki statik dosyaları bir web adresinden yayınlayan ücretsiz servisi.
Sunucu kiralamıyorsun, bir şey çalışmıyor — sadece dosyalar duruyor ve GitHub onları servis ediyor. Bu
yüzden çökme, güncelleme, sertifika yenileme derdi yok; gizlilik politikası gibi yıllarca aynı yerde durması
gereken bir sayfa için doğru araç.

**Neden repo public olmalı:** GitHub Pages ücretsiz planda yalnızca herkese açık repolarda çalışıyor.
Burada bir sakınca yok — içerideki tek şey zaten herkese yayınlanmak üzere yazılmış hukuki metin. Gizli
anahtar yok: `build.mjs` yalnızca `anon` anahtarını kullanıyor, o da Flutter uygulamasının içinde zaten
dağıtılıyor ve veritabanında RLS'in izin verdiğinden fazlasını okuyamıyor. **Servis anahtarı buraya
girmez.**

## Kurulum (tek seferlik)

1. Repoyu `Moztechdev/suflor-legal` adıyla **public** olarak oluştur ve push et.
2. GitHub'da **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, klasör: `/docs` → Save.
   Birkaç dakika sonra site `https://moztechdev.github.io/suflor-legal/` adresinde yayında olur.
3. GitHub'da **Settings → Secrets and variables → Actions → New repository secret** ile iki değer ekle
   (yalnızca Actions'ın siteyi tazeleyebilmesi için):
   - `SUPABASE_URL` → `https://ysozoysinctdontgzlhb.supabase.co`
   - `SUPABASE_ANON_KEY` → panelin `.env.local` dosyasındaki `SUPABASE_ANON_KEY_PROD` değeri

## Metni güncelleme

1. Yönetim panelinde metni düzenle (İçerik → Hukuki metinler). Uygulama bu anda güncellenmiş olur.
2. Siteyi tazele — iki yoldan biri:
   - **GitHub üzerinden:** Actions sekmesi → *Yayınla* → Run workflow. Değişiklik varsa `docs/` yeniden
     üretilip commit edilir, Pages birkaç dakika içinde yeni hâli yayınlar.
   - **Yerelden:**
     ```bash
     cp .env.example .env      # ilk seferinde; anon anahtarını doldur
     npm run build
     git add docs && git commit -m "chore: rebuild legal pages" && git push
     ```

## Adresler

| Belge               | Yol                   |
| ------------------- | --------------------- |
| Gizlilik Politikası | `/gizlilik/`          |
| Kullanım Şartları   | `/kullanim-sartlari/` |
| Privacy Policy (en) | `/en/privacy/`        |
| Terms of Use (en)   | `/en/terms/`          |

İngilizce sayfalar, veritabanında o dilde satır olduğunda kendiliğinden üretilir; şu an `legal_document_texts`
içinde `privacy` ve `terms` için `en` satırı yok, bu yüzden üretimde "atlandı" uyarısı görürsün.

## Sonradan alan adı bağlamak

`suflor.app` bir gün bu sayfalara işaret etsin istenirse: **Settings → Pages → Custom domain** alanına
`legal.suflor.app` yazılır, DNS'te aynı ada `moztechdev.github.io` için bir `CNAME` kaydı açılır. GitHub
bir `CNAME` dosyasını repoya kendisi ekler; sertifikayı da kendisi alır. App Store Connect'teki URL o zaman
güncellenir — **eski adres çalışmaya devam etsin diye önce alan adı bağlanır, sonra mağazadaki bağlantı
değiştirilir.**

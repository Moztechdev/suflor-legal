/// Suflor'un hukuki metinlerini veritabanından okuyup statik HTML'e çevirir.
///
/// NEDEN ÜRETİLİYOR, ELLE YAZILMIYOR: metnin sahibi bu repo değil, `legal_document_texts` tablosu — aynı
/// satırları Flutter uygulaması da okuyor ve yönetim paneli düzenliyor. Buraya HTML'i elle kopyalasaydık
/// metin iki nüsha olurdu ve panelden yapılan bir düzeltme App Store'un gösterdiği sayfaya yansımazdı.
/// Uygulamada bir şey, sitede başka bir şey yazan bir gizlilik politikası, hiç olmamasından daha kötüdür.
///
/// Anahtar: `anon`. Servis anahtarı BURAYA GİRMEZ ve gerekmiyor — iki tablo da `anon`'a select veriyor
/// (bkz. ana repo, 20260726150000_legal_documents.sql). `anon` anahtarı zaten Flutter paketinin içinde,
/// yani halka açık olması tasarım gereği; RLS'i bypass etmez.

import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "docs");

const SITE_NAME = "Suflor";
const COMPANY = "Moz Teknoloji ve Tasarım Limited Şirketi";
const CONTACT = "suflorapp@gmail.com";

/// Veritabanından gelen belgeler. `script_consent` bilerek yok: o, uygulama içinde senaryo yüklerken
/// onaylanan bir metin, herkese açık bir politika değil.
///
/// Sağlayıcı listesi de burada değil — o sayfa panelden düzenlenen bir metin olmadığı için üreticinin
/// kendi içinde duruyor (aşağıdaki PROVIDERS ve THIRD_PARTY).
const DOCS = [
  { slug: "privacy", locale: "tr", path: "aydinlatma-metni", label: "Aydınlatma Metni" },
  { slug: "terms", locale: "tr", path: "kullanim-ve-hizmet-sozlesmesi", label: "Kullanım ve Hizmet Sözleşmesi" },
  { slug: "privacy", locale: "en", path: "en/privacy-notice", label: "Privacy Notice" },
  { slug: "terms", locale: "en", path: "en/terms-of-service", label: "Terms of Service" },
];

/// Eski adresler. Belgelerin adı değişince yolları da değişti, ama bu adresler App Store ve Play
/// listelerinde yazılı ve dışarıya verilmiş olabilir — 404 vermek yerine yeni adrese götüren bir sayfa
/// bırakılıyor. Mağaza alanları güncellendikten sonra bu liste boşaltılabilir.
const MOVED = [
  { from: "gizlilik", to: "aydinlatma-metni", locale: "tr" },
  { from: "kullanim-sartlari", to: "kullanim-ve-hizmet-sozlesmesi", locale: "tr" },
  { from: "en/privacy", to: "en/privacy-notice", locale: "en" },
  { from: "en/terms", to: "en/terms-of-service", locale: "en" },
];

const MOVED_TEXT = {
  tr: { title: "Bu sayfa taşındı", body: "Belgenin yeni adresi:", link: "Yeni adrese git" },
  en: { title: "This page has moved", body: "The document is now at:", link: "Go to the new address" },
};

const LOCALE_META = {
  tr: { htmlLang: "tr", updated: "Son güncelleme", home: "Suflor", other: "English", back: "Tüm belgeler" },
  en: { htmlLang: "en", updated: "Last updated", home: "Suflor", other: "Türkçe", back: "All documents" },
};

/// Destek sayfası. İçeriği veritabanından gelmiyor: bu bir politika değil, App Store ve Play'in zorunlu
/// tuttuğu iletişim sayfası — panelden düzenlenecek bir metni yok. Yine de HTML'i elle `docs/` içine
/// koymak yerine burada üretiliyor, çünkü main() her çalıştığında o klasörü siliyor; elle konan dosya ilk
/// yeniden üretimde kaybolur ve mağazaya verilen Support URL sessizce 404'e döner.
///
/// Metinlerde HTML'e izin var (bağlantılar için) — bunlar burada yazılmış sabitler, dışarıdan gelen veri
/// değil. Yalnızca soru başlıkları escape ediliyor.
const SUPPORT = {
  tr: {
    path: "destek",
    label: "Destek",
    title: "Destek",
    description: "Suflor destek sayfası — iletişim ve sık sorulan sorular.",
    intro: [
      "Bir sorun mu yaşadın? Bir şey mi anlaşılmadı? Suflörle ilgili fikirlerini mi paylaşmak istiyorsun? Biz buradayız!",
      `Bize ulaşmak için: Uygulama içinden Profil → Bize Yaz, ya da doğrudan
       <a href="mailto:${CONTACT}">${CONTACT}</a> adresine yazabilirsin. Mesajlarını en geç iki iş günü
       içinde yanıtlıyoruz.`,
      `İşini kolaylaştırmak için yazarken şunları eklersen çok yardımcı olur: hesabında kullandığın e-posta
       adresi, cihaz modelin ve iOS/Android sürümün, sorunun tam olarak ne yaparken ortaya çıktığı.`,
    ],
    faq: [
      [
        "Krediler nasıl çalışır?",
        [
          `Prova yapmak hiçbir zaman kredi harcamaz, istediğin kadar çalışabilirsin. Kredi; senaryonu
           yükleyip analiz ettirdiğinde, replikleri yapay zekâyla seslendirttiğinde, bir repliği düzenleyip
           sesini yeniden ürettirdiğinde ve tamamladığın kaydı galeriye kaydettiğinde harcanır.`,
          `Hangi işlemin kaç krediye denk geldiğini, uygulama içindeki Kredi Satın Al ekranında her zaman
           güncel hâliyle görebilirsin.`,
        ],
      ],
      [
        "Satın aldığım kredi hesabıma geçmedi",
        [
          `Satın alma işlemi Apple veya Google üzerinden tamamlanıyor ve kredi genellikle birkaç saniye
           içinde hesabına yükleniyor. Görünmüyorsa önce uygulamayı tamamen kapatıp yeniden aç, çoğu zaman
           bu yeterli oluyor.`,
          `Sorun devam ederse satın alma tarihini ve mağazadan gelen makbuz numarasını bize yaz; işlemi
           kontrol edip kredini tanımlayalım.`,
        ],
      ],
      [
        "İade alabilir miyim?",
        [
          `Uygulama içi satın almaların iadesi mağaza tarafından yönetiliyor, biz mağaza adına iade işlemi
           yapamıyoruz. App Store için <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a>
           adresinden, Google Play için Play Store'daki sipariş geçmişin üzerinden talep oluşturabilirsin.`,
        ],
      ],
      [
        "Hesabımı nasıl silerim?",
        [
          `Uygulama içinden Profil → Hesabı Sil adımlarıyla bize veda edebilirsin. Onayladığında
           senaryoların, kayıtların ve kullanılmamış kredilerin hesabından kalıcı olarak kaldırılır ve bu
           işlem geri alınamaz. Yalnızca yasal olarak saklamamız gereken bilgiler bunun dışında kalır.`,
          `Bir öneri: silmeden önce varsa kalan kredilerini kullanmayı unutma, çünkü hesap silindikten sonra
           bunları geri getiremiyoruz.`,
        ],
      ],
      [
        "Yüklediğim senaryoya ne oluyor?",
        [
          `Senaryon, karakter ve replik akışına ayrılabilmesi için işleniyor. Hangi verinin hangi amaçla
           işlendiğini ve ne kadar süreyle saklandığını <a href="{PRIVACY}">Aydınlatma Metni</a>'nde
           ayrıntılı şekilde bulabilirsin.`,
        ],
      ],
      [
        "Çektiğim video nerede?",
        [
          `Kaydını tamamlayıp galeriye kaydettiğinde video doğrudan telefonunun galerisine düşer, bizim
           sunucularımıza hiç yüklenmez.`,
        ],
      ],
    ],
    closing: "Burada cevabını bulamadığın soru, öneri veya şikayetin varsa, bize yazmayı unutma!",
  },
  en: {
    path: "en/support",
    label: "Support",
    title: "Support",
    description: "Suflor support — contact and frequently asked questions.",
    intro: [
      "Run into a problem? Something unclear? Want to share what you think about Suflor? We are here.",
      `To reach us: inside the app, go to Profile → Write to Us, or email
       <a href="mailto:${CONTACT}">${CONTACT}</a> directly. We answer within two business days at the latest.`,
      `It helps us a lot if you include: the email address on your account, your device model and iOS/Android
       version, and exactly what you were doing when the problem appeared.`,
    ],
    faq: [
      [
        "How do credits work?",
        [
          `Rehearsing never costs credits — practise as much as you like. Credits are spent when you upload a
           script for analysis, have lines voiced by AI, edit a line and have its audio regenerated, and when
           you save a finished recording to your gallery.`,
          `You can always see the current cost of each action on the Buy Credits screen in the app.`,
        ],
      ],
      [
        "I bought credits but they have not arrived",
        [
          `The purchase is completed through Apple or Google, and credits usually land in your account within
           a few seconds. If you cannot see them, close the app completely and open it again — that is
           usually enough.`,
          `If the problem persists, send us the date of the purchase and the receipt number from the store,
           and we will check the transaction and add your credits.`,
        ],
      ],
      [
        "Can I get a refund?",
        [
          `Refunds for in-app purchases are handled by the store; we cannot issue a refund on the store's
           behalf. For the App Store, request one at
           <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a>; for Google Play, use your
           order history in the Play Store.`,
        ],
      ],
      [
        "How do I delete my account?",
        [
          `You can say goodbye from Profile → Delete Account inside the app. Once you confirm, your scripts,
           recordings and unused credits are permanently removed from your account, and this cannot be
           undone. Only information we are legally required to keep remains.`,
          `One suggestion: use any remaining credits before you delete, because we cannot restore them once
           the account is gone.`,
        ],
      ],
      [
        "What happens to the script I upload?",
        [
          `Your script is processed so it can be split into characters and lines. Which data is processed for
           which purpose, and how long it is kept, is set out in detail in the
           <a href="{PRIVACY}">Privacy Notice</a>.`,
        ],
      ],
      [
        "Where is the video I recorded?",
        [
          `When you finish a recording and save it, the video goes straight to your phone's gallery. It is
           never uploaded to our servers.`,
        ],
      ],
    ],
    closing: "If your question is not answered here, or you have a suggestion or a complaint, write to us.",
  },
};

/// Destek sayfasından gizlilik politikasına giden yol, dile göre değişiyor (tr → gizlilik, en →
/// en/privacy) ve sayfanın derinliğine göre relative çözülmesi gerekiyor.
const PRIVACY_PATH = { tr: "aydinlatma-metni", en: "en/privacy-notice" };

function env(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} tanımlı değil. Yerelde .env dosyasına yaz, GitHub Actions'ta repo secret olarak ekle (README).`,
    );
  }
  return value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/// Metin kutusundan gelen düz yazıyı paragraflara böler. Boş satır yeni paragraf, tek satır başı ise
/// aynı paragraf içinde satır sonu — panelde "a) ...\nb) ..." diye yazılan maddeler böylece bitişik kalmaz.
/// Gövde metnindeki `[görünen metin](adres)` işaretlemesini bağlantıya çevirir.
///
/// Metin veritabanından geliyor ve panelden düzenlenebiliyor, yani HTML'e izin verilemez — bu yüzden gövde
/// önce kaçırılıyor, bağlantılar ancak ondan sonra kuruluyor. Hukuk metninde bir adresi cümlenin içine
/// gömmenin başka yolu yok: avukat ham adreslerin silinip ifadenin kendisinin bağlanmasını istedi.
///
/// Yalnızca https ve mailto kabul ediliyor; başka bir şema yazılmışsa bağlantı kurulmuyor, metin olduğu
/// gibi kalıyor. `javascript:` gibi bir adresin panelden metne girip tıklanabilir hâle gelmesi istenmez.
function linkify(escaped) {
  return escaped.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (match, label, href) => {
    return `<a href="${href}">${label}</a>`;
  });
}

function toParagraphs(body) {
  return String(body ?? "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${linkify(escapeHtml(block)).replaceAll("\n", "<br />")}</p>`)
    .join("\n        ");
}

function formatDate(value, locale) {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

/// Sayfanın kendi köküne göre relative yol. GitHub Pages sitesi alan adının kökünde değil de
/// /suflor-legal/ altında dururken mutlak yollar ("/style.css") kırılır; bu yüzden her sayfa CSS'e ve
/// diğer belgelere kaç seviye yukarıdan ulaşacağını kendi derinliğinden hesaplar.
function upTo(path) {
  const depth = path === "" ? 0 : path.split("/").length;
  return depth === 0 ? "./" : "../".repeat(depth);
}

function layout({ path, locale, title, description, body, head = "" }) {
  const meta = LOCALE_META[locale];
  const up = upTo(path);

  return `<!doctype html>
<html lang="${meta.htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — ${SITE_NAME}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="stylesheet" href="${up}style.css" />${head}
  </head>
  <body>
    <header class="top">
      <a class="brand" href="${up}">${SITE_NAME}</a>
    </header>
    <main>
${body}
    </main>
    <footer>
      <p>${escapeHtml(COMPANY)}</p>
      <p><a href="mailto:${CONTACT}">${CONTACT}</a></p>
    </footer>
  </body>
</html>
`;
}

function documentPage(doc, row, siblingPath) {
  const meta = LOCALE_META[doc.locale];
  const up = upTo(doc.path);
  const sections = Array.isArray(row.sections) ? row.sections : [];

  // İlk bölümün başlığı belgenin adıyla aynı (veritabanındaki metin böyle yazılmış); onu ikinci kez
  // başlık olarak basmak sayfanın en üstünde aynı cümleyi iki kere gösterirdi.
  const rendered = sections
    .map((section, index) => {
      const heading = String(section?.title ?? "").trim();
      const showHeading = heading && !(index === 0 && heading === String(row.title ?? "").trim());
      return [
        showHeading ? `      <h2>${escapeHtml(heading)}</h2>` : null,
        `        ${toParagraphs(section?.body)}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const body = `      <h1>${escapeHtml(row.title || doc.label)}</h1>
      <p class="updated">${meta.updated}: ${escapeHtml(formatDate(row.updated_at, doc.locale))}</p>
      ${siblingPath ? `<p class="switch"><a href="${up}${siblingPath}/">${meta.other}</a></p>` : ""}
${rendered}
      <p class="switch"><a href="${up}">${meta.back}</a></p>`;

  return layout({
    path: doc.path,
    locale: doc.locale,
    title: row.title || doc.label,
    description: `${SITE_NAME} — ${row.title || doc.label}`,
    body,
  });
}

/// Üçüncü taraf hizmet listesi. Kullanım ve Hizmet Sözleşmesi ile Aydınlatma Metni bu sayfaya atıf yapıyor,
/// bu yüzden adresi sabit kalmalı: bir sağlayıcı eklendiğinde sayfa güncellenir, sözleşme değişmez.
///
/// İçeriği veritabanından gelmiyor. Panelden düzenlenecek bir metin değil — hangi sağlayıcıyı kullandığımız
/// koda ve altyapıya bağlı bir olgu, ve bir satırın eklenmesi kod değişikliğiyle aynı anda olmalı ki sayfa
/// ile gerçek birbirinden ayrılmasın.
const PROVIDERS = [
  {
    name: "Google Gemini API",
    purpose: { tr: "Senaryo analizi, dil tespiti, karakter/replik ayrıştırma", en: "Script analysis, language detection, character and line splitting" },
    terms: [["Kullanım Şartları", "Terms of Service", "https://ai.google.dev/gemini-api/terms"]],
    privacy: [["Gizlilik Politikası", "Privacy Policy", "https://policies.google.com/privacy"]],
    dpa: [
      ["Veri İşleme Ek Sözleşmesi", "Data Processing Addendum", "https://business.safety.google/processorterms/"],
      ["Standart Sözleşme Maddeleri", "Standard Contractual Clauses", "https://business.safety.google/gdprcontrollerterms/sccs/eu-c2p-dpa/"],
    ],
  },
  {
    name: { tr: "Google (Giriş)", en: "Google (Sign-in)" },
    purpose: { tr: "Google hesabıyla giriş", en: "Sign in with Google" },
    terms: [["Kullanım Şartları", "Terms of Service", "https://policies.google.com/terms"]],
    privacy: [["Gizlilik Politikası", "Privacy Policy", "https://policies.google.com/privacy"]],
    dpa: "googleSignin",
  },
  {
    name: "ElevenLabs",
    purpose: { tr: "Yapay zekâ ile seslendirme", en: "AI voice generation" },
    terms: [
      ["Kullanım Şartları", "Terms of Use", "https://elevenlabs.io/terms-of-use"],
      ["AEA Kullanım Şartları", "EEA Terms of Use", "https://elevenlabs.io/terms-of-use-eu"],
    ],
    privacy: [["Gizlilik Politikası", "Privacy Policy", "https://elevenlabs.io/privacy-policy"]],
    dpa: [
      ["Veri İşleme Ek Sözleşmesi", "Data Processing Addendum", "https://elevenlabs.io/dpa"],
      ["Veri Kullanımı / Model Geliştirme", "Data use / model training", "https://elevenlabs.io/docs/help-center/legal/is-my-data-used-to-improve-eleven-labs-ai-models"],
    ],
  },
  {
    name: "Deepgram",
    purpose: { tr: "Konuşma tanıma, replik takibi", en: "Speech recognition, line tracking" },
    terms: [["Kullanım Şartları", "Terms of Service", "https://deepgram.com/terms"]],
    privacy: [["Güvenlik ve Gizlilik", "Security and Privacy", "https://developers.deepgram.com/trust-security/information-security-privacy"]],
    dpa: "deepgram",
  },
  {
    name: "Supabase",
    purpose: { tr: "Veritabanı ve dosya depolama altyapısı", en: "Database and file storage infrastructure" },
    terms: [["Kullanım Şartları", "Terms of Service", "https://supabase.com/terms"]],
    privacy: [["Gizlilik Politikası", "Privacy Policy", "https://supabase.com/privacy"]],
    dpa: [["Veri İşleme Ek Sözleşmesi", "Data Processing Addendum", "https://supabase.com/legal/customer-resources/data-processing-addendum"]],
  },
  {
    name: "Cloudflare R2",
    purpose: { tr: "Üretilen ses kliplerinin depolanması", en: "Storage of generated audio clips" },
    terms: [["Kullanım Şartları", "Terms of Use", "https://www.cloudflare.com/terms/"]],
    privacy: [["Gizlilik Politikası", "Privacy Policy", "https://www.cloudflare.com/privacypolicy/"]],
    dpa: [["Veri İşleme Ek Sözleşmesi", "Data Processing Addendum", "https://www.cloudflare.com/cloudflare-customer-dpa/"]],
  },
  {
    name: "OneSignal",
    purpose: { tr: "Anlık bildirimler", en: "Push notifications" },
    terms: [["Kullanım Şartları", "Terms of Service", "https://onesignal.com/terms"]],
    privacy: [["Gizlilik Politikası", "Privacy Policy", "https://onesignal.com/privacy_policy"]],
    dpa: [["Veri İşleme Ek Sözleşmesi", "Data Processing Addendum", "https://onesignal.com/dpa"]],
  },
  {
    name: "Sentry",
    purpose: { tr: "Hata izleme ve oturum kaydı (metin ve görseller maskelenir)", en: "Error monitoring and session replay (text and images are masked)" },
    terms: [["Kullanım Şartları", "Terms of Service", "https://sentry.io/terms/"]],
    privacy: [["Gizlilik Politikası", "Privacy Policy", "https://sentry.io/privacy/"]],
    dpa: [["Veri İşleme Ek Sözleşmesi", "Data Processing Addendum", "https://sentry.io/legal/dpa/"]],
  },
  {
    name: "RevenueCat",
    purpose: { tr: "Satın alma ve abonelik yönetimi", en: "Purchase and subscription management" },
    terms: [["Kullanım Şartları", "Terms of Service", "https://www.revenuecat.com/terms"]],
    privacy: [["Gizlilik Politikası", "Privacy Policy", "https://www.revenuecat.com/privacy"]],
    dpa: [["Veri İşleme Ek Sözleşmesi", "Data Processing Addendum", "https://www.revenuecat.com/dpa"]],
  },
  {
    name: { tr: "Apple (Giriş, IAP, Bildirim)", en: "Apple (Sign-in, IAP, Notifications)" },
    purpose: { tr: "Apple ile giriş, uygulama içi satın alma, bildirim altyapısı", en: "Sign in with Apple, in-app purchases, notification infrastructure" },
    terms: [["Apple Medya Hizmetleri Şartları", "Apple Media Services Terms", "https://www.apple.com/legal/internet-services/itunes/us/terms.html"]],
    privacy: [["Gizlilik Politikası", "Privacy Policy", "https://www.apple.com/legal/privacy/en-ww/"]],
    dpa: "apple",
  },
  {
    name: "Apple AdServices",
    purpose: { tr: "Reklam ölçümü (IDFA kullanılmaz)", en: "Ad attribution (IDFA is not used)" },
    terms: [["Teknik Dokümantasyon", "Technical documentation", "https://developer.apple.com/documentation/adservices"]],
    privacy: [["Apple Reklamcılık ve Gizlilik", "Apple Advertising and Privacy", "https://www.apple.com/legal/privacy/data/en/apple-advertising/"]],
    dpa: "apple",
  },
];

const THIRD_PARTY = {
  tr: {
    path: "ucuncu-taraf-hizmetler",
    label: "Kullanılan Üçüncü Taraf Hizmetler",
    title: "Kullanılan Üçüncü Taraf Hizmetler",
    description: "Suflor'un kullandığı üçüncü taraf hizmet sağlayıcılarının güncel listesi.",
    updated: "Son güncelleme: 15.09.2026",
    columns: ["Sağlayıcı", "Kullanım Amacı", "Kullanım Şartları", "Gizlilik Politikası", "Veri İşleme Sözleşmesi (DPA)"],
    intro: [
      `Bu sayfa, SUFLÖR Kullanım ve Hizmet Sözleşmesi Md. 21.5 ve KVKK Aydınlatma Metni'nde atıf yapılan,
       hâlihazırda kullanılan üçüncü taraf hizmet sağlayıcılarının güncel listesidir. Bu sayfanın
       güncellenmesi (bir sağlayıcının eklenmesi, kaldırılması veya bir bağlantının değişmesi) Sözleşme'nin
       veya Aydınlatma Metni'nin değiştirilmesi anlamına gelmez; yalnızca mevcut yükümlülüklerin fiilen
       hangi sağlayıcı üzerinden yerine getirildiğini gösterir. Sağlayıcı değişikliği kişisel veri işleme
       faaliyetlerinin kapsamını değiştiriyorsa, bu durum ayrıca Sözleşme ve/veya Aydınlatma Metni
       güncellemesiyle bildirilir.`,
    ],
    outro: [
      `Üçüncü taraf sağlayıcıların kendi şart ve politikaları zaman içinde değişebilir; güncel içerik için
       ilgili sağlayıcının kendi sitesine bakılması önerilir. Bu sayfa, kullanıcıların bilgilendirilmesi
       amacıyla hazırlanmıştır ve sağlayıcıların kendi metinlerinin yerine geçmez.`,
    ],
    notes: {
      deepgram: `Deepgram, standart veri işleme sözleşmesini kamuya açık bir bağlantı olarak yayımlamamaktadır; sözleşme
       (Standart Sözleşme Maddelerini içerecek şekilde) yalnızca sağlayıcıya doğrudan talep iletilerek
       (<a href="mailto:security@deepgram.com">security@deepgram.com</a>) temin edilebilmektedir.`,
      apple: `Apple; giriş, uygulama içi satın alma, bildirim altyapısı ve reklam ölçümü işlemlerinde SUFLÖR'ün
       değil kendi Gizlilik Politikası'nın uygulandığı bağımsız bir veri sorumlusu sıfatıyla hareket
       etmektedir; bu nedenle geliştiricilerle kamuya açık, imzalanabilir bir veri işleme sözleşmesi
       paylaşmamaktadır.`,
      googleSignin: `Google, hesabıyla giriş işleminde Apple ile aynı konumdadır: kimlik doğrulamayı kendi adına, kendi
       Gizlilik Politikası kapsamında yürütür. Gemini API ise bizim adımıza işleme yapar ve yukarıdaki veri
       işleme sözleşmesine tabidir.`,
    },
  },
  en: {
    path: "en/third-party-services",
    label: "Third-Party Services Used",
    title: "Third-Party Services Used",
    description: "The current list of third-party service providers Suflor uses.",
    updated: "Last updated: 15 September 2026",
    columns: ["Provider", "Purpose", "Terms", "Privacy Policy", "Data Processing Agreement"],
    intro: [
      `This page is the current list of third-party service providers in use, referenced in Article 21.5 of
       the Suflor Terms of Service and in the Privacy Notice. Updating this page — adding or removing a
       provider, or changing a link — does not amend the Terms or the Privacy Notice; it shows which
       provider currently carries out an existing obligation. Where a change of provider alters the scope of
       personal data processing, that change is announced separately through an update to the Terms and/or
       the Privacy Notice.`,
    ],
    outro: [
      `Providers may change their own terms and policies over time; for the current text, please refer to the
       provider's own site. This page is published for information and does not replace the providers' own
       documents.`,
    ],
    notes: {
      deepgram: `Deepgram does not publish its standard data processing agreement at a public address; it is provided
       (including the Standard Contractual Clauses) only on direct request to
       <a href="mailto:security@deepgram.com">security@deepgram.com</a>.`,
      apple: `For sign-in, in-app purchases, notification infrastructure and ad attribution, Apple acts as an
       independent controller under its own Privacy Policy rather than Suflor's, and therefore does not
       offer developers a public, signable data processing agreement.`,
      googleSignin: `For sign-in, Google is in the same position as Apple: it carries out authentication on its own
       behalf, under its own Privacy Policy. The Gemini API, by contrast, processes on our behalf and is
       covered by the data processing addendum above.`,
    },
  },
};

function thirdPartyPage(locale) {
  const page = THIRD_PARTY[locale];
  const meta = LOCALE_META[locale];
  const other = locale === "tr" ? "en" : "tr";
  const up = upTo(page.path);
  // Dipnot numaraları tablodan türetiliyor: bir sağlayıcı eklendiğinde ya da satırlar yer değiştirdiğinde
  // numaralar kendiliğinden düzeliyor. Elle yazılsaydı okuyucu 1'i aramaya üçüncü satırdan başlıyordu.
  const noteOrder = [];
  for (const provider of PROVIDERS) {
    if (typeof provider.dpa === "string" && !noteOrder.includes(provider.dpa)) noteOrder.push(provider.dpa);
  }
  const noteIndex = Object.fromEntries(noteOrder.map((name, index) => [name, index + 1]));

  const links = (list) =>
    typeof list === "string"
      ? `<span class="dash">—</span><sup>${noteIndex[list]}</sup>`
      : list
          .map(([tr, en, href]) => `<a href="${href}">${escapeHtml(locale === "tr" ? tr : en)}</a>`)
          .join("<br />");

  // Sütun başlıkları hücrelere data-label olarak da yazılıyor: dar ekranda tablo yığılıyor ve başlık satırı
  // kayboluyor, hücrenin hangi sütun olduğunu ancak bu söylüyor.
  const [nameColumn, purposeColumn, termsColumn, privacyColumn, dpaColumn] = page.columns;
  const rows = PROVIDERS.map(
    (provider) => `          <tr>
            <th scope="row" data-label="${escapeHtml(nameColumn)}">${escapeHtml(
              typeof provider.name === "string" ? provider.name : provider.name[locale],
            )}</th>
            <td data-label="${escapeHtml(purposeColumn)}">${escapeHtml(provider.purpose[locale])}</td>
            <td data-label="${escapeHtml(termsColumn)}">${links(provider.terms)}</td>
            <td data-label="${escapeHtml(privacyColumn)}">${links(provider.privacy)}</td>
            <td data-label="${escapeHtml(dpaColumn)}">${links(provider.dpa)}</td>
          </tr>`,
  ).join("\n");

  const paragraphs = (list) => list.map((text) => `      <p>${text}</p>`).join("\n");
  const notes = noteOrder
    .map((name, index) => `      <p class="note"><sup>${index + 1}</sup> ${page.notes[name]}</p>`)
    .join("\n");

  const body = `      <h1>${escapeHtml(page.title)}</h1>
      <p class="updated">${escapeHtml(page.updated)}</p>
      <p class="switch"><a href="${up}${THIRD_PARTY[other].path}/">${meta.other}</a></p>
${paragraphs(page.intro)}
      <div class="table-scroll">
        <table>
          <thead>
            <tr>${page.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join("")}</tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
${paragraphs(page.outro)}
${notes}
      <p class="switch"><a href="${up}">${meta.back}</a></p>`;

  return layout({ path: page.path, locale, title: page.title, description: page.description, body });
}

/// Eski adreste duran tek satırlık yönlendirme sayfası.
///
/// `meta refresh` ile hemen yeni adrese gidiyor, ama metin de yazılı: yenilemenin engellendiği ya da
/// çalışmadığı bir yerde kullanıcı en azından nereye gitmesi gerektiğini görüyor. `canonical` ise
/// arama motorlarının eski adresi yenisinin kopyası saymasını sağlıyor.
function movedPage(entry) {
  const text = MOVED_TEXT[entry.locale];
  const up = upTo(entry.from);
  const target = `${up}${entry.to}/`;

  return layout({
    path: entry.from,
    locale: entry.locale,
    title: text.title,
    description: text.title,
    head: `\n    <meta http-equiv="refresh" content="0; url=${target}" />\n    <link rel="canonical" href="${target}" />`,
    body: `      <h1>${escapeHtml(text.title)}</h1>
      <p>${escapeHtml(text.body)} <a href="${target}">${escapeHtml(text.link)}</a></p>`,
  });
}

function indexPage(published) {
  const links = published
    .map(
      ({ doc, row }) =>
        `        <li><a href="${doc.path}/">${escapeHtml(row.title || doc.label)}</a> <span>${
          doc.locale === "tr" ? "Türkçe" : "English"
        }</span></li>`,
    )
    .join("\n");

  const thirdPartyLinks = ["tr", "en"]
    .map(
      (locale) =>
        `        <li><a href="${THIRD_PARTY[locale].path}/">${escapeHtml(THIRD_PARTY[locale].label)}</a> <span>${
          locale === "tr" ? "Türkçe" : "English"
        }</span></li>`,
    )
    .join("\n");

  const supportLinks = ["tr", "en"]
    .map(
      (locale) =>
        `        <li><a href="${SUPPORT[locale].path}/">${escapeHtml(SUPPORT[locale].label)}</a> <span>${
          locale === "tr" ? "Türkçe" : "English"
        }</span></li>`,
    )
    .join("\n");

  return layout({
    path: "",
    locale: "tr",
    title: "Belgeler ve destek",
    description: `${SITE_NAME} gizlilik politikası, kullanım şartları ve destek sayfası.`,
    body: `      <h1>Belgeler ve destek</h1>
      <p>${escapeHtml(SITE_NAME)} uygulamasının yürürlükteki belgeleri.</p>
      <ul class="docs">
${links}
      </ul>
      <h2>Üçüncü taraf hizmetler</h2>
      <ul class="docs">
${thirdPartyLinks}
      </ul>
      <h2>Destek</h2>
      <ul class="docs">
${supportLinks}
      </ul>`,
  });
}

function supportPage(locale) {
  const page = SUPPORT[locale];
  const meta = LOCALE_META[locale];
  const other = locale === "tr" ? "en" : "tr";
  const up = upTo(page.path);

  const resolve = (html) => html.replaceAll("{PRIVACY}", `${up}${PRIVACY_PATH[locale]}/`);
  const paragraphs = (list) => list.map((text) => `      <p>${resolve(text)}</p>`).join("\n");

  const faq = page.faq
    .map(([question, answers]) => `      <h2>${escapeHtml(question)}</h2>\n${paragraphs(answers)}`)
    .join("\n");

  const body = `      <h1>${escapeHtml(page.title)}</h1>
      <p class="switch"><a href="${up}${SUPPORT[other].path}/">${meta.other}</a></p>
${paragraphs(page.intro)}
${faq}
      <p>${resolve(page.closing)}</p>
      <p class="switch"><a href="${up}">${meta.back}</a></p>`;

  return layout({
    path: page.path,
    locale,
    title: page.title,
    description: page.description,
    body,
  });
}

const STYLE = `:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --fg: #16181d;
  --muted: #5c6270;
  --rule: #e4e6eb;
  --link: #1c5bd4;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #101216;
    --fg: #e9eaee;
    --muted: #9aa1b1;
    --rule: #262a33;
    --link: #7aa7ff;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 16px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-text-size-adjust: 100%;
}

.top {
  border-bottom: 1px solid var(--rule);
  padding: 20px 24px;
}

.brand {
  color: var(--fg);
  font-weight: 650;
  letter-spacing: -0.01em;
  text-decoration: none;
}

main {
  margin: 0 auto;
  max-width: 46rem;
  padding: 40px 24px 64px;
}

h1 {
  font-size: 1.9rem;
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin: 0 0 8px;
}

h2 {
  border-top: 1px solid var(--rule);
  font-size: 1.15rem;
  letter-spacing: -0.01em;
  margin: 40px 0 12px;
  padding-top: 28px;
}

p { margin: 0 0 16px; }

a { color: var(--link); }

.table-scroll {
  margin: 1.5rem 0;
}

table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.9rem;
  table-layout: fixed;
}

th,
td {
  border: 1px solid var(--rule);
  padding: 0.5rem 0.6rem;
  text-align: left;
  vertical-align: top;
  overflow-wrap: break-word;
}

thead th {
  font-weight: 600;
}

tbody th {
  font-weight: 600;
}

td .dash {
  color: var(--muted);
}

/* Dar ekranda beş sütun sığmıyor; yatay kaydırma yerine her sağlayıcı bir kart oluyor. Başlık satırı
   kayboluyor, sütun adını hücrenin kendi data-label'ı taşıyor. */
@media (max-width: 40rem) {
  table,
  tbody,
  tbody tr,
  tbody th,
  tbody td {
    display: block;
    width: auto;
  }

  thead {
    display: none;
  }

  tbody tr {
    border: 1px solid var(--rule);
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.9rem;
  }

  tbody th,
  tbody td {
    border: 0;
    padding: 0.2rem 0;
  }

  tbody th {
    font-size: 1rem;
    margin-bottom: 0.3rem;
  }

  tbody td::before {
    content: attr(data-label);
    display: block;
    color: var(--muted);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
}

.note {
  color: var(--muted);
  font-size: 0.9rem;
}

.updated,
.switch {
  color: var(--muted);
  font-size: 0.9rem;
}

.docs {
  list-style: none;
  margin: 28px 0 0;
  padding: 0;
}

.docs li {
  border-top: 1px solid var(--rule);
  padding: 16px 0;
}

.docs span {
  color: var(--muted);
  font-size: 0.85rem;
  margin-left: 8px;
}

footer {
  border-top: 1px solid var(--rule);
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0 auto;
  max-width: 46rem;
  padding: 24px;
}

footer p { margin: 0 0 4px; }
`;

async function main() {
  const url = env("SUPABASE_URL").replace(/\/+$/, "");
  const key = env("SUPABASE_ANON_KEY");

  const response = await fetch(
    `${url}/rest/v1/legal_document_texts?select=slug,locale,title,sections,updated_at&slug=in.(privacy,terms)`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }

  const rows = await response.json();

  // Eski çıktının üstüne yazmak yerine klasörü sıfırlıyoruz: veritabanından kaldırılan bir belgenin
  // HTML'i sitede kalmaya devam etseydi, yürürlükten kalkmış bir metin yayında görünürdü.
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const published = [];

  for (const doc of DOCS) {
    const row = rows.find((item) => item.slug === doc.slug && item.locale === doc.locale);
    if (!row) {
      console.warn(`atlandı: ${doc.slug}/${doc.locale} — veritabanında bu dilde satır yok`);
      continue;
    }
    published.push({ doc, row });
  }

  for (const entry of published) {
    const sibling = published.find(
      ({ doc }) => doc.slug === entry.doc.slug && doc.locale !== entry.doc.locale,
    );
    const target = join(OUT, entry.doc.path, "index.html");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, documentPage(entry.doc, entry.row, sibling?.doc.path ?? null), "utf8");
    console.log(`yazıldı: docs/${entry.doc.path}/index.html`);
  }

  // Destek sayfaları veritabanına bakmıyor, bu yüzden bir belgenin eksik olması onları etkilemez —
  // mağazaya verilen Support URL her üretimde yerinde durmalı.
  for (const locale of ["tr", "en"]) {
    const target = join(OUT, SUPPORT[locale].path, "index.html");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, supportPage(locale), "utf8");
    console.log(`yazıldı: docs/${SUPPORT[locale].path}/index.html`);
  }

  // Sözleşme ve aydınlatma metni bu sayfaya atıf yapıyor; destek sayfası gibi veritabanına bakmıyor, bu
  // yüzden bir belgenin eksik olması onu da etkilemez.
  for (const locale of ["tr", "en"]) {
    const target = join(OUT, THIRD_PARTY[locale].path, "index.html");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, thirdPartyPage(locale), "utf8");
    console.log(`yazıldı: docs/${THIRD_PARTY[locale].path}/index.html`);
  }

  for (const entry of MOVED) {
    const target = join(OUT, entry.from, "index.html");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, movedPage(entry), "utf8");
    console.log(`yazıldı: docs/${entry.from}/index.html (taşındı → ${entry.to})`);
  }

  await writeFile(join(OUT, "index.html"), indexPage(published), "utf8");
  await writeFile(join(OUT, "style.css"), STYLE, "utf8");
  // GitHub Pages varsayılan olarak çıktıyı Jekyll'den geçirir; bu dosya onu kapatır. Olmazsa alt çizgiyle
  // başlayan klasörler sessizce yayınlanmaz.
  await writeFile(join(OUT, ".nojekyll"), "", "utf8");

  console.log(`yazıldı: docs/index.html, docs/style.css (${published.length} belge)`);
}

await main();

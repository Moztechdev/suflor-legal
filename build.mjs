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
const CONTACT = "destek@suflor.app";

/// Yayınlanan belgeler. `script_consent` bilerek yok: o, uygulama içinde senaryo yüklerken onaylanan bir
/// metin, herkese açık bir politika değil.
const DOCS = [
  { slug: "privacy", locale: "tr", path: "gizlilik", label: "Gizlilik Politikası" },
  { slug: "terms", locale: "tr", path: "kullanim-sartlari", label: "Kullanım Şartları" },
  { slug: "privacy", locale: "en", path: "en/privacy", label: "Privacy Policy" },
  { slug: "terms", locale: "en", path: "en/terms", label: "Terms of Use" },
];

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
      "Suflor, oyuncuların senaryolarını yükleyip prova yaptığı ve audition kaydı aldığı bir uygulamadır.",
      `Sorunuz, hata bildiriminiz veya talebiniz için <a href="mailto:${CONTACT}">${CONTACT}</a> adresine
       yazın. Mesajlarınızı iki iş günü içinde yanıtlıyoruz.`,
      "Daha hızlı çözebilmemiz için yazarken şunları ekleyin: hesabınızda kullandığınız e-posta adresi, " +
        "cihaz modeliniz ve iOS/Android sürümünüz, sorunun ne yaparken oluştuğu.",
    ],
    faq: [
      [
        "Krediler nasıl çalışır?",
        [
          "Prova yapmak hiçbir zaman kredi harcamaz. Kredi; senaryo yükleyip analiz ettirirken, replikler " +
            "seslendirilirken, bir repliği düzenleyip sesini yeniden ürettirirken ve tamamladığınız kaydı " +
            "galeriye kaydederken harcanır.",
          "Hangi işlemin kaç kredi olduğunu uygulama içindeki Kredi Satın Al ekranında güncel hâliyle " +
            "görebilirsiniz.",
        ],
      ],
      [
        "Satın aldığım kredi hesabıma geçmedi",
        [
          "Satın alma Apple veya Google üzerinden tamamlanır, kredi genellikle birkaç saniye içinde " +
            "yüklenir. Yüklenmediyse önce uygulamayı tamamen kapatıp yeniden açın.",
          "Sorun sürerse satın alma tarihini ve mağazadan gelen makbuz numarasını bize yazın; işlemi " +
            "kontrol edip krediyi elle tanımlayalım.",
        ],
      ],
      [
        "İade alabilir miyim?",
        [
          "Uygulama içi satın almaların iadesini mağaza yapıyor, biz mağaza adına iade işleme " +
            'alamıyoruz. App Store için <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a>, ' +
            "Google Play için Play Store'daki sipariş geçmişiniz üzerinden talep oluşturabilirsiniz.",
        ],
      ],
      [
        "Hesabımı nasıl silerim?",
        [
          "Uygulama içinden: Profil → Hesabı Sil. Onayladığınızda tüm senaryolarınız, kayıtlarınız ve " +
            "kalan krediniz kalıcı olarak silinir; bu işlem geri alınamaz.",
        ],
      ],
      [
        "Yüklediğim senaryoya ne oluyor?",
        [
          "Senaryonuz, karakter ve replik akışına ayrılabilmesi için işlenir. Hangi verinin ne amaçla " +
            'işlendiği ve ne kadar saklandığı <a href="{PRIVACY}">Gizlilik Politikası</a>\'nda yazıyor.',
        ],
      ],
      [
        "Çektiğim video nerede?",
        [
          "Kaydı tamamlayıp galeriye kaydettiğinizde video doğrudan telefonunuzun galerisine düşer.",
        ],
      ],
    ],
  },
  en: {
    path: "en/support",
    label: "Support",
    title: "Support",
    description: "Suflor support — contact and frequently asked questions.",
    intro: [
      "Suflor is an app where actors upload their scripts, rehearse, and record audition takes.",
      `For questions, bug reports or requests, write to <a href="mailto:${CONTACT}">${CONTACT}</a>. We
       reply within two business days.`,
      "To help us resolve it faster, include the email address on your account, your device model and " +
        "iOS/Android version, and what you were doing when the problem happened.",
    ],
    faq: [
      [
        "How do credits work?",
        [
          "Rehearsing never costs credits. Credits are spent when a script is uploaded and analysed, when " +
            "lines are voiced, when you edit a line and its audio is regenerated, and when you save a " +
            "finished take to your photo library.",
          "The current cost of each action is shown on the Buy Credits screen inside the app.",
        ],
      ],
      [
        "I bought credits but they didn't arrive",
        [
          "Purchases are completed through Apple or Google and credits usually land within seconds. If " +
            "they don't, close the app completely and reopen it.",
          "If the problem persists, send us the purchase date and the receipt number from the store and " +
            "we'll check the transaction and add the credits manually.",
        ],
      ],
      [
        "Can I get a refund?",
        [
          "Refunds for in-app purchases are handled by the store, not by us. For the App Store, use " +
            '<a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a>; for Google Play, ' +
            "request it from your order history in the Play Store.",
        ],
      ],
      [
        "How do I delete my account?",
        [
          "In the app: Profile → Delete Account. Once confirmed, all of your scripts, recordings and " +
            "remaining credits are permanently deleted; this cannot be undone.",
        ],
      ],
      [
        "What happens to the script I upload?",
        [
          "Your script is processed so it can be split into characters and lines. What is processed, why, " +
            'and how long it is kept is described in the <a href="{PRIVACY}">Privacy Policy</a>.',
        ],
      ],
      [
        "Where is the video I recorded?",
        ["Once you finish a take and save it, the video goes straight to your phone's photo library."],
      ],
    ],
  },
};

/// Destek sayfasından gizlilik politikasına giden yol, dile göre değişiyor (tr → gizlilik, en →
/// en/privacy) ve sayfanın derinliğine göre relative çözülmesi gerekiyor.
const PRIVACY_PATH = { tr: "gizlilik", en: "en/privacy" };

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
function toParagraphs(body) {
  return String(body ?? "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br />")}</p>`)
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

function layout({ path, locale, title, description, body }) {
  const meta = LOCALE_META[locale];
  const up = upTo(path);

  return `<!doctype html>
<html lang="${meta.htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — ${SITE_NAME}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="stylesheet" href="${up}style.css" />
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

function indexPage(published) {
  const links = published
    .map(
      ({ doc, row }) =>
        `        <li><a href="${doc.path}/">${escapeHtml(row.title || doc.label)}</a> <span>${
          doc.locale === "tr" ? "Türkçe" : "English"
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
${paragraphs(page.intro)}
      <p class="switch"><a href="${up}${SUPPORT[other].path}/">${meta.other}</a></p>
${faq}
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

  await writeFile(join(OUT, "index.html"), indexPage(published), "utf8");
  await writeFile(join(OUT, "style.css"), STYLE, "utf8");
  // GitHub Pages varsayılan olarak çıktıyı Jekyll'den geçirir; bu dosya onu kapatır. Olmazsa alt çizgiyle
  // başlayan klasörler sessizce yayınlanmaz.
  await writeFile(join(OUT, ".nojekyll"), "", "utf8");

  console.log(`yazıldı: docs/index.html, docs/style.css (${published.length} belge)`);
}

await main();

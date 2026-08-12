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

  return layout({
    path: "",
    locale: "tr",
    title: "Hukuki metinler",
    description: `${SITE_NAME} gizlilik politikası ve kullanım şartları.`,
    body: `      <h1>Hukuki metinler</h1>
      <p>${escapeHtml(SITE_NAME)} uygulamasının yürürlükteki belgeleri.</p>
      <ul class="docs">
${links}
      </ul>`,
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

  await writeFile(join(OUT, "index.html"), indexPage(published), "utf8");
  await writeFile(join(OUT, "style.css"), STYLE, "utf8");
  // GitHub Pages varsayılan olarak çıktıyı Jekyll'den geçirir; bu dosya onu kapatır. Olmazsa alt çizgiyle
  // başlayan klasörler sessizce yayınlanmaz.
  await writeFile(join(OUT, ".nojekyll"), "", "utf8");

  console.log(`yazıldı: docs/index.html, docs/style.css (${published.length} belge)`);
}

await main();

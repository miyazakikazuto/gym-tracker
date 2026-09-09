// Service worker untuk Gym Tracker — ditulis ke dist/sw.js saat build (postbuild).
// Strategi:
//   - PRECACHE: SEMUA file (shell + seluruh chunk + icons + manifest) — app langsung
//     100% offline-proof setelah satu kunjungan online pasca-deploy
//   - cache.add() per file: partial failure tolerance (1 file gagal tidak membatalkan SW)
const fs = require('fs')
const path = require('path')

const dist = path.join(__dirname, '..', 'dist')
// Single source of truth: src/lib/base.ts — jangan duplikat string base di sini.
// CJS tidak bisa import TS langsung, jadi baca file TS untuk sinkronisasi (best-effort).
let base = process.env.VERCEL ? '/' : '/gym-tracker/'
try {
  const baseSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'base.ts'), 'utf8')
  // Validasi: pastikan base.ts masih pakai pola VERCEL ? '/' : '/gym-tracker/'
  if (!baseSrc.includes("'/gym-tracker/'") || !baseSrc.includes("VERCEL")) {
    console.warn('[gen-sw] base.ts pattern changed — verify base sync with vite.config.ts')
  }
} catch { /* ignore — fallback ke env check di atas */ }

// ===== Kumpulkan semua file (untuk lazy cache) =====
const allFiles = []
const scan = (dir, prefix) => {
  const p = path.join(dist, dir)
  if (!fs.existsSync(p)) return
  for (const f of fs.readdirSync(p)) {
    const full = path.join(p, f)
    if (fs.statSync(full).isFile()) allFiles.push(prefix + f)
  }
}
scan('', base)
scan('assets', base + 'assets/')
scan('icons', base + 'icons/')

// ===== Precache SEMUA file (kecuali source map) =====
// Alasan: activate menghapus cache lama — kalau chunk halaman/firestore hanya
// lazy-cached, app yang dibuka OFFLINE tepat pasca-deploy crash dengan
// "Importing a module script failed". Precache penuh menutup window itu.
// Source map (*.map) tidak perlu offline — filter supaya tidak bengkak & bocor source.
const precache = allFiles.filter((f) => !f.endsWith('.map'))

const cache = 'gym-tracker-' + Date.now().toString(36)

// Hitung total ukuran precache (KB)
let totalBytes = 0
for (const f of precache) {
  const local = path.join(dist, f.replace(base, ''))
  try { totalBytes += fs.statSync(local).size } catch { /* skip */ }
}
const totalKB = Math.round(totalBytes / 1024)

const sw = `var CACHE = ${JSON.stringify(cache)};
var PRECACHE = ${JSON.stringify(precache)};
var ROOT = ${JSON.stringify(base)};

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // cache.add() per file: partial failure tolerance.
      // Satu file gagal (timeout/offline) tidak membatalkan instalasi SW.
      return Promise.all(
        PRECACHE.map(function (url) {
          return c.add(url).catch(function () {
            console.warn('[SW] skip precache:', url);
          });
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.url.indexOf(self.location.origin + ROOT) !== 0) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var cp = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, cp); });
        return res;
      }).catch(function () {
        return caches.match(ROOT).then(function (r) {
          return r || caches.match(ROOT + 'index.html');
        });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var cp = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, cp); });
        }
        return res;
      });
    })
  );
});
`

fs.writeFileSync(path.join(dist, 'sw.js'), sw)
console.log(
  'sw.js written — cache=' + cache +
  ' precache=' + precache.length + '/' + allFiles.length + ' files' +
  ' (~' + totalKB + ' KB)' +
  ' — ' + (allFiles.length - precache.length) + ' files lazy-cached'
)

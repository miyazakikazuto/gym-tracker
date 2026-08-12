// Service worker untuk Gym Tracker — ditulis ke dist/sw.js saat build (postbuild).
// Cache ber-nama timestamp agar otomatis di-purge tiap deploy baru.
const fs = require('fs')
const path = require('path')

const dist = path.join(__dirname, '..', 'dist')
const base = '/gym-tracker/'

const files = []
const scan = (dir, prefix) => {
  const p = path.join(dist, dir)
  if (!fs.existsSync(p)) return
  for (const f of fs.readdirSync(p)) {
    const full = path.join(p, f)
    if (fs.statSync(full).isFile()) files.push(prefix + f)
  }
}
scan('', base)
scan('assets', base + 'assets/')
scan('icons', base + 'icons/')

const cache = 'gym-tracker-' + Date.now().toString(36)

const sw = `var CACHE = ${JSON.stringify(cache)};
var PRECACHE = ${JSON.stringify(files)};
var ROOT = ${JSON.stringify(base)};

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
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
      }).catch(function () { return caches.match(ROOT); })
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
console.log('sw.js written — cache=' + cache + ' precache=' + files.length + ' files')
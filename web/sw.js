// Keeps a copy of Mochiboard in the browser so it opens without internet (the website version).
// The Mac app loads these files from disk, so it doesn't need this.
// Network first, so a new version shows up when you're online; the saved copy is the fallback when you're not.
const CACHE = 'mochiboard-v10';
const FILES = [
  './', 'index.html', 'style.css', 'fonts.css', 'app.js', 'bridge.js', 'goo.js', 'learn.js', 'flows.js', 'flowtpl.js', 'starter.js', 'vendor/editor.js', 'vendor/docx.js', 'icons/names.js', 'icons/MaterialIconsOutlined-Regular.otf',
  'fonts/DMSans-400-latin.woff2', 'fonts/DMSans-500-latin.woff2', 'fonts/DMSans-700-latin.woff2', 'fonts/DMSans-800-latin.woff2',
  'fonts/DMSans-400-latin-ext.woff2', 'fonts/DMSans-500-latin-ext.woff2', 'fonts/DMSans-700-latin-ext.woff2', 'fonts/DMSans-800-latin-ext.woff2',
  'fonts/Caveat-500-latin.woff2', 'fonts/Caveat-700-latin.woff2', 'fonts/Caveat-500-latin-ext.woff2', 'fonts/Caveat-700-latin-ext.woff2',
  'stamps/mochi.png', 'stamps/mochi-shook.png', 'stamps/mochi-wave.png', 'stamps/mochi-happy.png', 'stamps/mochi-party.png', 'stamps/mochi-love.png',
  'stamps/px/alarm.png', 'stamps/px/blossom.png', 'stamps/px/blueheart.png', 'stamps/px/brain.png', 'stamps/px/bulb.png', 'stamps/px/calendar.png', 'stamps/px/camera.png', 'stamps/px/check.png', 'stamps/px/clap.png', 'stamps/px/coffee.png', 'stamps/px/crayon.png', 'stamps/px/cross.png', 'stamps/px/cupcake.png', 'stamps/px/exclaim.png', 'stamps/px/eyes.png', 'stamps/px/fire.png', 'stamps/px/headphones.png', 'stamps/px/heart.png', 'stamps/px/hearteyes.png', 'stamps/px/hearthands.png', 'stamps/px/holdingtears.png', 'stamps/px/hundred.png', 'stamps/px/joy.png', 'stamps/px/link.png', 'stamps/px/palette.png', 'stamps/px/party.png', 'stamps/px/peach.png', 'stamps/px/pinkheart.png', 'stamps/px/purpleheart.png', 'stamps/px/pushpin.png', 'stamps/px/question.png', 'stamps/px/rainbow.png', 'stamps/px/raised.png', 'stamps/px/rocket.png', 'stamps/px/roundpin.png', 'stamps/px/sob.png', 'stamps/px/sparkleheart.png', 'stamps/px/sparkles.png', 'stamps/px/speech.png', 'stamps/px/star.png', 'stamps/px/strawberry.png', 'stamps/px/sweat.png', 'stamps/px/target.png', 'stamps/px/thinking.png', 'stamps/px/thumbsdown.png', 'stamps/px/thumbsup.png', 'stamps/px/trophy.png', 'stamps/px/tulip.png',   // the music player's track art
  'stamps/mochi-sigh.gif', 'stamps/mochi-double.png', 'stamps/ph/landscape.png', 'stamps/ph/portrait.png', 'stamps/ph/product.png', 'stamps/ph/team.png', 'stamps/ph/photo.png', 'stamps/ph/chart.png', 'stamps/ph/map.png', 'stamps/ph/music.png', 'stamps/ph/any.png', 'stamps/mochi-devil-blue.png', 'stamps/mochi-devil-pink.png', 'stamps/mochi-devil-mint.png', 'stamps/mochi-devil-lilac.png', 'stamps/mochi-devil-butter.png', 'stamps/mochi-devil-peach.png', 'stamps/mochi-devil-night.png', 'stamps/mochi-double-mint.png', 'stamps/mochi-double-butter.png', 'stamps/mochi-wings-blue.png', 'stamps/mochi-wings-pink.png', 'stamps/mochi-wings-mint.png', 'stamps/mochi-wings-lilac.png', 'stamps/mochi-wings-butter.png', 'stamps/mochi-wings-peach.png', 'stamps/mochi-wings-night.png', 'stamps/mochi-fly-blue.gif', 'stamps/mochi-fly-pink.gif', 'stamps/mochi-fly-mint.gif', 'stamps/mochi-fly-lilac.gif', 'stamps/mochi-fly-butter.gif', 'stamps/mochi-fly-peach.gif', 'stamps/mochi-fly-night.gif', 'stamps/mochi-sleepy.png', 'stamps/mochi-cry.png', 'stamps/mochi-sigh.png', 'stamps/mochi-bounce.gif',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // only Mochiboard's own files
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});

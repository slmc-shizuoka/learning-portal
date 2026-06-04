// Learning Portal - Service Worker
// バージョン更新時はCACHE_VERSIONを変更すること（古いキャッシュが自動破棄される）
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `learning-portal-${CACHE_VERSION}`;

// キャッシュ対象のファイル（オフライン時の最低限）
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

// インストール時：必要ファイルを事前キャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 起動時：古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('learning-portal-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch戦略：
// - 自分のオリジン（Cloudflare Workers）→ cache-first（オフライン対応）
// - 外部リンク（Anthropic、OpenAI等の各サービス）→ ネットワーク優先（キャッシュしない）
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 自分のオリジン以外は素通し（外部ツール側に干渉しない）
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // オフライン時にHTMLナビゲーションが失敗したらindexを返す
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

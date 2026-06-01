// Shizuoka Portal - Service Worker
// バージョン更新時はCACHE_VERSIONを変更すること（古いキャッシュが自動破棄される）
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `shizuoka-portal-${CACHE_VERSION}`;

// キャッシュ対象のファイル（オフライン時に表示するための最低限）
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

// インストール：必要ファイルを事前キャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 起動：古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('shizuoka-portal-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch戦略：
// - 自分のドメインのリソース → cache-first（オフライン対応）
// - 外部リンク（Google Drive等）→ ネットワーク優先（キャッシュしない）
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GETメソッド以外はキャッシュ対象外
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 自分のオリジン以外は素通し（Google Drive等の外部リンクへの干渉を防ぐ）
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // 成功した場合のみキャッシュに保存
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // オフライン時にHTMLリクエストが失敗したらキャッシュのindexを返す
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

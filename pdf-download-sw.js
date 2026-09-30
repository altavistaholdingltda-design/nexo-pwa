const documents = new Map();

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data?.type !== 'nexo-pdf' || !data.id || !data.bytes) return;
  documents.set(data.id, data.bytes);
  event.ports[0]?.postMessage({ ready: true });
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.includes('/pdf-export/')) return;
  const id = url.pathname.split('/').pop()?.replace(/\.pdf$/, '');
  const bytes = documents.get(id);
  if (!bytes) {
    event.respondWith(new Response('Este arquivo expirou. Gere o PDF novamente no NEXO.', {
      status: 410,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }));
    return;
  }
  event.respondWith(new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="nexo-material.pdf"',
      'Cache-Control': 'no-store',
      'Content-Length': String(bytes.byteLength),
    },
  }));
});

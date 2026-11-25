# Lighthouse — data quality / premium polish pass

Měřeno proti lokálnímu `vite preview` (SPA shell na `/`). Preview/localhost záměrně má `noindex` → SEO skóre 69 (audit `is-crawlable`).

## Souhrn skóre

| | Mobile před | Mobile po | Desktop před | Desktop po |
| --- | ---: | ---: | ---: | ---: |
| Performance | 50 | **63** | 61 | 51 |
| Accessibility | 97 | 97 | 97 | 97 |
| Best practices | 100 | 100 | 100 | 100 |
| SEO | 69 | 69 | 69 | 69 |

## Klíčové metriky

| | Mobile před | Mobile po | Desktop před | Desktop po |
| --- | --- | --- | --- | --- |
| FCP | 0.9 s | 0.9 s | 0.9 s | 0.9 s |
| LCP | 7.2 s | 8.0 s | 7.1 s | 8.1 s |
| TBT | 1 530 ms | **480 ms** | 240 ms | 390 ms |
| CLS | 0 | 0 | 0 | 0 |

## Poznámky

- LCP na SPA zůstává omezený velikostí katalogového chunku (~1.2 MB JS dat podniků). Na Vercel Preview/produkci pomáhá prerenderované HTML.
- Agresivní `manualChunks` (react/router/map) TBT zhoršil a byl vrácen.
- Zachováno: lazy mapa, `content-visibility` na kartách, `font-display: swap`, aspect-ratio médií.

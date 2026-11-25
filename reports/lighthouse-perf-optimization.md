# Lighthouse — maximum performance optimization

Měřeno proti lokálnímu `vite preview` na `http://127.0.0.1:4173/` (SPA + prerender `#seo-snapshot`). Stejný throttling: Lighthouse simulate, Chrome headless.

## Baseline (před — prior polish pass)

Z `reports/lighthouse-data-quality-pass.md` (single-run):

| | Mobile | Desktop |
| --- | ---: | ---: |
| Performance | 63 | 51 |
| LCP | 8.0 s | 8.1 s |
| TBT | 480 ms | 390 ms |
| CLS | 0 | 0 |

## Po optimalizaci (medián 3 běhů)

| | Mobile median | Desktop median |
| --- | ---: | ---: |
| Performance | **89** (běhy 77–99) | **94** |
| LCP | **3.4 s** | **1.6 s** |
| TBT | **151–218 ms** | **0 ms** |
| CLS | **0** | **0.002** |
| FCP | ~0.9 s | ~0.26 s |

Desktop plní cíle (90+, LCP &lt; 2.5 s, TBT &lt; 200 ms, CLS &lt; 0.1).

Mobile Performance medián ~89 (těsně pod 90 kvůli variance TBT). LCP ~3.4 s zůstává nad cílem 2.5 s — viz níže.

## Bundly (minified)

| Chunk | Před | Po |
| --- | ---: | ---: |
| `index` (kritická cesta) | ~414 kB | **334 kB** |
| Katalog podniků | ~1147 kB **modulepreload na /** | **1076 kB async** (`demoRestaurants`, bez preload) |
| Tenký `restaurants` | (součást katalogu) | **1.2 kB** |
| Mapa | ~1240 kB lazy | ~1270 kB lazy |
| Pixabay library | v kritické cestě přes CategoryStrip/Home | **97 kB** oddělený chunk |
| CategoryStrip | v `index` | **9.8 kB** lazy |

## Hlavní příčiny pomalého načítání (diagnóza)

1. **Katalog ~1.1 MB** se dříve `modulepreload`oval na úvodu → parse/eval blokoval LCP.
2. **LCP element** byl text GPS modalu / velké fotky kategorií (1280px), ne hero.
3. **`pageIn` animace** s `opacity: 0` skryla hero → LCP padl na malý brand v headeru.
4. **CategoryStrip** tahal celou Pixabay knihovnu + eager stahoval ~12×150 kB fotek.
5. Mapa/admin/auth už byly lazy; GPS `getCurrentPosition` neblokoval first paint, ale **overlay modal** přepisoval LCP.

## Provedené optimalizace

- Async katalog (`catalogLoader` + `ensureRestaurantsLoaded`), CatalogContext až po first paint / idle.
- Lazy routes: Results, Detail, CategoryStrip; business.css mimo kritickou cestu.
- GPS sheet: bottom sheet + zobrazení až po interakci (scroll/pointer) — nepřekrývá hero LCP.
- Category fotky na mobilu až po scrollu; soft blur bez dvojitého CSS downloadu všech URL.
- Font preload (`/fonts/*.woff2`) + `font-display: swap`.
- Home `pageIn` bez `opacity: 0`.
- Prerender `#seo-snapshot` beze změny vztahu: crawler HTML → po hydrataci skryté přes `body:has(#root .app)`.

## Proč mobile LCP není pod 2.5 s

LCP element je `p.home-hero-lead` po React bootstrapu. Kritický JS (`index` ~334 kB gzip ~106 kB) pod mobile CPU throttlingem stále přidá ~2–3 s element render delay v simulačním skóre. Bez SSR/streaming Reactu nebo dalšího rozbití shellu pod ~200 kB nejde spolehlivě stlačit LCP pod 2.5 s při zachování současného SPA UX. Není to detekce Lighthouse — stejný bootstrap stojí i reálné mid-range telefony.

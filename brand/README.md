# Logo di Quadriamo

| File | Uso |
|---|---|
| `quadriamo-logo.svg/.pdf/.png` | logo completo (icona + scritta) su sfondo chiaro |
| `quadriamo-logo-dark.*` | logo completo su sfondo scuro (scritta crema) |
| `quadriamo-wordmark.*`, `quadriamo-wordmark-dark.*` | solo la scritta "Quadriamo." |
| `quadriamo-mark.*` | solo l'icona (quattro blocchi 55-20-15-10) |

SVG e PDF sono vettoriali (le lettere sono tracciati: si stampano a qualsiasi misura senza il font).
PNG a 8x, con sfondo trasparente. Colori: inchiostro #1F2328, crema #FAF7F2, arancio #C2410C (#F07A42 su scuro),
blocchi #C2410C · #E89A6C · #E9C9A6 · #8A8F98. Caratteri: DM Serif Display (titoli), DM Sans (testi).

Rigenerare: `pip install fonttools pillow` e poi `python3 brand/make_logo.py`.

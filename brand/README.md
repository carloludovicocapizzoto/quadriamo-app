# Logo di Quadriamo

| File | Uso |
|---|---|
| `quadriamo-logo.svg/.pdf/.png` | logo completo (icona + scritta) su sfondo chiaro |
| `quadriamo-logo-dark.*` | logo completo su sfondo scuro (scritta crema) |
| `quadriamo-wordmark.*`, `quadriamo-wordmark-dark.*` | solo la scritta "Quadriamo." |
| `quadriamo-mark.*` | solo l'icona (quattro blocchi 55-20-15-10) |

SVG e PDF sono vettoriali (le lettere sono tracciati: si stampano a qualsiasi misura senza il font).
PNG a 8x, con sfondo trasparente. Colori: inchiostro #17181A, crema #F6F4EF, arancio #C2410C (#E0602A su scuro),
blocchi #C2410C · #E8915F · #D9BE9A · #8C8F94. Caratteri: DM Serif Display (titoli), DM Sans (testi).

Rigenerare: `pip install fonttools pillow` e poi `python3 brand/make_logo.py`.

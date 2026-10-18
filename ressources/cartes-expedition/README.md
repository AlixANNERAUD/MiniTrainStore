# Mini Train Store — Carte de remerciement pour les expéditions

Carte recto-verso à glisser dans les colis, en conservant le verso largement libre pour ajouter un message manuscrit.

![Aperçu recto-verso](minitrainstore-apercu.png)

## Design

- **Recto** : logo d'origine MiniTrainStore, grand « Merci ! », remerciement concis **en un paragraphe de deux lignes**, invitation à nous écrire pour un avis, une question ou une réclamation, **QR code** vers https://www.minitrainstore.fr/, URL, e-mail (`arnaud@minitrainstore.fr`) et téléphone (`06 06 43 83 44`). Illustration ferroviaire dessinée en SVG, en rappel de la maquette approuvée.
- **Verso** : petit logo, « Un petit mot pour vous… », **grande zone blanche** avec trois lignes très discrètes pour écrire au stylo, signature et motif de rails.
- La [carte de visite](../cartes-de-visite/) reste inchangée.

## Fichiers

- [SVG du recto](minitrainstore-recto.svg) et [SVG du verso](minitrainstore-verso.svg) : **entièrement vectoriels**, y compris le QR code et l'illustration de locomotive. Les caractères restent en éléments texte SVG éditables.
- [Sources éditables](sources-editables/) : copies éditables des SVG destinées aux retouches.
- [PDF d'impression recto-verso](minitrainstore-impression.pdf) : 2 pages, format fini **85 × 55 mm**, fond perdu de **3 mm** de chaque côté et TrimBox au format fini.
- [Aperçu recto-verso](minitrainstore-apercu.png).
- [Kit complet ZIP](minitrainstore-kit-carte.zip).
- [Consignes d'impression](LIRE-AVANT-IMPRESSION.txt).

**Polices** : texte courant en DejaVu Sans ; titres manuscrits en Z003 avec une police de secours générique. Les SVG restent éditables mais leur rendu typographique peut varier selon les polices installées. Le PDF est destiné à garantir le rendu du tirage ; les polices requises sont installées dans le workflow de génération.

**Écriture** : papier mat non couché conseillé (300 à 350 g/m²), sans pelliculage ni vernis au verso. Faire un essai avec le stylo utilisé en boutique.

## Reproduire les exports

```sh
python -m pip install cairosvg pypdf pillow
python scripts/generate_shipping_card.py
```

Sous Debian/Ubuntu, installer également `fonts-dejavu-core` et `fonts-urw-base35` pour conserver les mêmes polices que l'export CI. La [GitHub Action](../../.github/workflows/shipping-card-assets.yml) régénère le PDF, le PNG et le ZIP après une modification des SVG.

Les coordonnées reprennent celles publiées par la boutique en octobre 2026. Le QR code pointe directement vers l'URL officielle, sans service de redirection.

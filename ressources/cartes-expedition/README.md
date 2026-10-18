# Mini Train Store — Carte de remerciement pour les expéditions

À glisser dans les colis pour remercier les clients et pouvoir ajouter un mot personnel **au stylo**.

![Aperçu recto-verso](minitrainstore-apercu.png)

## Nouveau recto-verso

- **Recto (imprimé)** : logo Mini Train Store, « Merci pour votre commande ! », message de marque, adresse du site, e-mail, téléphone et **QR code vers https://www.minitrainstore.fr/**.
- **Verso (à écrire)** : **blanc, pratiquement vierge**, avec seulement un discret trait bleu en bas à droite. Aucun QR code, contact ou grand visuel ne gêne l’écriture.

La [carte de visite](../cartes-de-visite/) reste distincte et inchangée.

## Fichiers

- [PDF prêt pour impression recto-verso](minitrainstore-impression.pdf) — deux pages dans l’ordre recto puis verso ; format fini **85 × 55 mm**, fond perdu **3 mm**, pages **91 × 61 mm** avec TrimBox.
- SVG vectoriels, **sans dépendance aux polices** (textes convertis en tracés) : [recto](minitrainstore-recto.svg) et [verso](minitrainstore-verso.svg).
- [SVG avec textes éditables](sources-editables/) (DejaVu Sans).
- [Aperçu recto-verso](minitrainstore-apercu.png).
- [Kit complet ZIP](minitrainstore-kit-carte.zip).
- [Consignes d’impression](LIRE-AVANT-IMPRESSION.txt).

## Papier et écriture

Choisir de préférence un **papier mat non couché**, suffisamment épais (**300 à 350 g/m²**), avec un verso non pelliculé : faire un test au stylo ou au feutre avant le tirage en nombre. Éviter le vernis, le brillant et le pelliculage au verso, qui rendent l’écriture difficile.

Le QR code est vectoriel et pointe directement vers le site (sans redirection tierce). Les coordonnées proviennent de la boutique au 17 octobre 2026.

## Régénérer les exports

En cas de modification des SVG, exécuter depuis la racine du dépôt :

```sh
python -m pip install cairosvg pypdf pillow
python scripts/generate_shipping_card.py
```

Le script régénère le **PDF**, le **PNG d’aperçu** et le **ZIP**, à partir des SVG vectoriels principaux. Le workflow GitHub Actions [shipping-card-assets.yml](../../.github/workflows/shipping-card-assets.yml) met automatiquement à jour ces exports après une modification des sources.

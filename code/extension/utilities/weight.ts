import { CombinedProduct } from "./settings";

export function getWeightFromProduct(
  product: CombinedProduct,
): { weight: number; weightUomName: string } | null {
  // Match lines like: "masse : 31 g", "poids: 0,45 kg", "Poids 450 grammes"
  const weightRegex =
    /(?:^|\n)\s*(?:masse|poids)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilogramme?s?|g|gramme?s?)\b/i;
  const match = product.detail?.description.match(weightRegex);

  if (!match) {
    return null;
  }

  const rawValue = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(rawValue)) {
    return null;
  }

  const rawUnit = match[2].toLowerCase();
  if (rawUnit.startsWith("k")) {
    return { weight: rawValue, weightUomName: "kg" };
  }

  // Odoo's product weight is expected in kilograms.
  return { weight: rawValue / 1000, weightUomName: "kg" };
}

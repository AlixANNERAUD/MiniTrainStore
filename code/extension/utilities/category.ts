import { useSettingsStore } from "@/stores/settings";
import { CombinedProduct } from "./settings";

export const COMPILED_CATEGORIES = computed(() => {
  const settings = useSettingsStore();

  return settings.categories.value.map((cat) => ({
    ...cat,
    regex: new RegExp(cat.pattern, "i"),
  }));
});

export function getCategoryForProduct(product: CombinedProduct): string | null {
  const title = product.listing.title;

  // Strip 2 first words (e.g., "Train Jouet") to focus on the model name
  const titleWithoutPrefix = title.split(" ").slice(2).join(" ");

  for (const cat of COMPILED_CATEGORIES.value) {
    if (cat.regex.test(titleWithoutPrefix)) {
      return cat.category;
    }
  }

  return null;
}

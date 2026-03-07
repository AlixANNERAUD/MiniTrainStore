import { useSettingsStore } from "@/stores/settings";
import { CombinedProduct } from "./settings";

export const COMPILED_TAGS = computed(() => {
  const settings = useSettingsStore();

  return settings.tags.value.map((tag) => ({
    ...tag,
    regex: new RegExp(tag.pattern, "i"),
  }));
});

export function getTagsForProduct(product: CombinedProduct): string[] {
  const tags: string[] = [];
  const title = product.listing.title;
  const description = product.detail?.description || "";

  COMPILED_TAGS.value.forEach((tag) => {
    if (tag.regex.test(title) || tag.regex.test(description)) {
      tags.push(tag.tag);
    }
  });

  return tags;
}

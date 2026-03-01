<script setup lang="ts">
import { useSettingsStore } from "@/stores/settings";
import Button from "@/components/ui/button/Button.vue";
import { getProductIdentifierFromUrl } from "@/utilities/product/location";
import { RefreshCw } from "lucide-vue-next";
import { parseProductDetails } from "@/utilities/product/parsing";

const settings = useSettingsStore();

const currentProductIdentifier = getProductIdentifierFromUrl(
  new URL(window.location.href),
);

const isLoading = ref(false);

const product = settings.getProduct(currentProductIdentifier || "");

console.log("Current product identifier:", currentProductIdentifier);
console.log("Is product exist without details:", product);

async function updateProductDetails() {
  if (!currentProductIdentifier) return;

  isLoading.value = true;

  const product = await parseProductDetails().finally(() => {
    isLoading.value = false;
  });

  console.log("Parsed product details:", product);

  settings.updateProductDetail(currentProductIdentifier, product);
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50">
    <Button
      v-if="product && product.detail"
      variant="outline"
      @click="updateProductDetails"
    >
      <RefreshCw
        :class="['w-4', 'h-4', 'mr-2', isLoading ? 'animate-spin' : '']"
      />
      Mettre à jour les détails de ce produit
    </Button>
  </div>
</template>

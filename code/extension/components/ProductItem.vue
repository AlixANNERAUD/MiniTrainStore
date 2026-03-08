<script setup lang="ts">
import Item from "@/components/ui/item/Item.vue";
import ItemMedia from "@/components/ui/item/ItemMedia.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemActions from "@/components/ui/item/ItemActions.vue";

import Badge from "@/components/ui/badge/Badge.vue";

import { getCategoryForProduct } from "@/utilities/category";
import { getTagsForProduct } from "@/utilities/tag";
import { CombinedProduct, ProductState } from "@/utilities/settings";

import * as odoo from "@/utilities/odoo";
import Spinner from "./ui/spinner/Spinner.vue";
import { ProductStateLabels } from "@/utilities/filtering";
import { openUrl } from "@/utilities/browser";
import Button from "./ui/button/Button.vue";
import { formatDate } from "@/utilities/format";

const { product, odooState } = defineProps<{
  product: CombinedProduct;
  odooState: odoo.OdooProductState;
  odooUrl: string | null;
}>();

const emit = defineEmits(["exportProduct"]);

const isExporting = ref(false);

const ProductStateColors: Record<ProductState, string> = {
  [ProductState.ACTIVE]: "bg-green-100 text-green-800",
  [ProductState.PURCHASE_PENDING]: "bg-yellow-100 text-yellow-800",
  [ProductState.PURCHASE_COMPLETED]: "bg-yellow-100 text-yellow-800",
  [ProductState.REMOVED]: "bg-red-100 text-red-800",
};

const OdooStateColors: Record<odoo.OdooProductState, string> = {
  [odoo.OdooProductState.NOT_FOUND]: "bg-red-100 text-red-800",
  [odoo.OdooProductState.EXISTS]: "bg-yellow-100 text-yellow-800",
  [odoo.OdooProductState.ACTIVE]: "bg-green-100 text-green-800",
};

async function exportProduct(product: CombinedProduct) {
  if (isExporting.value) {
    return; // Prevent multiple clicks
  }

  isExporting.value = true;

  await odoo
    .exportProduct(product)
    .catch((error) => {
      console.error("Error exporting product:", error);
    })
    .finally(() => {
      isExporting.value = false;
      emit("exportProduct", product);
    });
}
</script>

<template>
  <Item variant="outline" as-child role="listitem">
    <a href="#">
      <ItemMedia class="h-full w-24" variant="image">
        <img :src="product.listing.thumbnail" :alt="product.listing.title" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle class="line-clamp-1">
          {{ product.listing.title }}
        </ItemTitle>
        <ItemDescription>{{ product.detail?.description }}</ItemDescription>
        <ItemDescription>
          <Badge :class="ProductStateColors[product.listing.state]">
            {{
              ProductStateLabels[product.listing.state] || product.listing.state
            }}
          </Badge>
          <Badge variant="outline"> {{ product.listing.price }} €</Badge>
          <Badge variant="outline">
            {{ formatDate(product.listing.date) }}
          </Badge>
          <Badge v-if="product.detail" variant="outline">
            {{ product.detail?.photos.length || 0 }} photos
          </Badge>
        </ItemDescription>
        <ItemDescription>
          Catégorie :
          <Badge variant="outline">
            {{ getCategoryForProduct(product) }}
          </Badge>
        </ItemDescription>
        <ItemDescription class="text-sm text-muted-foreground">
          Étiquettes :
          <Badge
            v-for="tag in getTagsForProduct(product)"
            :key="tag"
            variant="outline"
          >
            {{ tag }}
          </Badge>
        </ItemDescription>
        <ItemDescription class="text-sm text-muted-foreground">
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <div class="flex flex-col items-start gap-1">
          <Button
            variant="outline"
            size="sm"
            :class="
              product.detail
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            "
            @click="openUrl(product.listing.url)"
          >
            Détails
          </Button>

          <Button
            variant="outline"
            size="sm"
            :class="['w-full', 'justify-center', OdooStateColors[odooState]]"
            :disabled="!product.detail"
            @click="exportProduct(product)"
          >
            <Spinner v-if="isExporting" class="w-4 h-4" />
            <span v-if="odooState === odoo.OdooProductState.NOT_FOUND"
              >Exporter</span
            >
            <span v-else>Mettre à jour</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="odooUrl === null"
            @click="openUrl(odooUrl || '')"
          >
            Voir sur Odoo
          </Button>
        </div>
      </ItemActions>
    </a>
  </Item>
</template>

<script setup lang="ts">
import Select from "@/components/ui/select/Select.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import ItemGroup from "@/components/ui/item/ItemGroup.vue";
import ScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import { useSettingsStore } from "@/stores/settings";
import {
  filterAndSortProducts,
  OrderBy,
  OrderByLabels,
} from "@/utilities/filtering";
import { CombinedProduct, ProductState } from "@/utilities/settings";

import Separator from "@/components/ui/separator/Separator.vue";
import Input from "@/components/ui/input/Input.vue";

import Button from "@/components/ui/button/Button.vue";
import { ArrowDownAZ, Eye, Filter, Search, User } from "lucide-vue-next";
import ButtonGroup from "./ui/button-group/ButtonGroup.vue";
import { getProfileUrl } from "@/utilities/profile/location";

import * as odoo from "@/utilities/odoo";
import Spinner from "./ui/spinner/Spinner.vue";
import ProductItem from "./ProductItem.vue";
import { openUrl, storageRef } from "@/utilities/browser";

const settings = useSettingsStore();

const selectedProfile = storageRef<string>("selectedProfile", "");
const selectedOrderBy = storageRef("selectedOrderBy", OrderBy.DATE);
const selectedDisplayState = storageRef<DisplayState | "ALL">(
  "selectedDisplayState",
  "ALL",
);
const searchQuery = storageRef("searchQuery", "");

enum DisplayState {
  TO_EXPORT = "to_export",
  TO_DELETE = "to_delete",
  DELETED = "deleted",
  TO_UPDATE = "to_update",
  UP_TO_DATE = "up_to_date",
}

const DisplayStateLabels: Record<DisplayState, string> = {
  [DisplayState.TO_EXPORT]: "A exporter",
  [DisplayState.TO_DELETE]: "A supprimer",
  [DisplayState.DELETED]: "Supprimes",
  [DisplayState.TO_UPDATE]: "A mettre a jour",
  [DisplayState.UP_TO_DATE]: "A jour",
};

const profilesList = computed(() => {
  return Object.entries(settings.profiles.value).map(
    ([identifier, profile]) => ({
      identifier,
      displayName: profile.displayName,
    }),
  );
});

const combinedProducts = computed(() =>
  settings.getCombinedProducts(selectedProfile.value || ""),
);

const sortedAndFilteredProducts = computed(() => {
  if (!selectedProfile.value) {
    return [];
  }

  const filteredProducts = filterAndSortProducts(
    combinedProducts.value,
    {
      query: searchQuery.value.trim() || undefined,
    },
    selectedOrderBy.value,
  );

  return filteredProducts.filter((product) => {
    const displayState = getDisplayState(product);
    return (
      selectedDisplayState.value === "ALL" ||
      displayState === selectedDisplayState.value
    );
  });
});

const productDisplayStatistics = computed(() => {
  const stats: Record<DisplayState, number> = {
    [DisplayState.TO_EXPORT]: 0,
    [DisplayState.TO_DELETE]: 0,
    [DisplayState.DELETED]: 0,
    [DisplayState.TO_UPDATE]: 0,
    [DisplayState.UP_TO_DATE]: 0,
  };

  combinedProducts.value.forEach((product) => {
    const displayState = getDisplayState(product);
    stats[displayState]++;
  });

  return stats;
});

function openProfileUrl() {
  openUrl(getProfileUrl(selectedProfile.value || ""));
}

const odooProducts = ref<
  Map<
    string,
    {
      active: boolean;
      url: string;
    }
  >
>(new Map());

const isLoading = ref(false);

async function updateOdooProducts() {
  // Check if Odoo is configured before attempting to fetch
  if (!settings.odoo.value.url || !settings.odoo.value.apiKey) {
    console.warn("Odoo not configured, skipping product fetch");
    return;
  }

  isLoading.value = true;
  await odoo
    .getAllProducts()
    .then(
      (products) => {
        const productMap = new Map<string, { active: boolean; url: string }>();
        products.forEach((product) => {
          productMap.set(product.identifier, {
            active: product.active,
            url: product.url,
          });
        });
        odooProducts.value = productMap;
      },
      (error) => {
        console.error("Error fetching Odoo products:", error);
      },
    )
    .finally(() => {
      isLoading.value = false;
    });
}

onMounted(async () => {
  // Wait for settings to load from storage before attempting to fetch
  await new Promise((resolve) => setTimeout(resolve, 100));

  updateOdooProducts().catch((error) => {
    console.error("Error during initial Odoo products fetch:", error);
  });
});

function getOdooProductState(product: CombinedProduct): odoo.OdooProductState {
  const existsInOdoo = odooProducts.value.has(product.identifier);
  const odooProduct = odooProducts.value.get(product.identifier);

  if (!existsInOdoo) {
    return odoo.OdooProductState.NOT_FOUND;
  }

  if (odooProduct?.active) {
    return odoo.OdooProductState.ACTIVE;
  }

  return odoo.OdooProductState.EXISTS;
}

function getDisplayState(product: CombinedProduct): DisplayState {
  const odooState = getOdooProductState(product);
  const isActiveListing = product.listing.state === ProductState.ACTIVE;

  if (odooState === odoo.OdooProductState.NOT_FOUND) {
    return isActiveListing ? DisplayState.TO_EXPORT : DisplayState.DELETED;
  }

  if (!isActiveListing) {
    return odooState === odoo.OdooProductState.ACTIVE
      ? DisplayState.TO_DELETE
      : DisplayState.DELETED;
  }

  return odooState === odoo.OdooProductState.ACTIVE
    ? DisplayState.UP_TO_DATE
    : DisplayState.TO_UPDATE;
}
</script>

<template>
  <div class="space-y-4 h-full min-h-0 flex flex-col">
    <div class="flex flex-wrap gap-4 items-center">
      <ButtonGroup>
        <Select v-model="selectedProfile" class="inline-flex">
          <SelectTrigger>
            <User class="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sélectionnez un profil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="profile in profilesList"
              :key="profile.identifier"
              :value="profile.identifier"
            >
              {{ profile.displayName }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          :disabled="!selectedProfile"
          @click="openProfileUrl()"
        >
          <Eye class="w-4 h-4 mr-2" />
        </Button>
      </ButtonGroup>

      <div class="flex items-center gap-2 flex-1 min-w-fit">
        <Search class="w-4 h-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          placeholder="Rechercher par titre ou description..."
          class="flex-1"
        />
      </div>

      <Select v-model="selectedDisplayState" class="inline-flex">
        <SelectTrigger>
          <Filter class="w-4 h-4 mr-2" />
          <SelectValue placeholder="Filtrer par action" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL"
            >Tous ({{ combinedProducts.length }})</SelectItem
          >
          <SelectItem
            v-for="[key, label] in Object.entries(DisplayStateLabels)"
            :key="key"
            :value="key"
          >
            {{ label }} ({{
              productDisplayStatistics[key as DisplayState] || 0
            }})
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="selectedOrderBy" class="inline-flex">
        <SelectTrigger>
          <ArrowDownAZ class="w-4 h-4 mr-2" />
          <SelectValue placeholder="Trier par" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="[key, label] in Object.entries(OrderByLabels)"
            :key="key"
            :value="key"
          >
            {{ label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Spinner v-if="isLoading" />
    </div>

    <Separator />

    <ScrollArea class="w-full flex-1 min-h-0">
      <ItemGroup class="gap-4">
        <ProductItem
          v-for="product in sortedAndFilteredProducts"
          :key="product.identifier"
          :product="product"
          :odoo-state="getOdooProductState(product)"
          :odoo-url="odooProducts.get(product.identifier)?.url || null"
          @export-product="updateOdooProducts"
        />
      </ItemGroup>
    </ScrollArea>
  </div>
</template>

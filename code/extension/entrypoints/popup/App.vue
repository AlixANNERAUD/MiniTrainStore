<script lang="ts" setup>
import { ref, onMounted, computed } from "vue";
import { ProductState, ProfileData } from "@/utilities/product";
import Button from "@/components/ui/button/Button.vue";
import Item from "@/components/ui/item/Item.vue";
import { useSettingsStore } from "@/stores/settings";
import Card from "@/components/ui/card/Card.vue";
import CardHeader from "@/components/ui/card/CardHeader.vue";
import CardTitle from "@/components/ui/card/CardTitle.vue";
import CardDescription from "@/components/ui/card/CardDescription.vue";
import CardContent from "@/components/ui/card/CardContent.vue";
import ItemMedia from "@/components/ui/item/ItemMedia.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemActions from "@/components/ui/item/ItemActions.vue";

const settings = useSettingsStore();

const selectedProfile = ref<string | null>(null);
const loading = ref(true);
const sortBy = ref<"date" | "price">("date");
const filterState = ref<ProductState | "ALL">("ALL");
const showOdooSettings = ref(false);
const odooUrl = ref("");
const odooApiKey = ref("");
const odooApiPath = ref("/json/2");
const exportingToOdoo = ref(false);
const exportingProductId = ref<string | null>(null);

async function loadOdooSettings() {
  const url = (await storage.getItem("local:odooUrl")) as string | undefined;
  const apiKey = (await storage.getItem("local:odooApiKey")) as
    | string
    | undefined;
  const apiPath = (await storage.getItem("local:odooApiPath")) as
    | string
    | undefined;
  if (url) odooUrl.value = url;
  if (apiKey) odooApiKey.value = apiKey;
  if (apiPath) odooApiPath.value = apiPath;
}

async function saveOdooSettings() {
  await storage.setItem("local:odooUrl", odooUrl.value);
  await storage.setItem("local:odooApiKey", odooApiKey.value);
  await storage.setItem("local:odooApiPath", odooApiPath.value);
  showOdooSettings.value = false;
}

const sortedAndFilteredProducts = computed(() => {
  return settings.getCombinedProducts(
    selectedProfile.value || "",
    {
      state: filterState.value === "ALL" ? undefined : filterState.value,
    },
    sortBy.value,
  );
});

function formatPrice(price: number): string {
  return `${price.toLocaleString("fr-FR")} €`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

async function clearCurrentProfile() {
  if (!selectedProfile.value) return;

  if (
    confirm(
      `Voulez-vous vraiment supprimer le profil ${selectedProfile.value} et ses annonces ?`,
    )
  ) {
    settings.clearProfileData(selectedProfile.value);
  }
}

function openUrl(url: string) {
  browser.tabs.create({ url });
}

async function downloadRawData() {
  try {
    const dataStr = JSON.stringify(settings.export(), null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `leboncoin-scraper-${new Date().toISOString().split("T")[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading data:", error);
  }
}
</script>

<template>
  <Button variant="outline"> Button </Button>
  <div
    class="min-w-[700px] max-w-[900px] min-h-[500px] max-h-[500px] flex flex-col overflow-hidden"
  >
    <Card>
      <CardHeader>
        <CardTitle>Mini Train Store</CardTitle>
        <CardDescription>Gestion des profils et des annonces</CardDescription>
      </CardHeader>

      <CardContent>
        <Item
          v-for="product in sortedAndFilteredProducts"
          :key="product.identifier"
          variant="outline"
          as-child
          role="listitem"
        >
          <ItemMedia variant="image">
            <img
              :src="product.listing.thumbnail"
              :alt="product.listing.title"
              width="100"
              height="100"
            />
          </ItemMedia>
          <ItemContent>
            <ItemTitle class="line-clamp-1">{{
              product.listing.title
            }}</ItemTitle>
            <ItemDescription>{{
              formatPrice(product.listing.price)
            }}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              variant="outline"
              size="sm"
              @click="openUrl(product.listing.url)"
            >
              Voir l'annonce
            </Button>
          </ItemActions>
        </Item>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
/* Additional custom styles if needed */
</style>

<script lang="ts" setup>
import Card from "@/components/ui/card/Card.vue";
import CardHeader from "@/components/ui/card/CardHeader.vue";
import CardTitle from "@/components/ui/card/CardTitle.vue";
import CardDescription from "@/components/ui/card/CardDescription.vue";
import CardContent from "@/components/ui/card/CardContent.vue";

import Separator from "@/components/ui/separator/Separator.vue";
import Tabs from "@/components/ui/tabs/Tabs.vue";
import TabsList from "@/components/ui/tabs/TabsList.vue";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger.vue";
import TabsContent from "@/components/ui/tabs/TabsContent.vue";
import ProductsTab from "@/components/ProductsTab.vue";
import SettingsTab from "@/components/SettingsTab.vue";
import { useSettingsStore } from "@/stores/settings";

const settings = useSettingsStore();

const tabs = ["Produits", "Réglages"];
</script>

<template>
  <Card class="w-200">
    <CardHeader>
      <CardTitle>Mini Train Store</CardTitle>
      <CardDescription>Gestion des profils et des annonces</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <Tabs
        v-model="settings.currentTab.value"
        :default-value="0"
        class="w-full"
      >
        <TabsList class="w-full">
          <TabsTrigger
            v-for="[index, tab] in tabs.entries()"
            :key="index"
            :value="index"
          >
            {{ tab }}
          </TabsTrigger>
        </TabsList>
        <Separator />
        <TabsContent :value="0">
          <ProductsTab />
        </TabsContent>
        <TabsContent :value="1">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>

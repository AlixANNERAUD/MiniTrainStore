<script lang="ts" setup>
import Card from "@/components/ui/card/Card.vue";
import CardHeader from "@/components/ui/card/CardHeader.vue";
import CardContent from "@/components/ui/card/CardContent.vue";

import Separator from "@/components/ui/separator/Separator.vue";
import Tabs from "@/components/ui/tabs/Tabs.vue";
import TabsList from "@/components/ui/tabs/TabsList.vue";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger.vue";
import TabsContent from "@/components/ui/tabs/TabsContent.vue";
import { Button } from "@/components/ui/button";
import ProductsTab from "@/components/ProductsTab.vue";
import SettingsTab from "@/components/SettingsTab.vue";
import OdooManualTab from "@/components/OdooManualTab.vue";
import { storageRef } from "@/utilities/browser";
import ExtensionHeader from "@/components/ExtensionHeader.vue";

const currentTab = storageRef("currentTab", 0);

const tabs = ["Produits", "Odoo manuel", "Réglages"];

async function openInSeparateWindow() {
  await browser.windows.create({
    url: browser.runtime.getURL("/main.html"),
    type: "popup",
    state: "maximized",
  });
}
</script>

<template>
  <Card
    class="w-full max-w-160 h-full border-0 flex flex-col box-border overflow-hidden"
  >
    <CardHeader>
      <ExtensionHeader>
        <Button
          class="ml-auto"
          variant="outline"
          @click="openInSeparateWindow()"
        >
          Ouvrir en fenetre
        </Button>
      </ExtensionHeader>
    </CardHeader>
    <CardContent class="flex-1 min-h-0">
      <Tabs
        v-model="currentTab"
        :default-value="0"
        class="w-full h-full min-h-0"
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
          <OdooManualTab />
        </TabsContent>
        <TabsContent :value="2">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>

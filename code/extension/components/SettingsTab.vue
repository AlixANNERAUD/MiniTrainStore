<script setup lang="ts">
import { useSettingsStore } from "@/stores/settings";
import Item from "./ui/item/Item.vue";
import ItemContent from "./ui/item/ItemContent.vue";
import ItemGroup from "./ui/item/ItemGroup.vue";
import ItemTitle from "./ui/item/ItemTitle.vue";
import ItemActions from "./ui/item/ItemActions.vue";
import Input from "./ui/input/Input.vue";
import ItemDescription from "./ui/item/ItemDescription.vue";

const settings = useSettingsStore();
</script>

<template>
  <ItemGroup>
    <Item>
      <ItemContent>
        <ItemTitle>URL de l'instance Odoo</ItemTitle>
        <ItemDescription>
          L'URL de votre instance Odoo, par exemple :
          https://mon-instance-odoo.com
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Input
          v-model="settings.odoo.value.url"
          placeholder="https://mon-instance-odoo.com"
        />
      </ItemActions>
    </Item>
    <Item>
      <ItemContent>
        <ItemTitle>Clé API Odoo</ItemTitle>
        <ItemDescription>
          La clé API pour accéder à votre instance Odoo. Assurez-vous que cette
          clé a les permissions nécessaires pour lire et écrire les données des
          produits.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Input
          v-model="settings.odoo.value.apiKey"
          placeholder="Clé API pour accéder à l'instance Odoo"
        />
      </ItemActions>
    </Item>
  </ItemGroup>
</template>

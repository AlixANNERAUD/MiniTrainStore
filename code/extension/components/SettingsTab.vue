<script setup lang="ts">
import { useSettingsStore } from "@/stores/settings";
import Item from "./ui/item/Item.vue";
import ItemContent from "./ui/item/ItemContent.vue";
import ItemGroup from "./ui/item/ItemGroup.vue";
import ItemTitle from "./ui/item/ItemTitle.vue";
import ItemActions from "./ui/item/ItemActions.vue";
import Input from "./ui/input/Input.vue";
import ItemDescription from "./ui/item/ItemDescription.vue";
import Button from "./ui/button/Button.vue";
import ScrollArea from "./ui/scroll-area/ScrollArea.vue";
import ButtonGroup from "./ui/button-group/ButtonGroup.vue";
import { downloadStringAsFile } from "@/utilities/browser";

const settings = useSettingsStore();

function resetSettings() {
  if (
    confirm(
      "Êtes-vous sûr de vouloir réinitialiser les paramètres ? Cette action est irréversible.",
    )
  ) {
    settings.reset();
  }
}

function exportSettings() {
  downloadStringAsFile(
    JSON.stringify(settings.export(), null, 2),
    "mini-train-store-settings.json",
  );
}

function importSettings() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string);
          settings.import(importedSettings);
          alert("Paramètres importés avec succès !");
        } catch (error) {
          alert(
            `Erreur lors de l'importation des paramètres : ${(error as Error).message}`,
          );
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}
</script>

<template>
  <ScrollArea class="w-full h-80">
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
            La clé API pour accéder à votre instance Odoo. Assurez-vous que
            cette clé a les permissions nécessaires pour lire et écrire les
            données des produits.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Input
            v-model="settings.odoo.value.apiKey"
            type="password"
            placeholder="Clé API pour accéder à l'instance Odoo"
          />
        </ItemActions>
      </Item>
      <Item>
        <ItemContent>
          <ItemTitle> Gestion des données de l'extension </ItemTitle>
        </ItemContent>
        <ItemActions>
          <ButtonGroup>
            <Button variant="outline" @click="exportSettings()">
              Exporter
            </Button>
            <Button variant="outline" @click="importSettings()">
              Importer
            </Button>
            <Button variant="destructive" @click="resetSettings()">
              Réinitialiser
            </Button>
          </ButtonGroup>
        </ItemActions>
      </Item>
    </ItemGroup>
  </ScrollArea>
</template>

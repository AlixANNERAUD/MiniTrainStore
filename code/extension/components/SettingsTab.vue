<script setup lang="ts">
import { useSettingsStore } from "@/stores/settings";
import {
  Field,
  FieldGroup,
  FieldSet,
  FieldLegend,
  FieldLabel,
  FieldDescription,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { downloadStringAsFile } from "@/utilities/browser";
import ScrollArea from "./ui/scroll-area/ScrollArea.vue";
import TagsEditor from "./TagsEditor.vue";
import CategoriesEditor from "./CategoriesEditor.vue";

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
  <ScrollArea class="h-full w-full min-h-0">
    <FieldGroup>
      <FieldSet>
        <FieldLegend>Configuration Odoo</FieldLegend>
        <FieldDescription>
          Configurez l'URL et la clé API pour vous connecter à votre instance
          Odoo.
        </FieldDescription>
        <Field>
          <FieldLabel for="odoo-url">URL de l'instance Odoo</FieldLabel>
          <Input
            id="odoo-url"
            v-model="settings.odoo.value.url"
            class="w-80"
            placeholder="https://mon-instance-odoo.com"
          />
          <FieldDescription>
            Entrez l'URL complète de votre instance Odoo.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel for="odoo-api-key">Clé API Odoo</FieldLabel>
          <Input
            id="odoo-api-key"
            v-model="settings.odoo.value.apiKey"
            type="password"
            class="w-80"
            placeholder="Clé API pour accéder à l'instance Odoo"
          />
          <FieldDescription>
            Fournissez la clé API pour authentifier les requêtes.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel for="odoo-image-crop-ratio">
            Ratio de recadrage vertical des images
          </FieldLabel>
          <Input
            id="odoo-image-crop-ratio"
            v-model.number="settings.odoo.value.imageVerticalCropRatio"
            type="number"
            min="0"
            max="0.49"
            step="0.01"
            class="w-80"
            placeholder="0.06"
          />
          <FieldDescription>
            Pourcentage retiré en haut et en bas de chaque image (0.06 = 6 %).
          </FieldDescription>
        </Field>
      </FieldSet>
      <FieldSeparator />
      <CategoriesEditor />
      <FieldSeparator />
      <TagsEditor />
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>Gestion des données de l'extension</FieldLegend>
        <FieldDescription>
          Exportez, importez ou réinitialisez les paramètres de l'extension.
        </FieldDescription>
        <Field orientation="horizontal">
          <Button variant="outline" @click="exportSettings()">
            Exporter
          </Button>
          <Button variant="outline" @click="importSettings()">
            Importer
          </Button>
          <Button variant="destructive" @click="resetSettings()">
            Réinitialiser
          </Button>
        </Field>
      </FieldSet>
    </FieldGroup>
  </ScrollArea>
</template>

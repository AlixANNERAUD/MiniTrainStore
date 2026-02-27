async function exportToOdoo() {
  if (!odooUrl.value || !odooApiKey.value) {
    showOdooSettings.value = true;
    return;
  }

  if (!currentProfile.value) {
    alert("Veuillez sélectionner un profil");
    return;
  }

  // Get active products with details (excluding sold/removed)
  const productsToExport = currentProducts.value.filter(
    (p) =>
      p.state === ProductState.ACTIVE &&
      p.description &&
      p.photos &&
      p.photos.length > 0,
  );

  if (productsToExport.length === 0) {
    alert("Aucun produit actif avec détails à exporter");
    return;
  }

  if (!confirm(`Exporter ${productsToExport.length} produit(s) vers Odoo ?`)) {
    return;
  }

  exportingToOdoo.value = true;

  try {
    // Send products to background script for Odoo export
    const response = await browser.runtime.sendMessage({
      type: "EXPORT_TO_ODOO",
      odooUrl: odooUrl.value,
      odooApiKey: odooApiKey.value,
      odooApiPath: odooApiPath.value,
      username: selectedProfile.value,
      products: productsToExport,
      productIds: productsToExport.map((p) => p.identifier),
    });

    if (response.success) {
      let message = `Export réussi!\n${response.created} créés, ${response.updated} mis à jour`;
      if (response.archived > 0) {
        message += `, ${response.archived} archivés`;
      }
      if (response.errors && response.errors.length > 0) {
        message += `\n\n⚠️ ${response.errors.length} erreur(s)`;
      }
      alert(message);
      await loadProfiles(); // Reload to show updated export status
    } else {
      alert(`Erreur lors de l'export: ${response.error}`);
    }
  } catch (error) {
    console.error("Error exporting to Odoo:", error);
    alert(`Erreur: ${error}`);
  } finally {
    exportingToOdoo.value = false;
  }
}

async function exportSingleProduct(product: Product, event: Event) {
  event.stopPropagation(); // Prevent opening the URL

  if (!odooUrl.value || !odooApiKey.value) {
    showOdooSettings.value = true;
    return;
  }

  if (!selectedProfile.value) {
    alert("Veuillez sélectionner un profil");
    return;
  }

  // Check if product has details
  if (!product.description || !product.photos || product.photos.length === 0) {
    alert(
      "Ce produit n'a pas de détails (description/photos). Visitez la page de l'annonce pour les récupérer.",
    );
    return;
  }

  exportingProductId.value = product.identifier;

  try {
    const response = await browser.runtime.sendMessage({
      type: "EXPORT_SINGLE_TO_ODOO",
      odooUrl: odooUrl.value,
      odooApiKey: odooApiKey.value,
      odooApiPath: odooApiPath.value,
      username: selectedProfile.value,
      product: product,
    });

    if (response.success) {
      let message = "Export réussi!";
      if (response.created) message = "✓ Produit créé dans Odoo";
      if (response.updated) message = "✓ Produit mis à jour dans Odoo";
      if (response.archived) message = "✓ Produit archivé dans Odoo";
      alert(message);
      await loadProfiles(); // Reload to show updated export status
    } else {
      alert(`Erreur: ${response.error}`);
    }
  } catch (error) {
    console.error("Error exporting product:", error);
    alert(`Erreur: ${error}`);
  } finally {
    exportingProductId.value = null;
  }
}

import { CombinedProduct, OrderBy, ProductState } from "./settings";

export const ProductStateLabels: Record<ProductState, string> = {
  [ProductState.ACTIVE]: "Disponible",
  [ProductState.PURCHASE_PENDING]: "Achat en cours",
  [ProductState.PURCHASE_COMPLETED]: "Vendu",
  [ProductState.REMOVED]: "Retiré",
};

export const OrderByLabels: Record<OrderBy, string> = {
  [OrderBy.DATE]: "Date de publication",
  [OrderBy.PRICE]: "Prix",
};

export function getProductStatistics(
  products: CombinedProduct[],
): Record<ProductState, number> {
  const stats: Record<ProductState, number> = {
    [ProductState.ACTIVE]: 0,
    [ProductState.PURCHASE_COMPLETED]: 0,
    [ProductState.REMOVED]: 0,
    [ProductState.PURCHASE_PENDING]: 0,
  };

  products.forEach((p) => {
    stats[p.listing.state]++;
  });

  return stats;
}
export function filterAndSortProducts(
  products: CombinedProduct[],
  filters: {
    state?: ProductState;
    withDetailsOnly?: boolean;
  },
  orderBy: OrderBy = OrderBy.DATE,
): CombinedProduct[] {
  let filtered = products.filter((p) => {
    if (filters?.state && p.listing.state !== filters.state) {
      return false;
    }
    return true;
  });

  if (orderBy === "date") {
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.listing.date).getTime();
      const dateB = new Date(b.listing.date).getTime();

      return dateB - dateA; // Newest first
    });
  } else if (orderBy === "price") {
    filtered = filtered.sort((a, b) => a.listing.price - b.listing.price); // Lowest price first
  }

  return filtered;
}

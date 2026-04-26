export const ARTICLES_SELECTOR = 'article[data-qa-id="aditem_container"]';
export const PAGINATION_BUTTONS_SELECTOR =
  'button[data-spark-component="pagination-item"]';
export const PAGINATION_BUTTON_SELECTOR = (pageNum: number) =>
  `button[data-spark-component="pagination-item"][data-index="${pageNum}"]`;
export const LINK_SELECTOR = 'a[href^="/ad/"]';
export const TITLE_SELECTOR = "h3";
export const PRICE_SELECTOR = 'span[data-qa-id="aditem_price"]';
export const IMAGE_SELECTOR = 'img[src^="https://img.leboncoin.fr/"]';
export const BADGE_SELECTOR = 'div[data-spark-component="tag"]';
export const DATE_SELECTOR = 'p[title*="202"]';

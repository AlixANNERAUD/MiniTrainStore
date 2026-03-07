export function openUrl(url: string) {
  browser.tabs.create({ url });
}

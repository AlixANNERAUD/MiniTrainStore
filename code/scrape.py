from datetime import datetime
from product import (
    merge_products,
    ProductState,
    save_to_file,
    load_from_file,
)
import traceback
import dateparser
import settings
from zendriver.core.tab import Tab
from zendriver.core.element import Element
import asyncio
import zendriver as zd
import re
from product import Product
import log

LOGGER = log.get_logger(__name__)


async def parse_article_in_profile(article: Element) -> Product:
    # Get the title
    title_elem = await article.query_selector('p[data-test-id="adcard-title"]')
    title = title_elem.text if title_elem else "N/A"

    # Get the price
    price_elem = await article.query_selector('span[data-qa-id="aditem_price"]')
    price = price_elem.text if price_elem else "N/A"
    price = "".join(filter(str.isdigit, price))
    price = float(price)

    # Get the URL
    link_elem = await article.query_selector('a[href^="/ad/"]')
    relative_url = link_elem.get("href") if link_elem else ""
    full_url = f"https://www.leboncoin.fr{relative_url}" if relative_url else "N/A"

    # Get the date
    date_posted = "N/A"
    try:
        date_elem = await article.query_selector('p[title*="2025"]')
        if date_elem:
            date_posted = date_elem.text
    except Exception:
        pass

    # Parse date
    date = dateparser.parse(
        date_posted,
        languages=["fr"],
        settings={"TIMEZONE": "Europe/Paris", "RETURN_AS_TIMEZONE_AWARE": True},
    )
    if date is None:
        date = datetime.now()

    return Product(
        title=title,
        price=price,
        url=full_url,
        date_posted=date_posted,
        date=date,
        state=ProductState.ACTIVE,
    )


def fix_url(url: str | None) -> str:
    if url is None:
        return ""

    return re.sub(r"ad-thumb", "ad-large", url)


async def get_photo_urls(page: Tab) -> list[str]:
    imgs = await page.select_all("button > img")

    return [fix_url(img.get("src")) for img in imgs]


async def parse_article(page: Tab) -> tuple[str, list[str]]:
    # Get the description
    see_more_button = next(
        button
        for button in await page.select_all("button")
        if button.text == "Voir plus"
    )

    await see_more_button.click()

    description_elem = await page.select("#readme-content")
    description_elem = description_elem.text if description_elem else ""

    galery_button = next(
        button
        for button in await page.select_all("button")
        if re.match(r"Voir les \d+ photos", button.text)
    )

    await galery_button.click()

    photos = await get_photo_urls(page)

    return (description_elem, photos)


async def scrape_products(page: Tab, articles: list[Product]) -> list[Product]:
    for article in articles:
        if len(article.photos) > 0 or article.state != ProductState.ACTIVE:
            LOGGER.info(
                f"Skipping article {article.url} (already has photos or not active)."
            )
            continue

        try:
            await page.get(article.url)

            await asyncio.sleep(1)

            (description, photos) = await parse_article(page)

            article.description = description
            article.photos = photos
        except Exception as e:
            LOGGER.error(f"Error scraping article {article.url}: {e}")
            # print stack trace
            traceback.print_exc()

    return articles


async def scrape_profile(page: Tab, username: str) -> list[Product]:
    url = f"https://www.leboncoin.fr/profile/{username}"

    articles = []

    # Navigate to the profile page
    await page.get(url)

    for i in range(1, 100):
        await asyncio.sleep(2)

        # Wait for the articles to load
        LOGGER.info(f"Scraping page {i}...")
        raw_articles = await page.select_all('article[data-test-id="ad"]')
        LOGGER.info(f"Found {len(raw_articles)} articles on page {i}.")
        page_articles = [
            await parse_article_in_profile(article) for article in raw_articles
        ]

        articles.extend(page_articles)

        try:
            LOGGER.info(f"Navigating to page {i}...")
            next_page_button = await page.select(
                f"button[title='Page {i + 1}']", timeout=2
            )
            await next_page_button.click()
        except Exception:
            break

    return articles


async def main():
    browser = await zd.start(
        user_data_dir=".profile",
        language="fr-FR",
        browser_args=[
            "--start-maximized",
            "--disable-features=ExtensionManifestV2Unsupported,ExtensionManifestV2Disabled",
        ],
    )

    page = browser.tabs[0]

    existing_products: list[Product] = []
    if settings.FILE_PATH.exists():
        existing_products = load_from_file(settings.FILE_PATH)

    LOGGER.info(
        f"{len(existing_products)} annonces existantes dans {settings.LEBONCOIN_IDENTIFIER}.json\n"
    )

    scraped_products = await scrape_profile(page, settings.LEBONCOIN_IDENTIFIER)

    LOGGER.info(f"\n{len(scraped_products)} annonces trouvées :\n")

    products = merge_products(existing_products, scraped_products)

    LOGGER.info(f"{len(products)} annonces après fusion :\n")

    products = await scrape_products(page, products)

    save_to_file(settings.FILE_PATH, products)

    LOGGER.info(
        f"Annonces mises à jour avec les détails dans {settings.LEBONCOIN_IDENTIFIER}.json"
    )

    await browser.stop()


if __name__ == "__main__":
    asyncio.run(main())

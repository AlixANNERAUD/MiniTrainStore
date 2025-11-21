from datetime import datetime
import json
from pathlib import Path
from enum import Enum
from dataclasses import dataclass, asdict, field


class ProductState(Enum):
    ACTIVE = "active"
    DELETED = "deleted"


@dataclass
class Product:
    title: str
    price: float
    url: str
    date_posted: str
    date: datetime = field(default_factory=datetime.now)
    description: str = ""
    photos: list[str] = field(default_factory=list)
    state: ProductState = ProductState.DELETED


def products_to_list(articles: list[Product]) -> list[dict]:
    return [
        {
            **asdict(article),
            "state": article.state.value,
            "date": article.date.isoformat(),
        }
        for article in articles
    ]


def dict_to_products(data: list[dict]) -> list[Product]:
    articles = []
    for item in data:
        article = Product(
            title=item.get("title", ""),
            price=item.get("price", 0.0),
            url=item.get("url", ""),
            date_posted=item.get("date_posted", ""),
            description=item.get("description", ""),
            photos=item.get("photos", []),
        )

        if "state" in item:
            article.state = ProductState(item["state"])
        else:
            article.state = ProductState.DELETED

        if "date" in item:
            article.date = datetime.fromisoformat(item["date"])
        else:
            article.date = datetime.now()

        articles.append(article)
    return articles


def load_from_file(path: Path) -> list[Product]:
    with open(path, "r", encoding="utf-8") as file:
        data = json.load(file)

    return dict_to_products(data)


def save_to_file(path: Path, products: list[Product]):
    # Sort them by date posted descending
    products.sort(key=lambda x: x.date_posted, reverse=True)

    product_list = products_to_list(products)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(product_list, f, ensure_ascii=False, indent=2)


def merge_products(
    existing_articles: list[Product], scraped_articles: list[Product]
) -> list[Product]:
    merged = {article.url: article for article in existing_articles}

    for article in existing_articles:
        article.state = ProductState.DELETED

    for article in scraped_articles:
        merged_article = merged.get(article.url)
        if merged_article:
            merged_article.title = article.title
            merged_article.price = article.price
            merged_article.date_posted = article.date_posted
            merged_article.date = article.date
            merged_article.state = article.state
        else:
            merged[article.url] = article

    return list(merged.values())

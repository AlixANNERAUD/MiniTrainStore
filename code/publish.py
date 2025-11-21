from product import load_from_file, ProductState, Path
import requests
from product import Product
import os
import re
from urllib.parse import urlparse
import base64
import log
import settings
from PIL import Image
from io import BytesIO

LOGGER = log.get_logger(__name__)

HEADERS = {
    "Authorization": f"bearer {settings.ODOO_API_KEY}",
    "User-Agent": "mysoftware " + requests.utils.default_user_agent(),
}

TAGS_MAP = {
    "Jouef": ["jouef"],
    "Lima": ["lima"],
    "Hornby": ["hornby"],
    "Roco": ["roco"],
    "Piko": ["piko"],
    "Märklin": ["marklin", "märklin"],
    "Fleischmann": ["fleischmann"],
    "H0": ["ho"],
    "SNCF": ["sncf"],
}

CATEGORY_MAP = {
    "Wagons": [
        "wgon",
        "wagon",
        "wagons",
        "voiture",
        "voitures",
        "fourgon",
        "allège",
        "remorque",
    ],
    "Locomotives": [
        "locomotive",
        "locomotives",
        "locotracteur",
        "locotender",
        "autorail",
    ],
    "Rails": [
        "trails",
        "rail",
        "aiguillage",
        "voie",
        "rails",
        "aiguillages",
        "voies",
        "croisement",
        "jonction",
        "tjd",
        "heurtoir",
        "heurtoirs",
    ],
    "Décor": ["personnages", "personnage", "tunnel", "conteneurs", "bureau"],
    "Coffrets": ["coffret", "coffrets"],
}

TAGS_ID_CACHE: dict[str, int] = {}
CATEGORY_ID_CACHE: dict[str, int] = {}
PUBLIC_CATEGORY_ID_CACHE: dict[str, int] = {}
TAX_ID_CACHE: dict[str, int] = {}

IMAGES_DIRECTORY = Path("images")

OVERWRITE_PRODUCTS = True
OVERWRITE_IMAGES = False


def raise_for_status(res: requests.Response):
    try:
        res.raise_for_status()
    except requests.HTTPError as e:
        raise Exception(
            f"HTTP error {res.status_code} for URL {res.url}: {res.text}"
        ) from e


def search_product(product: Product) -> int | None:
    res_search = requests.post(
        f"{settings.ODOO_URL}/product.template/search",
        headers=HEADERS,
        json={"domain": [["name", "=", product.title]]},
    )
    raise_for_status(res_search)
    product_ids = res_search.json()

    LOGGER.info(f"Product IDs found for article '{product.title}': {product_ids}")

    if not product_ids:
        return None

    return product_ids[0]


def archive_product(products: list[int]):
    # Suppression du produit
    res_delete = requests.post(
        f"{settings.ODOO_URL}/product.template/action_archive",
        headers=HEADERS,
        json={"ids": products, "context": {}},
    )
    raise_for_status(res_delete)


def get_tags(product: Product) -> list[str]:
    tags = []

    title = product.title.lower().split()

    for brand, keywords in TAGS_MAP.items():
        if any(keyword in title for keyword in keywords):
            tags.append(brand)

    return tags


def string_to_html(s: str) -> str:
    """Convert a plain string to simple HTML by replacing newlines with <br> tags."""
    return s.replace("\n", "<br/>")


def get_category(product: Product) -> str | None:
    title = product.title.lower().split()

    for category, keywords in CATEGORY_MAP.items():
        if any(keyword in title for keyword in keywords):
            return category

    LOGGER.warning(f"Category not found for article '{product.title}'")

    return None


def get_category_id(category_name: str) -> int:
    category_id = CATEGORY_ID_CACHE.get(category_name)
    if category_id is not None:
        return category_id

    res_search = requests.post(
        f"{settings.ODOO_URL}/product.category/search",
        headers=HEADERS,
        json={"domain": [["name", "=", category_name]]},
    )
    raise_for_status(res_search)
    category_ids = res_search.json()

    if not category_ids:
        raise ValueError(f"Category '{category_name}' not found in Odoo.")

    CATEGORY_ID_CACHE[category_name] = category_ids[0]

    return category_ids[0]


def get_public_category_id(category_name: str) -> int | None:
    public_category_id = PUBLIC_CATEGORY_ID_CACHE.get(category_name)
    if public_category_id is not None:
        return public_category_id

    res_search = requests.post(
        f"{settings.ODOO_URL}/product.public.category/search",
        headers=HEADERS,
        json={"domain": [["name", "=", category_name]]},
    )
    raise_for_status(res_search)
    public_category_ids = res_search.json()

    if not public_category_ids:
        LOGGER.warning(f"Public Category '{category_name}' not found in Odoo.")
        return None

    PUBLIC_CATEGORY_ID_CACHE[category_name] = public_category_ids[0]

    return public_category_ids[0]


def get_tag_id(tag_name: str) -> int:
    tag_id = TAGS_ID_CACHE.get(tag_name)
    if tag_id is not None:
        return tag_id

    res_search = requests.post(
        f"{settings.ODOO_URL}/product.tag/search",
        headers=HEADERS,
        json={"domain": [["name", "=", tag_name]]},
    )
    raise_for_status(res_search)
    tag_ids = res_search.json()

    if not tag_ids:
        raise ValueError(f"Tag '{tag_name}' not found in Odoo.")

    TAGS_ID_CACHE[tag_name] = tag_ids[0]

    return tag_ids[0]


def get_tax_id() -> int:
    tax_name = "0% EXEMPT G"
    tax_id = TAX_ID_CACHE.get(tax_name)
    if tax_id is not None:
        return tax_id

    res_search = requests.post(
        f"{settings.ODOO_URL}/account.tax/search",
        headers=HEADERS,
        json={"domain": [["name", "=", tax_name]]},
    )
    raise_for_status(res_search)
    tax_ids = res_search.json()

    if not tax_ids:
        raise ValueError(f"Tax '{tax_name}' not found in Odoo.")

    TAX_ID_CACHE[tax_name] = tax_ids[0]

    return tax_ids[0]


def product_to_odoo_dict(
    product: Product,
) -> dict:
    tags = get_tags(product)
    tags_ids = [get_tag_id(tag) for tag in tags]
    category = get_category(product)

    tax_id = get_tax_id()

    description_html = string_to_html(product.description)
    description_html = f"{description_html}<br/>Disponible également sur <a href='{product.url}'>leboncoin.fr</a>"

    (first_image, image_ids) = load_images(product)

    created_date = product.date.strftime("%Y-%m-%d %H:%M:%S")

    product_data = {
        "name": product.title,
        "list_price": product.price,
        "website_published": True,
        "qty_available": 1.0,
        "description_ecommerce": description_html,
        "product_tag_ids": [(6, 0, tags_ids)],
        "image_1920": first_image,
        "taxes_id": [(6, 0, [tax_id])],
        "product_template_image_ids": [
            (6, 0, image_ids)
        ],  # Use Odoo command to replace all images
        "create_date": created_date,
        "publish_date": created_date,
        "write_date": created_date,
    }

    if category is not None:
        product_data["categ_id"] = get_category_id(category)

        public_category_id = get_public_category_id(category)
        if public_category_id is not None:
            product_data["public_categ_ids"] = [(6, 0, [public_category_id])]

    return product_data


def write_product(
    product_id: int,
    product: Product,
):
    product_data = product_to_odoo_dict(product)

    res_write = requests.post(
        f"{settings.ODOO_URL}/product.template/write",
        headers=HEADERS,
        json={"ids": [product_id], "vals": product_data},
    )
    raise_for_status(res_write)
    LOGGER.info(f"Produit mis à jour avec ID : {product_id}")


def create_product(
    product: Product,
) -> int:
    product_data = product_to_odoo_dict(product)

    res_create = requests.post(
        f"{settings.ODOO_URL}/product.template/create",
        headers=HEADERS,
        json={"vals_list": [product_data]},
    )
    raise_for_status(res_create)
    product_ids = res_create.json()
    # Odoo's create method returns a list of IDs when using vals_list
    product_id = product_ids[0] if isinstance(product_ids, list) else product_ids
    LOGGER.info(f"Produit créé avec ID : {product_id}")

    return product_id


def load_images(product: Product) -> tuple[str | None, list[int]]:
    image_ids: list[int] = []
    first_image: str | None = None

    base_name = product.title.lower().replace(" ", "_")
    base_name = re.sub(r"[^a-z0-9_]", "", base_name)

    for i, url in enumerate(product.photos):
        # Get all resized versions
        resized_images = get_resized_images(url, base_name, i + 1)

        if first_image is None:
            # Use the 1920x1920 size for the main product image (use 1024 as largest available)
            first_image = resized_images[1024]
        else:
            name = f"{base_name}_{i + 1}.jpg"
            image_id = upload_image(name, resized_images)
            image_ids.append(image_id)

    return (first_image, image_ids)


def search_image(name: str) -> int | None:
    res_search = requests.post(
        f"{settings.ODOO_URL}/product.image/search",
        headers=HEADERS,
        json={"domain": [["name", "=", name]]},
    )
    raise_for_status(res_search)
    image_ids = res_search.json()

    if not image_ids:
        return None

    return image_ids[0]


def resize_image(image_data: bytes, size: int) -> bytes:
    """Resize image to specified size while maintaining aspect ratio."""
    img = Image.open(BytesIO(image_data))

    # Convert RGBA to RGB if necessary
    if img.mode == "RGBA":
        # Create a white background
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])  # 3 is the alpha channel
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Calculate new dimensions maintaining aspect ratio
    img.thumbnail((size, size), Image.Resampling.LANCZOS)

    # Save to bytes
    output = BytesIO()
    img.save(output, format="JPEG", quality=95)
    return output.getvalue()


def download_image(url: str) -> str:
    file_name = IMAGES_DIRECTORY / Path(urlparse(url).path).name

    # If the file already exists, return the path
    if file_name.exists():
        with open(file_name, "rb") as f:
            image_data = f.read()
    else:
        response = requests.get(url)
        raise_for_status(response)
        image_data = response.content
        with open(file_name, "wb") as f:
            f.write(image_data)

    image_data = base64.b64encode(image_data).decode("ascii")

    return image_data


def get_resized_images(url: str, base_name: str, index: int) -> dict[int, str]:
    """Download and resize image to multiple sizes, caching them in the images folder."""
    sizes = [128, 256, 512, 1024]
    resized_images = {}

    # Parse the original filename
    original_file_name = Path(urlparse(url).path).name
    base_original = IMAGES_DIRECTORY / original_file_name

    # Download original if needed
    if base_original.exists():
        with open(base_original, "rb") as f:
            original_data = f.read()
    else:
        response = requests.get(url)
        raise_for_status(response)
        original_data = response.content
        with open(base_original, "wb") as f:
            f.write(original_data)

    # Generate resized versions
    for size in sizes:
        # Create cached filename for this size
        cached_file = IMAGES_DIRECTORY / f"{base_name}_{index}_{size}.jpg"

        # Check if cached version exists
        if cached_file.exists():
            with open(cached_file, "rb") as f:
                resized_data = f.read()
        else:
            # Resize and cache
            resized_data = resize_image(original_data, size)
            with open(cached_file, "wb") as f:
                f.write(resized_data)
            LOGGER.info(f"Cached resized image: {cached_file.name}")

        # Encode to base64
        resized_images[size] = base64.b64encode(resized_data).decode("ascii")

    return resized_images


def upload_image(name: str, image_data_dict: dict[int, str]) -> int:
    """Upload image with all size variants (128, 256, 512, 1024)."""
    image_id = search_image(name)

    payload = {
        "name": name,
        "image_128": image_data_dict.get(128),
        "image_256": image_data_dict.get(256),
        "image_512": image_data_dict.get(512),
        "image_1024": image_data_dict.get(1024),
    }

    if image_id is not None:
        if not OVERWRITE_IMAGES:
            return image_id

        # Update existing image with new data

        res_update = requests.post(
            f"{settings.ODOO_URL}/product.image/write",
            headers=HEADERS,
            json={"ids": [image_id], "vals": payload},
        )
        raise_for_status(res_update)
        LOGGER.info(f"Image updated: {name} (ID: {image_id})")
        return image_id

    res_upload = requests.post(
        f"{settings.ODOO_URL}/product.image/create",
        headers=HEADERS,
        json={"vals_list": [payload]},
    )
    raise_for_status(res_upload)
    image_ids = res_upload.json()
    # Odoo's create method returns a list of IDs when using vals_list
    image_id = image_ids[0] if isinstance(image_ids, list) else image_ids
    LOGGER.info(f"Image created: {name} (ID: {image_id})")

    return image_id


def main():
    # Create cache folder 'images' if not exists
    if not os.path.exists(IMAGES_DIRECTORY):
        os.makedirs(IMAGES_DIRECTORY)

    products = load_from_file(settings.FILE_PATH)

    created_products = 0
    updated_products = 0
    archived_products = 0

    # logger.info("Champs produit :", res_create.json())

    for product in products:
        product.title = product.title.replace("Train wagon", "").strip()
        LOGGER.info(f"Processing article: {product.title}")

        product_id = search_product(product)

        if product_id is None:
            create_product(product)
            created_products += 1
        else:
            if product.state == ProductState.DELETED:
                archive_product([product_id])
                archived_products += 1
            else:
                if not OVERWRITE_PRODUCTS:
                    continue

                write_product(product_id, product)
                updated_products += 1

    LOGGER.info(
        f"Summary: {created_products} created, {updated_products} updated, {archived_products} archived."
    )


if __name__ == "__main__":
    main()

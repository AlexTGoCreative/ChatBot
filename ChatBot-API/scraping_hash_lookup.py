import asyncio
from playwright.async_api import async_playwright
import os
import re

TARGET_URL = "https://www.opswat.com/docs/mdcloud/metadefender-cloud-api-v4#hash-lookup"
output_dir = "scraped_html"
os.makedirs(output_dir, exist_ok=True)

def clean_text(text):

    text = re.sub(r'\s+', ' ', text)                
    text = re.sub(r'\n{2,}', '\n', text)            
    text = text.strip()
    return text

async def scrape_single_page(page, url):
    try:
        await page.goto(url, timeout=60000)
        await page.wait_for_timeout(3000)


        await page.evaluate("document.querySelector('a[name=\"hash-lookup\"]')?.scrollIntoView()")
        await page.wait_for_timeout(1000)

    
        html = await page.content()
        with open(f"{output_dir}/hash_lookup.html", "w", encoding="utf-8") as f:
            f.write(html)

        full_text = await page.locator("body").inner_text()
        cleaned_text = clean_text(full_text)

        with open(f"{output_dir}/hash_lookup.txt", "w", encoding="utf-8") as f:
            f.write(cleaned_text)

        print("Pagina a fost salvată și curățată.")

    except Exception as e:
        print(f"Eroare la {url}: {e}")

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        print(f"Scraping pagina: {TARGET_URL}")
        await scrape_single_page(page, TARGET_URL)

        await browser.close()

asyncio.run(run())

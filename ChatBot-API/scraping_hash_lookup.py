import asyncio
from playwright.async_api import async_playwright
import os
import re
import logging
import time
from typing import Optional
import hashlib
from datetime import datetime
import json

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

TARGET_URL = "https://www.opswat.com/docs/mdcloud/metadefender-cloud-api-v4#hash-lookup"
OUTPUT_DIR = "scraped_html"
CACHE_DIR = os.path.join(OUTPUT_DIR, "cache")
MAX_RETRIES = 3
RETRY_DELAY = 5  
MIN_CONTENT_LENGTH = 1000 

for directory in [OUTPUT_DIR, CACHE_DIR]:
    os.makedirs(directory, exist_ok=True)

class ContentValidationError(Exception):
    pass

def clean_text(text: str) -> str:
    """Clean and normalize text content."""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\n{2,}', '\n', text)
    text = text.strip()
    return text

def validate_content(content: str) -> bool:
    """Validate scraped content meets minimum requirements."""
    if len(content) < MIN_CONTENT_LENGTH:
        raise ContentValidationError(f"Content length ({len(content)}) below minimum threshold ({MIN_CONTENT_LENGTH})")
    
    required_keywords = ["hash", "lookup", "API", "response"]
    if not all(keyword.lower() in content.lower() for keyword in required_keywords):
        raise ContentValidationError("Content missing required keywords")
    
    return True

def calculate_content_hash(content: str) -> str:
    """Calculate SHA-256 hash of content for change detection."""
    return hashlib.sha256(content.encode()).hexdigest()

async def scrape_with_retry(page, url: str, max_retries: int = MAX_RETRIES) -> Optional[str]:
    """Scrape page with retry logic and rate limiting."""
    for attempt in range(max_retries):
        try:
            await page.goto(url, timeout=60000)
            await page.wait_for_timeout(3000)
            
            await page.evaluate("document.querySelector('a[name=\"hash-lookup\"]')?.scrollIntoView()")
            await page.wait_for_timeout(1000)
            
            return await page.content()
            
        except Exception as e:
            logger.error(f"Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
            if attempt < max_retries - 1:
                await asyncio.sleep(RETRY_DELAY * (attempt + 1))  
            else:
                raise

async def scrape_single_page(page, url: str):
    """Scrape a single page with enhanced error handling and validation."""
    try:
        cache_file = os.path.join(CACHE_DIR, f"{hashlib.md5(url.encode()).hexdigest()}.json")
        if os.path.exists(cache_file):
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
                if (datetime.now() - datetime.fromisoformat(cache_data['timestamp'])).days < 1:
                    logger.info(f"Using cached content for {url}")
                    return
        
        html = await scrape_with_retry(page, url)
        
        html_path = os.path.join(OUTPUT_DIR, "hash_lookup.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        
        full_text = await page.locator("body").inner_text()
        cleaned_text = clean_text(full_text)
        
        validate_content(cleaned_text)
        
        explanations_path = os.path.join(OUTPUT_DIR, "explanations.txt")
        if os.path.exists(explanations_path):
            with open(explanations_path, "r", encoding="utf-8") as f:
                explanations = f.read().strip()
                cleaned_text = f"{cleaned_text}\n\n{explanations}"
        
        output_path = os.path.join(OUTPUT_DIR, "hash_lookup.txt")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(cleaned_text)

        cache_data = {
            'timestamp': datetime.now().isoformat(),
            'content_hash': calculate_content_hash(cleaned_text),
            'url': url
        }
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f)
        
        logger.info(f"Successfully scraped and processed content from {url}")
        
    except ContentValidationError as e:
        logger.error(f"Content validation failed for {url}: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Error processing {url}: {str(e)}")
        raise

async def run():
    """Main scraping function with enhanced browser configuration."""
    async with async_playwright() as p:
        browser_context = await p.chromium.launch_persistent_context(
            user_data_dir=os.path.join(OUTPUT_DIR, "browser_data"),
            headless=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080},
            accept_downloads=True
        )
        
        try:
            page = await browser_context.new_page()
            logger.info(f"Starting scrape of {TARGET_URL}")
            await scrape_single_page(page, TARGET_URL)
        finally:
            await browser_context.close()

if __name__ == "__main__":
    asyncio.run(run())

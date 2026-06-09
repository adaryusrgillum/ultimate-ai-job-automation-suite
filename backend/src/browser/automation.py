
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import random
from typing import Dict, List, Optional
import json

class BrowserAutomation:
    def __init__(self, headless: bool = False, user_data_dir: str = None):
        self.driver = None
        self.headless = headless
        self.user_data_dir = user_data_dir
        self.wait_time = 10

    def setup_driver(self):
        """Initialize Chrome driver with stealth settings"""
        chrome_options = Options()

        if self.headless:
            chrome_options.add_argument("--headless")

        if self.user_data_dir:
            chrome_options.add_argument(f"--user-data-dir={self.user_data_dir}")

        # Stealth settings
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)

        # User agent
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    def navigate_to_job(self, job_url: str) -> bool:
        """Navigate to a specific job posting"""
        try:
            self.driver.get(job_url)
            time.sleep(random.uniform(2, 4))
            return True
        except Exception as e:
            print(f"Error navigating to job: {e}")
            return False

    def find_apply_button(self) -> Optional[str]:
        """Find and return the apply button selector"""
        apply_selectors = [
            "button[data-jk]",  # Indeed
            ".jobs-apply-button",  # LinkedIn
            "[data-testid='apply-button']",  # Generic
            "a[href*='apply']",  # Generic apply links
            "button:contains('Apply')",  # Text-based
            ".apply-btn",
            "#apply-button"
        ]

        for selector in apply_selectors:
            try:
                element = self.driver.find_element(By.CSS_SELECTOR, selector)
                if element.is_displayed() and element.is_enabled():
                    return selector
            except NoSuchElementException:
                continue

        return None

    def click_apply_button(self, selector: str) -> bool:
        """Click the apply button"""
        try:
            wait = WebDriverWait(self.driver, self.wait_time)
            button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))

            # Scroll to button
            self.driver.execute_script("arguments[0].scrollIntoView(true);", button)
            time.sleep(1)

            button.click()
            time.sleep(random.uniform(2, 4))
            return True
        except Exception as e:
            print(f"Error clicking apply button: {e}")
            return False

    def detect_form_fields(self) -> Dict[str, str]:
        """Detect form fields on the current page"""
        field_mappings = {}

        # Common field patterns
        field_patterns = {
            'first_name': ['input[name*="first"]', 'input[id*="first"]', 'input[placeholder*="First"]'],
            'last_name': ['input[name*="last"]', 'input[id*="last"]', 'input[placeholder*="Last"]'],
            'email': ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]'],
            'phone': ['input[type="tel"]', 'input[name*="phone"]', 'input[id*="phone"]'],
            'resume': ['input[type="file"]', 'input[name*="resume"]', 'input[accept*=".pdf"]'],
            'cover_letter': ['textarea[name*="cover"]', 'textarea[id*="cover"]', 'input[name*="cover"]'],
            'linkedin': ['input[name*="linkedin"]', 'input[id*="linkedin"]'],
            'portfolio': ['input[name*="portfolio"]', 'input[id*="website"]']
        }

        for field_name, selectors in field_patterns.items():
            for selector in selectors:
                try:
                    element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if element.is_displayed():
                        field_mappings[field_name] = selector
                        break
                except NoSuchElementException:
                    continue

        return field_mappings

    def fill_form_field(self, selector: str, value: str) -> bool:
        """Fill a specific form field"""
        try:
            element = self.driver.find_element(By.CSS_SELECTOR, selector)
            element.clear()

            # Type with human-like delays
            for char in value:
                element.send_keys(char)
                time.sleep(random.uniform(0.05, 0.15))

            return True
        except Exception as e:
            print(f"Error filling field {selector}: {e}")
            return False

    def upload_file(self, selector: str, file_path: str) -> bool:
        """Upload a file to a file input"""
        try:
            element = self.driver.find_element(By.CSS_SELECTOR, selector)
            element.send_keys(file_path)
            time.sleep(2)
            return True
        except Exception as e:
            print(f"Error uploading file: {e}")
            return False

    def submit_application(self) -> bool:
        """Submit the application form"""
        submit_selectors = [
            "button[type='submit']",
            "input[type='submit']",
            "button:contains('Submit')",
            ".submit-btn",
            "#submit-button"
        ]

        for selector in submit_selectors:
            try:
                element = self.driver.find_element(By.CSS_SELECTOR, selector)
                if element.is_displayed() and element.is_enabled():
                    element.click()
                    time.sleep(3)
                    return True
            except NoSuchElementException:
                continue

        return False

    def close_driver(self):
        """Close the browser driver"""
        if self.driver:
            self.driver.quit()

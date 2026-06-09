
import requests
from bs4 import BeautifulSoup
import time
import random
from typing import List, Dict
from urllib.parse import urljoin, urlparse

class JobScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def scrape_indeed_jobs(self, query: str, location: str, max_pages: int = 5) -> List[Dict]:
        """Scrape job listings from Indeed"""
        jobs = []
        base_url = "https://www.indeed.com/jobs"

        for page in range(max_pages):
            params = {
                'q': query,
                'l': location,
                'start': page * 10
            }

            try:
                response = self.session.get(base_url, params=params)
                soup = BeautifulSoup(response.content, 'html.parser')

                job_cards = soup.find_all('div', class_='job_seen_beacon')

                for card in job_cards:
                    job_data = self._extract_indeed_job_data(card)
                    if job_data:
                        jobs.append(job_data)

                # Random delay to avoid being blocked
                time.sleep(random.uniform(1, 3))

            except Exception as e:
                print(f"Error scraping page {page}: {e}")
                continue

        return jobs

    def _extract_indeed_job_data(self, card) -> Dict:
        """Extract job data from Indeed job card"""
        try:
            title_elem = card.find('h2', class_='jobTitle')
            title = title_elem.get_text().strip() if title_elem else "N/A"

            company_elem = card.find('span', class_='companyName')
            company = company_elem.get_text().strip() if company_elem else "N/A"

            location_elem = card.find('div', class_='companyLocation')
            location = location_elem.get_text().strip() if location_elem else "N/A"

            salary_elem = card.find('span', class_='salaryText')
            salary = salary_elem.get_text().strip() if salary_elem else "N/A"

            link_elem = title_elem.find('a') if title_elem else None
            job_url = urljoin("https://www.indeed.com", link_elem['href']) if link_elem else "N/A"

            return {
                'job_id': f"indeed_{hash(job_url)}",
                'title': title,
                'company': company,
                'location': location,
                'salary_range': salary,
                'source_url': job_url,
                'job_type': 'full-time',  # Default
                'remote_option': 'remote' in location.lower()
            }
        except Exception as e:
            print(f"Error extracting job data: {e}")
            return None

    def scrape_linkedin_jobs(self, query: str, location: str) -> List[Dict]:
        """Scrape LinkedIn jobs (requires authentication)"""
        # LinkedIn scraping is more complex and requires login
        # This is a placeholder for the implementation
        print("LinkedIn scraping requires authentication - implement with selenium")
        return []

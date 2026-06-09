
#!/usr/bin/env python3
"""
Health check script for the job application system
"""

import requests
import sqlite3
import os
import sys
from datetime import datetime, timedelta

def check_database():
    """Check database connectivity"""
    try:
        db_path = os.getenv('SQLITE_DB_PATH', 'data/job_app_system.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM user_profiles")
        count = cursor.fetchone()[0]
        conn.close()
        return True, f"Database OK - {count} user profiles"
    except Exception as e:
        return False, f"Database error: {e}"

def check_browser():
    """Check browser automation capability"""
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options

        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")

        driver = webdriver.Chrome(options=options)
        driver.get("https://www.google.com")
        title = driver.title
        driver.quit()

        return True, f"Browser OK - Loaded: {title}"
    except Exception as e:
        return False, f"Browser error: {e}"

def check_disk_space():
    """Check available disk space"""
    try:
        import shutil
        total, used, free = shutil.disk_usage("/app")
        free_gb = free // (1024**3)

        if free_gb < 1:
            return False, f"Low disk space: {free_gb}GB free"
        return True, f"Disk space OK: {free_gb}GB free"
    except Exception as e:
        return False, f"Disk check error: {e}"

def check_recent_activity():
    """Check for recent application activity"""
    try:
        db_path = os.getenv('SQLITE_DB_PATH', 'data/job_app_system.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check applications in last 24 hours
        yesterday = datetime.now() - timedelta(days=1)
        cursor.execute("""
            SELECT COUNT(*) FROM applications 
            WHERE application_date > ?
        """, (yesterday.isoformat(),))

        recent_apps = cursor.fetchone()[0]
        conn.close()

        return True, f"Recent activity: {recent_apps} applications in 24h"
    except Exception as e:
        return False, f"Activity check error: {e}"

def main():
    """Run all health checks"""
    checks = [
        ("Database", check_database),
        ("Browser", check_browser),
        ("Disk Space", check_disk_space),
        ("Recent Activity", check_recent_activity)
    ]

    all_passed = True
    results = []

    print(f"🏥 Health Check - {datetime.now().isoformat()}")
    print("=" * 50)

    for name, check_func in checks:
        try:
            passed, message = check_func()
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"{status} {name}: {message}")
            results.append((name, passed, message))

            if not passed:
                all_passed = False
        except Exception as e:
            print(f"❌ FAIL {name}: Exception - {e}")
            results.append((name, False, str(e)))
            all_passed = False

    print("=" * 50)
    print(f"Overall Status: {'✅ HEALTHY' if all_passed else '❌ UNHEALTHY'}")

    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()

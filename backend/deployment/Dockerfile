
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Install ChromeDriver
RUN CHROMEDRIVER_VERSION=`curl -sS chromedriver.storage.googleapis.com/LATEST_RELEASE` \
    && mkdir -p /opt/chromedriver-$CHROMEDRIVER_VERSION \
    && curl -sS -o /tmp/chromedriver_linux64.zip http://chromedriver.storage.googleapis.com/LATEST_RELEASE/chromedriver_linux64.zip \
    && unzip -qq /tmp/chromedriver_linux64.zip -d /opt/chromedriver-$CHROMEDRIVER_VERSION \
    && rm /tmp/chromedriver_linux64.zip \
    && chmod +x /opt/chromedriver-$CHROMEDRIVER_VERSION/chromedriver \
    && ln -fs /opt/chromedriver-$CHROMEDRIVER_VERSION/chromedriver /usr/local/bin/chromedriver

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p data logs config/browser_profiles

# Set environment variables
ENV PYTHONPATH=/app/src
ENV DISPLAY=:99

# Expose port for web interface (if using Flask/FastAPI)
EXPOSE 8000

# Create entrypoint script
RUN echo '#!/bin/bash\n\
# Start virtual display\n\
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &\n\
\n\
# Run the application\n\
exec "$@"' > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["python", "main.py", "--help"]

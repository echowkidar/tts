FROM python:3.10-slim

# Prevent interactive prompts, Python buffering, and set venv on PATH
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    VITE_HOST=0.0.0.0 \
    PATH="/app/backend/venv/bin:$PATH"

WORKDIR /app

# 1. Install system dependencies & Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ffmpeg \
    espeak-ng \
    build-essential \
    sed \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 2. Setup backend virtual environment & install Python packages (cached layer)
COPY backend/requirements.txt /app/backend/requirements.txt
RUN python3 -m venv /app/backend/venv \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/backend/requirements.txt

# 3. Copy frontend package files & install npm packages (cached layer)
COPY frontend/package*.json /app/frontend/
RUN cd /app/frontend && npm install

# 4. Copy project source code
COPY . /app

# Expose Frontend (5173) and Backend (8880) ports
EXPOSE 5173 8880

# Run non-interactive setup on container start & launch app
CMD ["bash", "-c", "yes | python studio.py setup && exec python studio.py start"]

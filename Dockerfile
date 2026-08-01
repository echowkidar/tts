FROM python:3.10-slim

# Prevent interactive prompts & Python buffering
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    VITE_HOST=0.0.0.0

WORKDIR /app

# 1. Install system packages & Node.js 20
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

# 2. Setup backend virtual environment and install Python dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN python3 -m venv /app/backend/venv \
    && /app/backend/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /app/backend/venv/bin/pip install --no-cache-dir -r /app/backend/requirements.txt

# 3. Copy frontend package files & install frontend dependencies
COPY frontend/package*.json /app/frontend/
RUN cd /app/frontend && npm install

# 4. Copy rest of project source code
COPY . /app

# 5. Build frontend static bundle for production
RUN cd /app/frontend && npm run build

# Expose Frontend (5173) and Backend (8880) ports
EXPOSE 5173 8880

# Default entrypoint/command
CMD ["python", "studio.py", "start"]

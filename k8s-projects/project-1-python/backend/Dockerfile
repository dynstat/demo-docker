# ---- Python Backend ----
FROM python:3.12-slim

WORKDIR /app

# Install deps first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Non-root user for security
RUN useradd -r appuser && chown -R appuser /app
USER appuser

EXPOSE 5000

CMD ["python", "app.py"]

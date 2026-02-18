# ---------- builder stage ----------
FROM python:3.11-slim AS builder
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# ---------- runtime stage ----------
FROM python:3.11-slim
WORKDIR /app

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app /app

# Render provides PORT env variable
ENV PORT=10000

# Run production server
CMD ["gunicorn", "-b", "0.0.0.0:10000", "app:app"]

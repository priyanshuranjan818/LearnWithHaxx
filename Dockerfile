# --- builder stage -----------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /app

# install build dependencies (none for this simple app, but kept for example)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# copy application
COPY . ./

# --- final runtime ----------------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

# copy just the installed packages from builder to keep image small
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# copy app code
COPY --from=builder /app /app

# create a volume mount point for the SQLite database so that it
# persists outside the container
VOLUME ["/app/vocab.db"]

EXPOSE 5000

ENV FLASK_APP=app.py
ENV FLASK_ENV=production

# use flask CLI; in production you'd replace this with gunicorn
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]

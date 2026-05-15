"""
Project 1 - Python FastAPI Backend
A minimal API that exposes pod metadata for Kubernetes teaching.
"""

import os
from datetime import datetime
import time
import uvicorn
from fastapi import FastAPI
import psycopg2

app = FastAPI()

APP_NAME = os.environ.get("APP_NAME", "python-backend")
APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")
APP_COLOR = os.environ.get("APP_COLOR", "#6C63FF")


# Simple db connection with retry
def get_db():
    while True:
        try:
            return psycopg2.connect(
                host=os.getenv("DB_HOST", "postgres-svc"),
                user=os.getenv("DB_USER", "user"),
                password=os.getenv("DB_PASS", "password123"),
                dbname=os.getenv("DB_NAME", "demodb")
            )
        except Exception as e:
            print(f"Waiting for database... {e}")
            time.sleep(2)

# Create table on startup
@app.on_event("startup")
def startup():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE TABLE IF NOT EXISTS items (name text)")
                conn.commit()
    except Exception as e:
        print(f"Failed to create table: {e}")

@app.get("/api/items")
def read_items():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT name FROM items")
                return [row[0] for row in cur.fetchall()]
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/items")
def create_item(name: str):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO items (name) VALUES (%s)", (name,))
                conn.commit()
        return {"status": "OK", "item": name}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/hello")
def hello():
    return {
        "message": f"Hello from {APP_NAME}!",
        "hostname": os.getenv("HOSTNAME", "unknown"),
        "version": APP_VERSION,
        "color": APP_COLOR,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/health")
def health():
    return {"status": "healthy", "hostname": os.getenv("HOSTNAME", "unknown")}


@app.get("/api/info")
def info():
    return {
        "app_name": APP_NAME,
        "app_version": APP_VERSION,
        "hostname": os.getenv("HOSTNAME", "unknown"),
        "platform": "Python / FastAPI",
        "node_name": os.environ.get("NODE_NAME", "unknown"),
        "pod_ip": os.environ.get("POD_IP", "unknown"),
        "namespace": os.environ.get("POD_NAMESPACE", "unknown"),
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

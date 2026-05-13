"""
Project 1 - Python FastAPI Backend
A minimal API that exposes pod metadata for Kubernetes teaching.
"""

import os
from datetime import datetime

import uvicorn
from fastapi import FastAPI

app = FastAPI()

APP_NAME = os.environ.get("APP_NAME", "python-backend")
APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")
APP_COLOR = os.environ.get("APP_COLOR", "#6C63FF")


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

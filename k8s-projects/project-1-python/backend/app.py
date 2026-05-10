"""
Project 1 - Python Flask Backend
A minimal API that exposes pod metadata for Kubernetes teaching.
"""

import os
import socket
from datetime import datetime
from flask import Flask, jsonify

app = Flask(__name__)

# ---------- Configuration from Environment / ConfigMap ----------
APP_NAME    = os.environ.get("APP_NAME", "python-backend")
APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")
APP_COLOR   = os.environ.get("APP_COLOR", "#6C63FF")   # used by frontend

# ---------- Endpoints ----------

@app.route("/api/hello")
def hello():
    """Main endpoint – returns greeting + pod hostname (great for load-balancing demo)."""
    return jsonify({
        "message": f"Hello from {APP_NAME}!",
        "hostname": socket.gethostname(),          # == pod name in K8s
        "version": APP_VERSION,
        "color": APP_COLOR,
        "timestamp": datetime.utcnow().isoformat()
    })


@app.route("/api/health")
def health():
    """Liveness / readiness probe target."""
    return jsonify({"status": "healthy", "hostname": socket.gethostname()})


@app.route("/api/info")
def info():
    """Returns environment metadata – useful for inspecting ConfigMaps & env vars."""
    return jsonify({
        "app_name": APP_NAME,
        "app_version": APP_VERSION,
        "hostname": socket.gethostname(),
        "platform": "Python / Flask",
        "node_name": os.environ.get("NODE_NAME", "unknown"),
        "pod_ip": os.environ.get("POD_IP", "unknown"),
        "namespace": os.environ.get("POD_NAMESPACE", "unknown"),
    })


# ---------- Run ----------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

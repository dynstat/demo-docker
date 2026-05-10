# 12 — Project 1: Python Flask + HTML/CSS/JS on Kubernetes

> **Stack**: Flask backend + Nginx-served frontend  
> **Environment**: KillerCoda single-node cluster  
> **Ports**: Backend 5000 (ClusterIP) → Frontend 80 (NodePort 30080)  
> **Namespace**: `python-demo`

---

## Architecture Overview

```
┌──────────────────────── KillerCoda Cluster ───────────────────────────┐
│                                                                       │
│  External User  ──►  http://172.30.1.2:30080                        │
│                          │                                            │
│                          ▼                                            │
│  ┌──────────────── NodePort Service (30080) ──────────────────┐     │
│  │                                                             │     │
│  │  ┌─────────────────────────────────────────────────────┐   │     │
│  │  │          Frontend Pod (Nginx)                       │   │     │
│  │  │                                                     │   │     │
│  │  │  Static files: index.html, style.css, app.js       │   │     │
│  │  │                                                     │   │     │
│  │  │  nginx.conf:                                       │   │     │
│  │  │    /         → serve static files                  │   │     │
│  │  │    /api/*    → proxy to python-backend-svc:5000    │   │     │
│  │  └──────────────────────┬──────────────────────────────┘   │     │
│  └─────────────────────────┼──────────────────────────────────┘     │
│                             │                                        │
│                             ▼  (K8s DNS: python-backend-svc)        │
│  ┌──────────────── ClusterIP Service (5000) ──────────────────┐     │
│  │                                                             │     │
│  │  ┌──────────────────┐    ┌──────────────────┐              │     │
│  │  │  Backend Pod #1  │    │  Backend Pod #2  │              │     │
│  │  │  Flask :5000     │    │  Flask :5000     │              │     │
│  │  │  /api/hello      │    │  /api/hello      │              │     │
│  │  │  /api/health     │    │  /api/health     │              │     │
│  │  │  /api/info       │    │  /api/info       │              │     │
│  │  └──────────────────┘    └──────────────────┘              │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  Namespace: python-demo                                              │
│  ConfigMap: python-backend-config (APP_NAME, APP_VERSION, APP_COLOR) │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Deployment on KillerCoda

### Step 1: Create Project Directory

```bash
mkdir -p ~/project-1-python/backend
mkdir -p ~/project-1-python/frontend
mkdir -p ~/project-1-python/k8s
cd ~/project-1-python
```

---

### Step 2: Create the Backend (Flask API)

```bash
# ── backend/app.py ──
cat << 'EOF' > backend/app.py
import os
import socket
from datetime import datetime
from flask import Flask, jsonify

app = Flask(__name__)

APP_NAME    = os.environ.get("APP_NAME", "python-backend")
APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")
APP_COLOR   = os.environ.get("APP_COLOR", "#6C63FF")

@app.route("/api/hello")
def hello():
    return jsonify({
        "message": f"Hello from {APP_NAME}!",
        "hostname": socket.gethostname(),
        "version": APP_VERSION,
        "color": APP_COLOR,
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/api/health")
def health():
    return jsonify({"status": "healthy", "hostname": socket.gethostname()})

@app.route("/api/info")
def info():
    return jsonify({
        "app_name": APP_NAME,
        "app_version": APP_VERSION,
        "hostname": socket.gethostname(),
        "platform": "Python / Flask",
        "node_name": os.environ.get("NODE_NAME", "unknown"),
        "pod_ip": os.environ.get("POD_IP", "unknown"),
        "namespace": os.environ.get("POD_NAMESPACE", "unknown"),
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
EOF
```

```bash
# ── backend/requirements.txt ──
cat << 'EOF' > backend/requirements.txt
flask==3.1.1
EOF
```

```bash
# ── backend/Dockerfile ──
cat << 'EOF' > backend/Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
RUN useradd -r appuser && chown -R appuser /app
USER appuser
EXPOSE 5000
CMD ["python", "app.py"]
EOF
```

> 🔍 **What each line does**:
> - `FROM python:3.12-slim` — lightweight Python base image (~120MB vs ~900MB full)
> - `COPY requirements.txt` first → Docker caches pip install layer (faster rebuilds)
> - `useradd -r appuser` → security: never run as root in containers
> - `EXPOSE 5000` → documentation only, doesn't actually open the port

---

### Step 3: Create the Frontend (HTML/CSS/JS + Nginx)

```bash
# ── frontend/index.html ──
cat << 'HTMLEOF' > frontend/index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>K8s Python Demo</title>
  <link rel="stylesheet" href="style.css" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@300;500;700&display=swap" rel="stylesheet" />
</head>
<body>
  <div class="grain"></div>
  <header>
    <div class="logo">⎈</div>
    <h1>Kubernetes <span class="accent">Python</span> Demo</h1>
    <p class="subtitle">Project 1 — Flask Backend + Static Frontend</p>
  </header>
  <main>
    <section class="card" id="api-card">
      <h2>🔗 API Response</h2>
      <button id="btn-call" onclick="callApi()">Call /api/hello</button>
      <div id="response" class="response-box">
        <span class="placeholder">Click the button to call the backend API…</span>
      </div>
    </section>
    <section class="card" id="pod-card">
      <h2>🖥️ Pod Info</h2>
      <button onclick="fetchInfo()">Fetch /api/info</button>
      <div id="info" class="response-box">
        <span class="placeholder">Pod metadata will appear here…</span>
      </div>
    </section>
    <section class="card" id="health-card">
      <h2>💚 Health Check</h2>
      <button onclick="checkHealth()">Check /api/health</button>
      <div id="health" class="response-box">
        <span class="placeholder">Health status will appear here…</span>
      </div>
    </section>
    <section class="card wide" id="lb-card">
      <h2>⚖️ Load Balancing Demo</h2>
      <p class="hint">Hit the API multiple times to see different pod hostnames when scaled.</p>
      <button onclick="loadBalanceDemo()">Send 10 Requests</button>
      <div id="lb-results" class="lb-grid"></div>
    </section>
  </main>
  <footer>
    <p>Built for the <strong>K8s Workshop</strong> — running on KillerCoda</p>
  </footer>
  <script src="app.js"></script>
</body>
</html>
HTMLEOF
```

```bash
# ── frontend/style.css ──
cat << 'EOF' > frontend/style.css
:root {
  --bg:#0c0e14;--surface:#151821;--border:#23283a;--text:#d4d9e8;
  --muted:#6b7394;--accent:#6c63ff;--accent-2:#00e5a0;--radius:12px;
  --font-body:'Outfit',sans-serif;--font-mono:'JetBrains Mono',monospace;
}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--font-body);background:var(--bg);color:var(--text);
  min-height:100vh;line-height:1.6}
.grain{position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.035;
  background:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
header{text-align:center;padding:3rem 1rem 2rem}
.logo{font-size:3rem;margin-bottom:.5rem;animation:spin 12s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:700}
.accent{color:var(--accent)}.subtitle{color:var(--muted);font-size:.95rem;margin-top:.3rem}
main{max-width:960px;margin:0 auto;padding:0 1.5rem 3rem;display:grid;
  grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:1.5rem;transition:border-color .25s,box-shadow .25s}
.card:hover{border-color:var(--accent);box-shadow:0 0 24px rgba(108,99,255,.12)}
.card.wide{grid-column:1/-1}.card h2{font-size:1.1rem;font-weight:600;margin-bottom:1rem}
button{font-family:var(--font-mono);font-size:.82rem;padding:.55rem 1.2rem;
  border:1px solid var(--accent);border-radius:6px;background:transparent;
  color:var(--accent);cursor:pointer;transition:background .2s,color .2s}
button:hover{background:var(--accent);color:#fff}
.response-box{margin-top:1rem;padding:1rem;background:#0d0f16;border:1px solid var(--border);
  border-radius:8px;font-family:var(--font-mono);font-size:.8rem;white-space:pre-wrap;
  word-break:break-all;min-height:60px;color:var(--accent-2)}
.placeholder{color:var(--muted);font-style:italic}
.hint{font-size:.82rem;color:var(--muted);margin-bottom:.8rem}
.lb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.6rem;margin-top:1rem}
.lb-chip{padding:.45rem .7rem;border-radius:6px;font-family:var(--font-mono);
  font-size:.72rem;text-align:center;border:1px solid var(--border);animation:fadeUp .35s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
footer{text-align:center;padding:2rem 1rem;color:var(--muted);font-size:.82rem}
footer strong{color:var(--accent)}
EOF
```

```bash
# ── frontend/app.js ──
cat << 'EOF' > frontend/app.js
const API_BASE = "/api";

function renderJSON(id, data) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  el.textContent = JSON.stringify(data, null, 2);
}
function showError(id, err) {
  document.getElementById(id).innerHTML = '<span style="color:#ff4d6a">Error: ' + err.message + '</span>';
}
function hostnameColor(hostname) {
  let h = 0;
  for (const c of hostname) h = c.charCodeAt(0) + ((h << 5) - h);
  return "hsl(" + (Math.abs(h) % 360) + ", 65%, 55%)";
}

async function callApi() {
  try { const r = await fetch(API_BASE + "/hello"); renderJSON("response", await r.json()); }
  catch (e) { showError("response", e); }
}
async function fetchInfo() {
  try { const r = await fetch(API_BASE + "/info"); renderJSON("info", await r.json()); }
  catch (e) { showError("info", e); }
}
async function checkHealth() {
  try { const r = await fetch(API_BASE + "/health"); renderJSON("health", await r.json()); }
  catch (e) { showError("health", e); }
}
async function loadBalanceDemo() {
  const grid = document.getElementById("lb-results");
  grid.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(API_BASE + "/hello");
      const d = await r.json();
      const chip = document.createElement("div");
      chip.className = "lb-chip";
      chip.style.animationDelay = (i * 0.06) + "s";
      chip.style.borderColor = hostnameColor(d.hostname);
      chip.style.color = hostnameColor(d.hostname);
      chip.textContent = d.hostname;
      grid.appendChild(chip);
    } catch (e) {
      const chip = document.createElement("div");
      chip.className = "lb-chip";
      chip.style.color = "#ff4d6a";
      chip.textContent = "error";
      grid.appendChild(chip);
    }
  }
}
EOF
```

```bash
# ── frontend/nginx.conf ──
cat << 'EOF' > frontend/nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse-proxy API calls to Flask backend K8s Service
    location /api/ {
        proxy_pass         http://python-backend-svc:5000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
EOF
```

> 🔍 **Key concept**: The Nginx config uses `python-backend-svc` as hostname.
> Inside K8s, CoreDNS resolves this to the ClusterIP Service → which load-balances
> across all backend pods. **This is K8s service discovery in action!**

```bash
# ── frontend/Dockerfile ──
cat << 'EOF' > frontend/Dockerfile
FROM nginx:1.27-alpine
RUN rm -rf /usr/share/nginx/html/*
COPY index.html style.css app.js /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
```

---

### Step 4: Build Docker Images & Import to containerd

This is the critical step that connects Docker → containerd → Kubernetes.

```bash
cd ~/project-1-python

# ── Build backend image ──
docker build -t python-backend:v1 ./backend/
echo "✅ Backend image built"

# ── Build frontend image ──
docker build -t python-frontend:v1 ./frontend/
echo "✅ Frontend image built"

# ── Verify images in Docker ──
docker images | grep python
```

```
┌──────────── What just happened ──────────────────┐
│                                                   │
│  docker build created images in Docker's store   │
│  (moby namespace in containerd)                  │
│                                                   │
│  But kubelet can only see the k8s.io namespace!  │
│  We need to IMPORT them.                         │
│                                                   │
└───────────────────────────────────────────────────┘
```

```bash
# ── Import images into containerd (k8s.io namespace) ──
docker save python-backend:v1  | ctr -n k8s.io images import -
docker save python-frontend:v1 | ctr -n k8s.io images import -
echo "✅ Images imported into containerd k8s.io namespace"

# ── Verify K8s can see them ──
crictl images | grep python
# You should see:
#   docker.io/library/python-backend    v1    <ID>    <SIZE>
#   docker.io/library/python-frontend   v1    <ID>    <SIZE>
```

---

### Step 5: Create Kubernetes Manifests

```bash
# ── k8s/namespace.yaml ──
cat << 'EOF' > k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: python-demo
  labels:
    project: python-demo
EOF
```

```bash
# ── k8s/configmap.yaml ──
cat << 'EOF' > k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: python-backend-config
  namespace: python-demo
data:
  APP_NAME: "python-backend"
  APP_VERSION: "1.0.0"
  APP_COLOR: "#6C63FF"
EOF
```

```bash
# ── k8s/backend-deployment.yaml ──
cat << 'EOF' > k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-backend
  namespace: python-demo
  labels:
    app: python-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: python-backend
  template:
    metadata:
      labels:
        app: python-backend
    spec:
      containers:
        - name: flask
          image: python-backend:v1
          imagePullPolicy: Never
          ports:
            - containerPort: 5000
          envFrom:
            - configMapRef:
                name: python-backend-config
          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_IP
              valueFrom:
                fieldRef:
                  fieldPath: status.podIP
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
          livenessProbe:
            httpGet:
              path: /api/health
              port: 5000
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 5000
            initialDelaySeconds: 3
            periodSeconds: 5
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
EOF
```

> 🔍 **Key learning points in this Deployment**:
> - `imagePullPolicy: Never` — use local image, don't try to pull from registry
> - `envFrom` — inject ALL ConfigMap keys as env vars
> - `env` with `fieldRef` — Downward API (pod knows its own name/IP/namespace)
> - `livenessProbe` — K8s restarts pod if `/api/health` fails 3 times
> - `readinessProbe` — K8s removes pod from Service if not ready
> - `resources` — prevents one pod from eating all node resources

```bash
# ── k8s/backend-service.yaml ──
cat << 'EOF' > k8s/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: python-backend-svc
  namespace: python-demo
  labels:
    app: python-backend
spec:
  type: ClusterIP
  selector:
    app: python-backend
  ports:
    - port: 5000
      targetPort: 5000
      protocol: TCP
EOF
```

> 🔍 **Why ClusterIP?** The backend doesn't need external access.
> Only the frontend Nginx talks to it (via `proxy_pass http://python-backend-svc:5000`).
> ClusterIP = internal only = more secure.

```bash
# ── k8s/frontend-deployment.yaml ──
cat << 'EOF' > k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-frontend
  namespace: python-demo
  labels:
    app: python-frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: python-frontend
  template:
    metadata:
      labels:
        app: python-frontend
    spec:
      containers:
        - name: nginx
          image: python-frontend:v1
          imagePullPolicy: Never
          ports:
            - containerPort: 80
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 3
            periodSeconds: 10
          resources:
            requests:
              cpu: 30m
              memory: 32Mi
            limits:
              cpu: 100m
              memory: 64Mi
EOF
```

```bash
# ── k8s/frontend-service.yaml ──
cat << 'EOF' > k8s/frontend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: python-frontend-svc
  namespace: python-demo
  labels:
    app: python-frontend
spec:
  type: NodePort
  selector:
    app: python-frontend
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
      protocol: TCP
EOF
```

> 🔍 **Why NodePort?** This is the entry point for external users.
> On KillerCoda, `NodePort 30080` makes the app accessible at `http://172.30.1.2:30080`.

---

### Step 6: Deploy Everything!

```bash
# Apply in order: namespace first, then config, then deployments, then services
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

echo "✅ All resources applied!"
```

**Or apply everything at once:**
```bash
kubectl apply -f k8s/
```

---

### Step 7: Verify the Deployment

```bash
# ── Check all resources in python-demo namespace ──
kubectl get all -n python-demo
```

**Expected output:**
```
NAME                                   READY   STATUS    RESTARTS   AGE
pod/python-backend-xxxxx-xxxxx         1/1     Running   0          30s
pod/python-backend-xxxxx-yyyyy         1/1     Running   0          30s
pod/python-frontend-xxxxx-zzzzz        1/1     Running   0          30s

NAME                          TYPE        CLUSTER-IP      PORT(S)        AGE
service/python-backend-svc    ClusterIP   10.96.x.x       5000/TCP       30s
service/python-frontend-svc   NodePort    10.96.x.x       80:30080/TCP   30s

NAME                              READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/python-backend    2/2     2            2           30s
deployment.apps/python-frontend   1/1     1            1           30s
```

```bash
# ── Test the backend from inside the cluster ──
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never \
  -n python-demo -- curl -s http://python-backend-svc:5000/api/hello

# ── Test the frontend via NodePort ──
curl http://172.30.1.2:30080/
curl http://172.30.1.2:30080/api/hello
```

---

### Step 8: Explore & Experiment

```bash
# ── Watch pod logs ──
kubectl logs -f deployment/python-backend -n python-demo

# ── See which pod handled the request ──
curl -s http://172.30.1.2:30080/api/hello | python3 -m json.tool
# Run it 5 times — notice the hostname changes (load balancing!)

# ── Check pod details ──
kubectl describe pod -l app=python-backend -n python-demo

# ── Check endpoints (which pods are behind the service?) ──
kubectl get endpoints python-backend-svc -n python-demo

# ── Scale up the backend ──
kubectl scale deployment python-backend --replicas=4 -n python-demo
kubectl get pods -n python-demo -w

# ── Test load balancing with 4 pods ──
for i in $(seq 1 10); do
  curl -s http://172.30.1.2:30080/api/hello | python3 -c "import sys,json; print(json.load(sys.stdin)['hostname'])"
done
# You'll see 4 different hostnames!

# ── Scale back down ──
kubectl scale deployment python-backend --replicas=2 -n python-demo

# ── Self-healing demo: delete a pod and watch it get recreated ──
kubectl delete pod $(kubectl get pods -n python-demo -l app=python-backend -o name | head -1) -n python-demo
kubectl get pods -n python-demo -w
```

---

### Step 9: Update & Rollback Demo

```bash
# ── Update the ConfigMap (change app color) ──
kubectl edit configmap python-backend-config -n python-demo
# Change APP_COLOR to "#FF4D6A" and save

# Restart pods to pick up new config:
kubectl rollout restart deployment python-backend -n python-demo

# ── Rollback ──
kubectl rollout undo deployment python-backend -n python-demo
kubectl rollout status deployment python-backend -n python-demo
```

---

### Step 10: Cleanup

```bash
# Delete everything in the namespace (one command!)
kubectl delete namespace python-demo
echo "✅ Project 1 cleaned up!"

# Verify
kubectl get all -n python-demo
# "No resources found in python-demo namespace."
```

---

## Debugging Cheatsheet for This Project

| Problem | Command | What to look for |
|---------|---------|-----------------|
| Pod not starting | `kubectl describe pod <name> -n python-demo` | Events section at bottom |
| App crashing | `kubectl logs <pod> -n python-demo` | Python traceback |
| Service not connecting | `kubectl get endpoints python-backend-svc -n python-demo` | Empty = no pods matched |
| Can't reach frontend | `kubectl get svc -n python-demo` | Is NodePort assigned? |
| Image not found | `crictl images \| grep python` | Is image imported? |
| DNS not resolving | `kubectl exec -it <pod> -n python-demo -- nslookup python-backend-svc` | Should return ClusterIP |

---

# 13 — Project 2: React + Spring Boot on Kubernetes

> **Stack**: React (Vite) frontend + Java Spring Boot backend  
> **Environment**: KillerCoda single-node cluster  
> **Ports**: Backend 8080 (ClusterIP) → Frontend 80 (NodePort 30090)  
> **Namespace**: `java-react-demo`

---

## Architecture

```
┌──────────────────────── KillerCoda Cluster ───────────────────────────┐
│                                                                       │
│  Browser  ──►  http://172.30.1.2:30090                               │
│                    │                                                  │
│                    ▼                                                  │
│  ┌──────── NodePort Service (30090) ──────────────────────────┐     │
│  │  React Frontend Pod (Nginx)                                 │     │
│  │    /          → serve React build (index.html, JS bundle)  │     │
│  │    /api/*     → proxy to springboot-backend-svc:8080       │     │
│  └────────────────────────┬────────────────────────────────────┘     │
│                            │                                          │
│                            ▼  K8s DNS                                │
│  ┌──────── ClusterIP Service (8080) ──────────────────────────┐     │
│  │  ┌──────────────────┐    ┌──────────────────┐              │     │
│  │  │ Spring Boot #1   │    │ Spring Boot #2   │              │     │
│  │  │ /api/hello       │    │ /api/hello       │              │     │
│  │  │ /api/health      │    │ /api/health      │              │     │
│  │  │ /actuator/health │    │ /actuator/health │              │     │
│  │  └──────────────────┘    └──────────────────┘              │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  Namespace: java-react-demo                                          │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Project Directory

```bash
mkdir -p ~/project-2-java-react/backend/src/main/java/com/demo/app
mkdir -p ~/project-2-java-react/backend/src/main/resources
mkdir -p ~/project-2-java-react/frontend/src
mkdir -p ~/project-2-java-react/k8s
cd ~/project-2-java-react
```

---

## Step 2: Create the Spring Boot Backend

```bash
# ── pom.xml ──
cat << 'EOF' > backend/pom.xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.4.5</version>
        <relativePath/>
    </parent>
    <groupId>com.demo</groupId>
    <artifactId>k8s-springboot-demo</artifactId>
    <version>1.0.0</version>
    <properties>
        <java.version>21</java.version>
    </properties>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
    </dependencies>
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
EOF
```

```bash
# ── DemoApplication.java ──
cat << 'EOF' > backend/src/main/java/com/demo/app/DemoApplication.java
package com.demo.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
EOF
```

```bash
# ── ApiController.java ──
cat << 'EOF' > backend/src/main/java/com/demo/app/ApiController.java
package com.demo.app;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import java.net.InetAddress;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ApiController {

    @Value("${app.name:springboot-backend}")
    private String appName;

    @Value("${app.version:1.0.0}")
    private String appVersion;

    @Value("${app.color:#FF6B35}")
    private String appColor;

    @GetMapping("/hello")
    public Map<String, Object> hello() {
        return Map.of(
            "message", "Hello from " + appName + "!",
            "hostname", getHostname(),
            "version", appVersion,
            "color", appColor,
            "timestamp", Instant.now().toString()
        );
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "healthy", "hostname", getHostname());
    }

    @GetMapping("/info")
    public Map<String, String> info() {
        return Map.of(
            "app_name", appName,
            "app_version", appVersion,
            "hostname", getHostname(),
            "platform", "Java / Spring Boot",
            "node_name", env("NODE_NAME"),
            "pod_ip", env("POD_IP"),
            "namespace", env("POD_NAMESPACE")
        );
    }

    private String getHostname() {
        try { return InetAddress.getLocalHost().getHostName(); }
        catch (Exception e) { return "unknown"; }
    }

    private String env(String key) {
        String v = System.getenv(key);
        return v != null ? v : "unknown";
    }
}
EOF
```

```bash
# ── application.properties ──
cat << 'EOF' > backend/src/main/resources/application.properties
server.port=8080
app.name=${APP_NAME:springboot-backend}
app.version=${APP_VERSION:1.0.0}
app.color=${APP_COLOR:#FF6B35}
management.endpoints.web.exposure.include=health,info
management.endpoint.health.probes.enabled=true
EOF
```

> 🔍 **Multi-stage Docker build**: We don't need Java/Maven on the host.
> The Dockerfile uses Maven to build inside Docker, then copies only the JAR.

```bash
# ── backend/Dockerfile ──
cat << 'EOF' > backend/Dockerfile
# Stage 1: Build with Maven
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests -q

# Stage 2: Run with JRE only
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
EOF
```

---

## Step 3: Create the React Frontend

```bash
# ── package.json ──
cat << 'EOF' > frontend/package.json
{
  "name": "k8s-react-demo",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.4.1",
    "vite": "^6.3.0"
  }
}
EOF
```

```bash
# ── vite.config.js ──
cat << 'EOF' > frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8080' } },
});
EOF
```

```bash
# ── index.html ──
cat << 'EOF' > frontend/index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>K8s React + Spring Boot Demo</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;500;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF
```

```bash
# ── src/main.jsx ──
cat << 'EOF' > frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
EOF
```

```bash
# ── src/App.jsx ──
cat << 'EOF' > frontend/src/App.jsx
import { useState } from 'react';
const API = '/api';
function hostnameColor(h) {
  let v = 0;
  for (const c of h) v = c.charCodeAt(0) + ((v << 5) - v);
  return `hsl(${Math.abs(v) % 360}, 60%, 58%)`;
}
export default function App() {
  const [hello, setHello] = useState(null);
  const [info, setInfo] = useState(null);
  const [health, setHealth] = useState(null);
  const [lbHits, setLbHits] = useState([]);
  const [error, setError] = useState('');
  const call = async (path, setter) => {
    try { setError(''); setter(await (await fetch(`${API}/${path}`)).json()); }
    catch (e) { setError(e.message); }
  };
  const lbDemo = async () => {
    setLbHits([]);
    const r = [];
    for (let i = 0; i < 10; i++) {
      try { r.push(await (await fetch(`${API}/hello`)).json()); }
      catch { r.push({ hostname: 'error' }); }
    }
    setLbHits(r);
  };
  return (
    <>
      <div className="grain" />
      <header>
        <div className="logo">⎈</div>
        <h1>Kubernetes <span className="accent">React</span> + <span className="accent2">Spring Boot</span></h1>
        <p className="sub">Project 2 — Full-Stack Java Demo</p>
      </header>
      <main>
        {error && <div className="toast">{error}</div>}
        <section className="card">
          <h2>🔗 API Response</h2>
          <button onClick={() => call('hello', setHello)}>Call /api/hello</button>
          <pre className="box">{hello ? JSON.stringify(hello, null, 2) : 'Click to call…'}</pre>
        </section>
        <section className="card">
          <h2>🖥️ Pod Info</h2>
          <button onClick={() => call('info', setInfo)}>Fetch /api/info</button>
          <pre className="box">{info ? JSON.stringify(info, null, 2) : 'Pod metadata…'}</pre>
        </section>
        <section className="card">
          <h2>💚 Health</h2>
          <button onClick={() => call('health', setHealth)}>Check /api/health</button>
          <pre className="box">{health ? JSON.stringify(health, null, 2) : 'Status…'}</pre>
        </section>
        <section className="card wide">
          <h2>⚖️ Load Balancing</h2>
          <p className="hint">See requests spread across replicas.</p>
          <button onClick={lbDemo}>Send 10 Requests</button>
          <div className="lb-grid">
            {lbHits.map((h, i) => (
              <div key={i} className="chip"
                style={{ borderColor: hostnameColor(h.hostname), color: hostnameColor(h.hostname), animationDelay: `${i*0.06}s` }}>
                {h.hostname}
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer><p>Built for <strong>K8s Workshop</strong> — KillerCoda</p></footer>
    </>
  );
}
EOF
```

```bash
# ── src/App.css ──
cat << 'EOF' > frontend/src/App.css
:root{--bg:#0f1117;--surface:#171a24;--border:#252a3a;--text:#d6dae8;
  --muted:#6a7192;--accent:#61dafb;--accent2:#ff6b35;--radius:12px;
  --font-body:'DM Sans',sans-serif;--font-mono:'Space Mono',monospace}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--font-body);background:var(--bg);color:var(--text);min-height:100vh;line-height:1.6}
.grain{position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.03;
  background:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
header{text-align:center;padding:3rem 1rem 2rem}
.logo{font-size:3rem;margin-bottom:.4rem;animation:spin 12s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:clamp(1.5rem,3.8vw,2.2rem);font-weight:700}
.accent{color:var(--accent)}.accent2{color:var(--accent2)}
.sub{color:var(--muted);font-size:.92rem;margin-top:.3rem}
main{max-width:960px;margin:0 auto;padding:0 1.5rem 3rem;display:grid;
  grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}
.toast{grid-column:1/-1;background:rgba(255,77,106,.12);border:1px solid #ff4d6a;
  color:#ff4d6a;padding:.6rem 1rem;border-radius:8px;font-size:.85rem;font-family:var(--font-mono)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:1.5rem;transition:border-color .25s,box-shadow .25s}
.card:hover{border-color:var(--accent);box-shadow:0 0 20px rgba(97,218,251,.1)}
.card.wide{grid-column:1/-1}.card h2{font-size:1.05rem;font-weight:600;margin-bottom:1rem}
button{font-family:var(--font-mono);font-size:.8rem;padding:.5rem 1.1rem;
  border:1px solid var(--accent);border-radius:6px;background:transparent;
  color:var(--accent);cursor:pointer;transition:background .2s,color .2s}
button:hover{background:var(--accent);color:#111}
.box{margin-top:1rem;padding:1rem;background:#0b0d14;border:1px solid var(--border);
  border-radius:8px;font-family:var(--font-mono);font-size:.78rem;white-space:pre-wrap;
  word-break:break-all;min-height:56px;color:#00e5a0}
.hint{font-size:.82rem;color:var(--muted);margin-bottom:.8rem}
.lb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.6rem;margin-top:1rem}
.chip{padding:.4rem .65rem;border:1px solid var(--border);border-radius:6px;
  font-family:var(--font-mono);font-size:.72rem;text-align:center;animation:fadeUp .35s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
footer{text-align:center;padding:2rem 1rem;color:var(--muted);font-size:.82rem}
footer strong{color:var(--accent2)}
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
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass         http://springboot-backend-svc:8080;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
EOF
```

```bash
# ── frontend/Dockerfile ──
cat << 'EOF' > frontend/Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
```

---

## Step 4: Build & Import Images

```bash
cd ~/project-2-java-react

# ── Build Spring Boot backend (this takes ~2-3 min for first Maven download) ──
echo "Building Spring Boot backend..."
docker build -t springboot-backend:v1 ./backend/
echo "✅ Backend image built"

# ── Build React frontend ──
echo "Building React frontend..."
docker build -t react-frontend:v1 ./frontend/
echo "✅ Frontend image built"

# ── Import into containerd for K8s ──
docker save springboot-backend:v1 | ctr -n k8s.io images import -
docker save react-frontend:v1    | ctr -n k8s.io images import -
echo "✅ Images imported into k8s.io namespace"

# ── Verify ──
crictl images | grep -E "springboot|react"
```

> ⚠️ **Spring Boot build is slower** than Python because Maven downloads the JDK
> and all dependencies. The multi-stage build keeps the final image small (~200MB JRE vs ~800MB JDK).

---

## Step 5: Create K8s Manifests & Deploy

```bash
# ── Namespace ──
cat << 'EOF' > k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: java-react-demo
EOF

# ── ConfigMap ──
cat << 'EOF' > k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: springboot-backend-config
  namespace: java-react-demo
data:
  APP_NAME: "springboot-backend"
  APP_VERSION: "1.0.0"
  APP_COLOR: "#FF6B35"
EOF

# ── Backend Deployment ──
cat << 'EOF' > k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: springboot-backend
  namespace: java-react-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: springboot-backend
  template:
    metadata:
      labels:
        app: springboot-backend
    spec:
      containers:
        - name: springboot
          image: springboot-backend:v1
          imagePullPolicy: Never
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: springboot-backend-config
          env:
            - name: POD_NAME
              valueFrom: { fieldRef: { fieldPath: metadata.name } }
            - name: POD_IP
              valueFrom: { fieldRef: { fieldPath: status.podIP } }
            - name: POD_NAMESPACE
              valueFrom: { fieldRef: { fieldPath: metadata.namespace } }
            - name: NODE_NAME
              valueFrom: { fieldRef: { fieldPath: spec.nodeName } }
          livenessProbe:
            httpGet: { path: /actuator/health, port: 8080 }
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet: { path: /actuator/health, port: 8080 }
            initialDelaySeconds: 15
            periodSeconds: 5
          resources:
            requests: { cpu: 100m, memory: 256Mi }
            limits:   { cpu: 500m, memory: 512Mi }
EOF

# ── Backend Service (ClusterIP) ──
cat << 'EOF' > k8s/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: springboot-backend-svc
  namespace: java-react-demo
spec:
  type: ClusterIP
  selector:
    app: springboot-backend
  ports:
    - port: 8080
      targetPort: 8080
EOF

# ── Frontend Deployment ──
cat << 'EOF' > k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: react-frontend
  namespace: java-react-demo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: react-frontend
  template:
    metadata:
      labels:
        app: react-frontend
    spec:
      containers:
        - name: nginx
          image: react-frontend:v1
          imagePullPolicy: Never
          ports:
            - containerPort: 80
          livenessProbe:
            httpGet: { path: /, port: 80 }
            initialDelaySeconds: 3
            periodSeconds: 10
          resources:
            requests: { cpu: 30m, memory: 32Mi }
            limits:   { cpu: 100m, memory: 64Mi }
EOF

# ── Frontend Service (NodePort) ──
cat << 'EOF' > k8s/frontend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: react-frontend-svc
  namespace: java-react-demo
spec:
  type: NodePort
  selector:
    app: react-frontend
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30090
EOF
```

```bash
# ── Deploy everything ──
kubectl apply -f k8s/
echo "✅ All resources applied!"
```

> 🔍 **Note**: Spring Boot pods take **15-30 seconds** to become ready (JVM startup).
> Watch with `kubectl get pods -n java-react-demo -w` until all show `1/1 Running`.

---

## Step 6: Verify & Test

```bash
# ── Watch pods start ──
kubectl get pods -n java-react-demo -w

# ── Check all resources ──
kubectl get all -n java-react-demo

# ── Test backend directly ──
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never \
  -n java-react-demo -- curl -s http://springboot-backend-svc:8080/api/hello

# ── Test via NodePort ──
curl -s http://172.30.1.2:30090/api/hello | python3 -m json.tool

# ── Test the React frontend ──
curl -s http://172.30.1.2:30090/ | head -5

# ── Load balancing test ──
for i in $(seq 1 10); do
  curl -s http://172.30.1.2:30090/api/hello | python3 -c "import sys,json; print(json.load(sys.stdin)['hostname'])"
done
```

---

## Step 7: Experiment

```bash
# ── Scale backend ──
kubectl scale deployment springboot-backend --replicas=4 -n java-react-demo

# ── Check Spring Boot Actuator ──
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never \
  -n java-react-demo -- curl -s http://springboot-backend-svc:8080/actuator/health

# ── View logs ──
kubectl logs -f deployment/springboot-backend -n java-react-demo

# ── Self-healing ──
kubectl delete pod $(kubectl get pods -n java-react-demo -l app=springboot-backend -o name | head -1) -n java-react-demo
kubectl get pods -n java-react-demo -w
```

---

## Step 8: Cleanup

```bash
kubectl delete namespace java-react-demo
echo "✅ Project 2 cleaned up!"
```

---

## Key Differences: Project 1 vs Project 2

```
┌──────────────────────────────────────────────────────────────────┐
│  Aspect          │ Project 1 (Python)    │ Project 2 (Java)     │
│  ────────────────┼───────────────────────┼───────────────────── │
│  Backend         │ Flask (50 lines)      │ Spring Boot (pom.xml)│
│  Frontend        │ Static HTML/CSS/JS    │ React (Vite build)   │
│  Dockerfile      │ Single-stage          │ Multi-stage          │
│  Build time      │ ~10 seconds           │ ~2-3 minutes         │
│  Image size      │ ~150MB                │ ~200MB (JRE)         │
│  Startup time    │ ~1 second             │ ~15-30 seconds       │
│  Health probe    │ /api/health           │ /actuator/health     │
│  Initial delay   │ 5s liveness           │ 30s liveness (JVM)   │
│  Memory request  │ 64Mi                  │ 256Mi (JVM heap)     │
│  NodePort        │ 30080                 │ 30090                │
└──────────────────────────────────────────────────────────────────┘
```

> 🔍 **Teaching moment**: Java apps need higher `initialDelaySeconds` and more
> memory because of JVM startup overhead. Python apps start almost instantly.
> This is why resource limits and probe timings must match your technology stack.

---

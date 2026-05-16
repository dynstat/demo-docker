# Project 1: Python Backend on Kubernetes

> **Stack**: FastAPI backend + PostgreSQL + Nginx frontend  
> **Environment**: Killercoda 2-node cluster (controlplane + node01)  
> **Namespace**: `python-demo`

---

## Quick Reference

| Resource | Name | Namespace |
|----------|------|-----------|
| Namespace | python-demo | - |
| ConfigMap | python-backend-config | python-demo |
| Secret | postgres-db-secret | python-demo |
| PVC | postgres-pvc | python-demo |
| DB Deployment | postgres-db | python-demo |
| DB Service | postgres-svc | python-demo (ClusterIP :5432) |
| Backend Deployment | python-backend | python-demo |
| Backend Service | python-backend-svc | python-demo (ClusterIP :8000) |
| Frontend Deployment | python-frontend | python-demo |
| Frontend Service | python-frontend-svc | python-demo (NodePort :30080) |

---

## Architecture Flow

```text
+----------------------------------------------------------------------------------------+
|                               USER LAPTOP / BROWSER                                    |
|                                                                                        |
|                        Browser opens: http://172.30.1.2:30080                          |
|                                                                                        |
|        NOTE: Browser DOES NOT know Kubernetes DNS names like python-backend-svc        |
+--------------------------------------------+-------------------------------------------+
                                             |
                                             |  1. External HTTP Request
                                             v

+----------------------------------------------------------------------------------------+
|                     KUBERNETES CLUSTER  (Namespace: python-demo)                       |
|                                                                                        |
|  +-----------------------------------------------------------------------------------+ |
|  |                   controlplane Node  -  IP: 172.30.1.2                            | |
|  |                                                                                   | |
|  |   Components: API Server | Scheduler | Controller Manager | kube-proxy            | |
|  |                                                                                   | |
|  |   kube-proxy iptables rule:                                                       | |
|  |     IF  dst == 172.30.1.2:30080  -->  forward to frontend service/pod             | |
|  |                                                                                   | |
|  |                    +--------------------------------+                             | |
|  |                    |      NodePort Service          |                             | |
|  |                    |  python-frontend-svc : 30080   |                             | |
|  |                    +---------------+----------------+                             | |
|  +------------------------------------|----------------------------------------------+ |
|                                       |  2. kube-proxy DNAT rewrites destination       |
|                                       v                                                |
|  +-----------------------------------------------------------------------------------+ |
|  |                       node01 Node  -  IP: 172.30.2.2                              | |
|  |                                                                                   | |
|  |  +-----------------------------------------------------------------------------+  | |
|  |  |   Frontend nginx Pod  -  IP: 192.168.1.198  -  Port: 80                     |  | |
|  |  |                                                                             |  | |
|  |  |   nginx serves:  index.html  |  CSS  |  JavaScript                          |  | |
|  |  +--------------------------------------+--------------------------------------+  | |
|  |                                         |  3. Browser receives HTML / JS          | |
|  |                                         v                                         | |
|  |   Browser executes:  fetch("/api/hello")                                          | |
|  |                                                                                   | |
|  |   IMPORTANT: Browser calls SAME HOST --> http://172.30.1.2:30080/api/hello        | |
|  |              (NOT http://python-backend-svc:8000)                                 | |
|  +------------------------------------|---------------------------------------------+  |
|                                       |  4. Request enters cluster AGAIN               |
|                                       v                                                |
|  +----------------------------------------------------------------------------------+  |
|  |                         Frontend nginx  (Reverse Proxy)                           | |
|  |                                                                                   | |
|  |   nginx.conf:                                                                     | |
|  |     location /api {                                                               | |
|  |         proxy_pass http://python-backend-svc:8000;                                | |
|  |     }                                                                             | |
|  |                                                                                   | |
|  |   nginx CAN resolve Kubernetes DNS -- it runs INSIDE the cluster                  | |
|  +------------------------------------|--------------------------------------------+   |
|                                       |  5. CoreDNS resolves service name              |
|                                       v                                                |
|          +----------------------------------------------------------+                  |
|          |  python-backend-svc  -  ClusterIP 10.97.9.236:8000       |                  |
|          +-----------------------------+----------------------------+                  |
|                                        |  kube-proxy load balances                     |
|                          +-------------+-------------+                                 |
|                          v                           v                                 |
|        +-----------------------------+   +-----------------------------+               |
|        |       Backend Pod 1         |   |       Backend Pod 2         |               |
|        |   IP: 192.168.1.64          |   |   IP: 192.168.1.87          |               |
|        |       Port: 8000            |   |       Port: 8000            |               |
|        +--------------+--------------+   +--------------+--------------+               |
|                       |                                 |                              |
|                       +-----------------+---------------+                              |
|                                         |  6. Backend accesses DB service              |
|                                         v                                              |
|          +----------------------------------------------------------+                  |
|          |  postgres-svc  -  ClusterIP 10.101.6.160:5432            |                  |
|          +-----------------------------+----------------------------+                  |
|                                        |                                               |
|                                        v                                               |
|                   +-------------------------------------+                              |
|                   |          postgres-db Pod            |                              |
|                   |       IP: 192.168.1.165             |                              |
|                   |           Port: 5432                |                              |
|                   +------------------+------------------+                              |
|                                      |                                                 |
|                                      v                                                 |
|                   +-------------------------------------+                              |
|                   |           postgres-pvc              |                              |
|                   |      Persistent Volume Claim        |                              |
|                   |       stores DB data safely         |                              |
|                   +-------------------------------------+                              |
|                                                                                        |
+--------------------------------------------------------------------------------------+
```

---

## Step 1: Build Docker Images (on controlplane)

```bash
cd /root/demo-docker/k8s-projects/project-1-python

# Build backend
docker build -t python-backend:v1 ./backend

# Build frontend
docker build -t python-frontend:v1 ./frontend

# Verify
docker images | grep python
```

---

## Step 2: Copy Images to Worker Node (multi-node setup)

**Images must exist on all nodes where pods may schedule.**

```bash
# Save images on controlplane
docker save python-backend:v1 python-frontend:v1 -o /tmp/images.tar

# Copy to node01
scp /tmp/images.tar node01:/tmp/

# On node01 - import to containerd (Kubernetes runtime)
ssh node01
ctr -n k8s.io images import /tmp/images.tar
ctr -n k8s.io images ls | grep python
exit
```

> **Why this step?** Docker and Kubernetes (containerd) have separate image stores. Images must be in containerd's `k8s.io` namespace to be accessible by Kubernetes.

---

## Step 3: Create Namespace & Infrastructure

We need a Namespace for isolation, a Secret for DB passwords, a PVC for DB storage, and a ConfigMap.

### 3.1 Namespace
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: python-demo
  labels:
    project: python-demo
```

### 3.2 Secret (Postgres Credentials)
```yaml
# k8s/db-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-db-secret
  namespace: python-demo
type: Opaque
data:
  # Values are base64 encoded: 'user' and 'password123'
  POSTGRES_USER: dXNlcg==
  POSTGRES_PASSWORD: cGFzc3dvcmQxMjM=
```

### 3.3 PersistentVolumeClaim (DB Storage)
```yaml
# k8s/postgres-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: python-demo
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

### 3.4 ConfigMap (App Settings)
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: python-backend-config
  namespace: python-demo
data:
  APP_NAME: "python-backend"
  APP_VERSION: "1.0.0"
  APP_COLOR: "#6C63FF"
```

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/db-secret.yaml
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/configmap.yaml
```

---

## Step 4: Deploy Database

### 4.1 PostgreSQL Deployment
```yaml
# k8s/postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-db
  namespace: python-demo
spec:
  selector:
    matchLabels:
      app: postgres-db
  template:
    metadata:
      labels:
        app: postgres-db
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_DB
              value: "demodb"
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-db-secret
                  key: POSTGRES_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-db-secret
                  key: POSTGRES_PASSWORD
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: postgres-storage
          persistentVolumeClaim:
            claimName: postgres-pvc
```

### 4.2 PostgreSQL Service (ClusterIP)
```yaml
# k8s/postgres-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-svc
  namespace: python-demo
spec:
  selector:
    app: postgres-db
  ports:
    - port: 5432
      targetPort: 5432
  type: ClusterIP
```

```bash
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml

# Wait for DB to be running
kubectl get pods -n python-demo -w
```

---

## Step 5: Deploy Backend

### 5.1 Backend Deployment
```yaml
# k8s/backend-deployment.yaml
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
        - name: fastapi
          image: python-backend:v1
          imagePullPolicy: Never
          ports:
            - containerPort: 8000
          envFrom:
            - configMapRef:
                name: python-backend-config
          env:
            - name: DB_HOST
              value: "postgres-svc"
            - name: DB_NAME
              value: "demodb"
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-db-secret
                  key: POSTGRES_USER
            - name: DB_PASS
              valueFrom:
                secretKeyRef:
                  name: postgres-db-secret
                  key: POSTGRES_PASSWORD
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
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 8000
            initialDelaySeconds: 3
            periodSeconds: 5
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
```

### 5.2 Backend Service
```yaml
# k8s/backend-service.yaml
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
    - port: 8000
      targetPort: 8000
      protocol: TCP
```

```bash
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# Check pods
kubectl get pods -n python-demo -o wide
```

---

## Step 6: Deploy Frontend

### 6.1 Frontend Deployment
```yaml
# k8s/frontend-deployment.yaml
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
```

### 6.2 Frontend Service
```yaml
# k8s/frontend-service.yaml
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
      nodePort: 30080 # access via http://<NODE_IP>:30080
      protocol: TCP
```

```bash
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# View all resources
kubectl get all -n python-demo
```

---

## Step 7: Access the Application

```bash
# Get node IPs
kubectl get nodes -o wide

# Test from controlplane
curl http://localhost:30080
```
Open port 30080 in the Killercoda UI to see the frontend. You can now interact with the PostgreSQL database.

---

## Step 8: Scale & Load Balancing

```bash
# Scale to 4 replicas
kubectl scale deployment python-backend --replicas=4 -n python-demo

# Verify pods on different nodes
kubectl get pods -n python-demo -o wide
```

---

## Step 9: Cleanup

```bash
# Delete all resources
kubectl delete -f k8s/

# Or delete entire namespace
kubectl delete namespace python-demo
```

---

## Key Teaching Points

| Concept | Command | Lesson |
|---------|---------|--------|
| Namespace isolation | `-n python-demo` | Resources scoped to namespace |
| ConfigMap injection | `envFrom` in deployment | Externalize config from code |
| Image handling | `ctr -n k8s.io` | Docker ? containerd stores |
| Service discovery | `http://python-backend-svc:8000` | CoreDNS resolves service name |
| Load balancing | Multiple backend replicas | Service distributes traffic |
| NodePort | External access | `node-ip:30080` accessible from outside |

---

## Namespace Flag Summary

| Command | Without `-n` | With `-n python-demo` |
|---------|--------------|----------------------|
| `kubectl get pods` | Shows default namespace | Shows python-demo |
| `kubectl get configmaps` | Shows default namespace | Shows python-demo |
| `kubectl get services` | Shows default namespace | Shows python-demo |
| `kubectl apply -f file.yaml` | Uses namespace from YAML (if specified) | Uses namespace from YAML |

**Always specify `-n` when working with namespaced resources!**

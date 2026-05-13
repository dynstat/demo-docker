# Project 1: Python Backend on Kubernetes

> **Stack**: FastAPI backend + Nginx frontend  
> **Environment**: Killercoda 2-node cluster (controlplane + node01)  
> **Namespace**: `python-demo`

---

## Quick Reference

| Resource | Name | Namespace |
|----------|------|-----------|
| Namespace | python-demo | — |
| ConfigMap | python-backend-config | python-demo |
| Backend Deployment | python-backend | python-demo |
| Backend Service | python-backend-svc | python-demo (ClusterIP :8000) |
| Frontend Deployment | python-frontend | python-demo |
| Frontend Service | python-frontend-svc | python-demo (NodePort :30080) |

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

## Step 3: Create Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: python-demo
  labels:
    project: python-demo
```

```bash
kubectl apply -f k8s/namespace.yaml
kubectl get namespace python-demo
```

**Without `-n` flag** — queries default namespace:
```bash
kubectl get namespace  # Shows all namespaces
```

**With `-n` flag** — queries specific namespace:
```bash
kubectl get namespace python-demo
```

---

## Step 4: Create ConfigMap

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
kubectl apply -f k8s/configmap.yaml
```

**View ConfigMap:**
```bash
# Wrong - queries default namespace (empty result):
kubectl get configmaps

# Correct - specify namespace:
kubectl get configmaps -n python-demo
kubectl describe configmap python-backend-config -n python-demo
```

**Output:**
```
Name:         python-backend-config
Namespace:    python-demo
Data          ====
APP_COLOR:    #6C63FF
APP_NAME:     python-backend
APP_VERSION:  1.0.0
```

> **What is ConfigMap?** Stores configuration data (key-value pairs) injected into pods as environment variables via `envFrom`.

---

## Step 5: Deploy Backend

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

```bash
kubectl apply -f k8s/backend-deployment.yaml

# Check pods (requires -n flag!)
kubectl get pods -n python-demo -o wide

# Watch status
kubectl get pods -n python-demo --watch
```

**View logs:**
```bash
kubectl logs -l app=python-backend -n python-demo
```

**If `ErrImageNeverPull`:** Images not imported to containerd on node. Go back to Step 2.

---

## Step 6: Create Backend Service (ClusterIP)

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
kubectl apply -f k8s/backend-service.yaml
kubectl get svc -n python-demo
```

**Service port format: `port:targetPort`**
- `port: 8000` — internal service port
- `targetPort: 8000` — container port

**Test internal DNS:**
```bash
kubectl run test --image=busybox --rm -it --restart=Never -n python-demo -- \
  wget -qO- http://python-backend-svc:8000/api/hello
```

> **Teaching point:** `python-backend-svc` resolves via CoreDNS to ClusterIP, which load-balances across all backend pods.

---

## Step 7: Deploy Frontend

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
      nodePort: 30080
      protocol: TCP
```

```bash
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# View all resources in namespace
kubectl get all -n python-demo
```

**Service port format: `port:nodePort`**
- `80:30080` means: Service port 80 → External NodePort 30080

> **Access on:** `http://<node-ip>:30080` (works from any node)

---

## Step 8: Access the Application

```bash
# Get node IPs
kubectl get nodes -o wide

# Test from controlplane
curl http://localhost:30080
curl http://localhost:30080/api/hello
```

---

## Step 9: Scale & Load Balancing

```bash
# Scale to 4 replicas
kubectl scale deployment python-backend --replicas=4 -n python-demo

# Verify pods on different nodes
kubectl get pods -n python-demo -o wide

# Test load balancing - hit API multiple times
for i in {1..8}; do
  kubectl run test$i --image=busybox --rm -it --restart=Never -n python-demo -- \
  wget -qO- http://python-backend-svc:8000/api/hello | grep -o '"hostname":"[^"]*"'
done
```

Notice different hostnames — K8s Service load-balances across all pods.

**Scale down:**
```bash
kubectl scale deployment python-backend --replicas=2 -n python-demo
```

---

## Step 10: Observability Commands

```bash
# All resources in namespace
kubectl get all -n python-demo

# Endpoints (pods behind service)
kubectl get endpoints -n python-demo

# Describe resources
kubectl describe deployment python-backend -n python-demo
kubectl describe svc python-backend-svc -n python-demo

# View pod environment variables
kubectl exec -it <pod-name> -n python-demo -- env | grep -E "APP_|POD_|NODE_"
```

---

## Step 11: Cleanup

```bash
# Delete all resources (one command)
kubectl delete -f k8s/

# Verify
kubectl get all -n python-demo  # Should show: No resources found

# Or delete entire namespace
kubectl delete namespace python-demo
```

---

## Key Teaching Points

| Concept | Command | Lesson |
|---------|---------|--------|
| Namespace isolation | `-n python-demo` | Resources scoped to namespace |
| ConfigMap injection | `envFrom` in deployment | Externalize config from code |
| Image handling | `ctr -n k8s.io` | Docker ≠ containerd stores |
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
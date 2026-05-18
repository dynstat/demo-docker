# 14 — Kubernetes Masterclass: From Containers to Orchestration

> **Environment**: KillerCoda Kubernetes Playground (2-node cluster)

---

## Part 1: The Shift in Mindset

### 1.1 Why Kubernetes?
In Docker, we manage **containers**. In Kubernetes, we manage **applications**.
*   **Docker**: "Run this container on this machine."
*   **Kubernetes**: "Ensure this application is always running with 3 replicas, I don't care which machines you use."

### 1.2 Architecture: The "Smart City" Model
*   **Control Plane (The Brain)**:
    *   **API Server**: The First Door for kubernetes cluster. Every command (`kubectl`) goes here first.
    *   **etcd**: The Source of Truth. The database that remembers everything.
    *   **Scheduler**: The Matchmaker. Decides which node has enough space for a Pod.
    *   **Controller Manager**: The Quality Control. If a pod dies, it notices and orders a replacement.
*   **Worker Nodes (The Muscles)**:
    *   **Kubelet**: The Foreman. Receives orders from the Brain and runs containers.
    *   **Kube-proxy**: The Traffic Cop. Manages networking rules so pods can talk.
    *   **Container Runtime (containerd)**: The Engine. Actually runs the processes.

---

## Part 2: Hands-on Fundamentals (Imperative vs. Declarative)

### 2.1 The Pod (The Unit of Deployment)
A Pod is a wrapper around one or more containers.

**Step 1: Create a pod imperatively (The Quick Way)**
```bash
# Run a single pod
kubectl run my-web-pod --image=nginx:alpine

# List pods and see the IP
kubectl get pods -o wide
```

**Step 2: Generate the YAML (The "Never Memorize" Way)**
Never write YAML from scratch. Use the official "Dry Run" trick:
```bash
# Generate a template for a Pod
kubectl run my-web-pod --image=nginx:alpine --dry-run=client -o yaml > pod.yaml
```

### 2.2 Deployments & Self-Healing
Deployments manage replicas and handle updates.

**Step 1: Create a Deployment**
```bash
kubectl create deployment my-app --image=nginx:alpine --replicas=3
```

**Step 2: Prove Self-Healing**
```bash
# Watch pods in a separate terminal if possible: kubectl get pods -w
# Delete a pod and watch K8s recreate it instantly
kubectl delete pod <name-of-any-pod>
kubectl get pods
```

**Step 3: Scaling & Updating**
```bash
# Scale up to 5
kubectl scale deployment my-app --replicas=5

# Update the version (Rolling Update)
kubectl set image deployment/my-app nginx=nginx:1.27.0
kubectl rollout status deployment/my-app
```

---

## Part 3: Networking (Connecting the Dots)

### 3.1 Services (The Stable Address)
Pods are ephemeral; their IPs change. A **Service** provides a permanent DNS name.

**Step 1: Expose your App**
```bash
# Create a ClusterIP (Internal) Service
kubectl expose deployment my-app --port=80 --target-port=80
```

**Step 2: Proof of Internal DNS & Load Balancing**
```bash
# 1. Label the pods so we can see which one answers
for pod in $(kubectl get pods -l app=my-app -o name); do
  kubectl exec $pod -- sh -c "echo 'Hello from $pod' > /usr/share/nginx/html/index.html"
done

# 2. Test internal load balancing from a temporary pod
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- sh -c "for i in 1 2 3 4 5; do curl -s http://my-app; echo ''; done"
```

---

## Part 4: Configuration (ConfigMaps & Secrets)

Keep configuration separate from your code.

### 4.1 ConfigMaps (Non-sensitive)
```bash
# Create config for environment variables
kubectl create configmap app-config --from-literal=APP_COLOR=blue --from-literal=LOG_LEVEL=debug

# View it
kubectl get configmap app-config -o yaml
```

### 4.2 Secrets (Sensitive)
```bash
# Create a secret for passwords
kubectl create secret generic db-creds --from-literal=password=supersecret

# Notice: Secrets are Base64 encoded, not encrypted by default
kubectl get secret db-creds -o yaml
echo "c3VwZXJzZWNyZXQ=" | base64 -d
```

---

## Part 5: Full Project Deployment (Python Stack)

We will now deploy a 2-tier application (FastAPI + Nginx) across our 2-node cluster.

### 5.1 Image Preparation (Killercoda Specific)
Because we have two nodes, the images must exist in the `containerd` store on both.

```bash
cd /root/demo-docker/k8s-projects/project-1-python

# Build images
docker build -t python-backend:v1 ./backend
docker build -t python-frontend:v1 ./frontend

# Transfer to Kubernetes runtime (containerd)
docker save python-backend:v1 python-frontend:v1 -o /tmp/images.tar
ctr -n k8s.io images import /tmp/images.tar

# Sync with the worker node (node01)
scp /tmp/images.tar node01:/tmp/
ssh node01 "ctr -n k8s.io images import /tmp/images.tar"
```

### 5.2 Deploy the Stack
```bash
# 1. Create the environment
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

# 2. Deploy Backend (Internal)
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# 3. Deploy Frontend (Internal)
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# 4. Deploy Ingress (External Entry Point)
# NOTE: Ensure Ingress Controller is installed first:
# kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

kubectl apply -f k8s/ingress.yaml
```

### 5.3 Verify & Access
```bash
# Check all resources in the namespace
kubectl get all -n python-demo
kubectl get ingress -n python-demo

# Access via Ingress (Direct IP access)
curl http://localhost
```

---

## Part 6: Production Debugging Checklist

If something goes wrong, follow this flow:

1.  **`kubectl get pods`**: Are they `Running`?
2.  **`kubectl describe pod <name>`**: Check the `Events` section at the bottom for ImagePullErrors or Scheduling issues.
3.  **`kubectl logs <name>`**: See the actual application crash or error.
4.  **`kubectl get endpoints <svc-name>`**: Is the Service actually pointing to healthy Pod IPs?

### Pro-Tip: Documentation
*   Use `kubectl explain pod.spec` to see field definitions in your terminal.
*   Official Reference: [kubernetes.io/docs](https://kubernetes.io/docs/home/)

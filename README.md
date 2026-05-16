# Docker & Kubernetes Training Documentation

## Overview

Comprehensive training guide covering containerization and orchestration from absolute fundamentals to production deployment. Designed for beginners with hands-on demos, ASCII diagrams, and real-world examples.

---

## Repository Structure

```text
.
├── docker-compose-demo/      # Multi-container app with Docker Compose
│   ├── backend/              # Python Flask API
│   └── frontend/             # Nginx + Static HTML
└── k8s-projects/
    └── project-1-python/     # Full-stack Python app for K8s
        ├── backend/          # Python API
        ├── frontend/         # JS Frontend
        └── k8s/              # Kubernetes Manifests (Deployments, Services, etc.)
├── 00-overview-big-picture.md
├── 01-linux-fundamentals.md
├── 01a-virtualization-vs-containers.md
├── 01b-linux-namespaces-and-cgroups.md
├── 02-docker-fundamentals.md
├── 02a-oci-and-container-runtimes.md
├── 03-dockerfiles.md
├── 04-volumes.md
├── 04b-docker-networking.md
├── 05-docker-compose.md
├── 06-embedded.md
├── 07-kubernetes.md
├── 07b-kubernetes-components.md
├── 07c-kubernetes-objects.md
├── 07d-kubernetes-networking.md
├── 07e-kubernetes-rbac.md
├── 07f-kubernetes-storage.md
├── 07g-onpremise-vs-cloud.md
├── 08-kubernetes-production.md
├── 09-sample-files.md
├── 10-quick-reference.md
├── 11-k8s-workshop.md        # Hands-on Workshop
├── 12-project1-python-guide.md
├── 13-project2-java-react-guide.md
├── 14-k8s-demo-cmd.md        # Live Demo Scripts
├── architecture-deep-dive.md
└── k8s-s.md                  # K8s Quick Summary
```

---

## Prerequisites

- Basic command line knowledge (Linux/Mac/Windows)
- Text editor (VS Code recommended)
- Docker Desktop installed
- Enthusiasm to learn!

---

## Table of Contents

### Foundation: The Big Picture

| Part    | Topic                                                                 | Description                                                 |
| ------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| **00**  | [Big Picture Overview](./00-overview-big-picture.md)                  | Complete architecture: Frontend+Backend+DB+Docker+K8s+CI/CD |
| **01a** | [Virtualization vs Containers](./01a-virtualization-vs-containers.md) | Evolution story, VMs vs Containers, Linux concepts          |
| **01b** | [Namespaces & Cgroups](./01b-linux-namespaces-and-cgroups.md)         | The magic behind container isolation                        |
| **02a** | [OCI & Container Runtimes](./02a-oci-and-container-runtimes.md)       | Standards, containerd, why K8s dropped Docker               |
| **-**   | [Architecture Deep Dive](./architecture-deep-dive.md)                 | Deep technical dive into modern infrastructure             |

### Docker Fundamentals

| Part    | Topic                                              | Description                                  |
| ------- | -------------------------------------------------- | -------------------------------------------- |
| **01**  | [Linux Fundamentals](./01-linux-fundamentals.md)   | Namespaces, cgroups, essential commands      |
| **02**  | [Docker Fundamentals](./02-docker-fundamentals.md) | Architecture, images, containers, registries |
| **03**  | [Dockerfiles](./03-dockerfiles.md)                 | Writing Dockerfiles, multi-stage builds      |
| **04**  | [Volumes](./04-volumes.md)                         | Data persistence, bind mounts, volumes       |
| **04b** | [Docker Networking](./04b-docker-networking.md)    | Bridge, host, overlay networks, port mapping |
| **05**  | [Docker Compose](./05-docker-compose.md)           | Multi-container applications                 |
| **-**   | [Compose Demo](./docker-compose-demo/README.md)    | Practical Docker Compose project             |

### Kubernetes Fundamentals

| Part    | Topic                                              | Description                                       |
| ------- | -------------------------------------------------- | ------------------------------------------------- |
| **07**  | [Kubernetes Basics](./07-kubernetes.md)            | Architecture, pods, deployments, services         |
| **07b** | [K8s Components](./07b-kubernetes-components.md)   | API Server, Scheduler, etcd, kubelet, kube-proxy  |
| **07c** | [K8s Objects](./07c-kubernetes-objects.md)         | Pods, Deployments, StatefulSets, Jobs, DaemonSets |
| **07d** | [K8s Networking](./07d-kubernetes-networking.md)   | Services, DNS, Endpoints, Network Policies, CNI   |
| **07e** | [K8s RBAC](./07e-kubernetes-rbac.md)               | ServiceAccounts, Roles, RoleBindings, security    |
| **07f** | [K8s Storage & Scale](./07f-kubernetes-storage.md) | PVs, PVCs, StorageClasses, HPA, VPA               |
| **07g** | [Cloud vs On-Premise](./07g-onpremise-vs-cloud.md) | EKS/GKE vs kubeadm, considerations                |
| **11**  | [K8s Hands-On Workshop](./11-k8s-workshop.md)      | Complete workshop guide for KillerCoda            |
| **-**   | [K8s Quick Summary](./k8s-s.md)                    | Condensed reference for K8s concepts              |

### Projects & Production

| Part   | Topic                                              | Description                                  |
| ------ | -------------------------------------------------- | -------------------------------------------- |
| **08** | [K8s Production](./08-kubernetes-production.md)    | Secrets, ConfigMaps, Ingress, best practices |
| **12** | [Project 1: Python Guide](./12-project1-python-guide.md) | Full-stack Python deployment guide           |
| **13** | [Project 2: Java/React](./13-project2-java-react-guide.md) | Java backend + React frontend guide          |
| **06** | [Embedded Systems](./06-embedded.md)               | FPGA, RPi, Smart Cards, TPM (specialized)    |
| **09** | [Sample Files](./09-sample-files.md)               | Complete working examples                    |
| **10** | [Quick Reference](./10-quick-reference.md)         | Command cheat sheet                          |

### Live Demos

- [Live Demo Scripts](./14-k8s-demo-cmd.md) - Step-by-step demonstration guides

---

## Recommended Learning Path

### Module 1: Understanding the Big Picture

**Goal**: Understand what Docker and Kubernetes solve and why they exist.

1. [Big Picture Overview](./00-overview-big-picture.md)
   - See the complete modern application stack
   - Understand where Docker, Kubernetes, and CI/CD fit
   - Grasp the benefits of the entire ecosystem

2. [Virtualization vs Containers](./01a-virtualization-vs-containers.md)
   - Learn the evolution: Physical → VMs → Containers
   - Understand VMs vs Containers deeply
   - See Linux concepts (namespaces, cgroups) in action
   - Practical demos proving isolation

3. [Namespaces & Cgroups](./01b-linux-namespaces-and-cgroups.md)
   - Deep dive into the kernel features that enable containers
   - Hands-on look at how isolation is achieved

4. [OCI & Container Runtimes](./02a-oci-and-container-runtimes.md)
   - Understand container standards
   - Learn about containerd and the runtime stack
   - Understand why Kubernetes dropped Docker (but images still work!)

5. [Architecture Deep Dive](./architecture-deep-dive.md)
   - Advanced look at the architectural patterns

**Time**: 4-5 hours  
**Outcome**: Solid mental model of containerization ecosystem

---

### Module 2: Docker Hands-On

**Goal**: Build, run, and manage Docker containers confidently.

6. [Linux Fundamentals](./01-linux-fundamentals.md)
   - Essential Linux commands
   - Understand filesystem, processes, networking

7. [Docker Fundamentals](./02-docker-fundamentals.md)
   - Images vs containers
   - Docker commands (run, pull, push, exec)
   - Container lifecycle

8. [Dockerfiles](./03-dockerfiles.md)
   - Write Dockerfiles from scratch
   - Layer optimization
   - Multi-stage builds

9. [Volumes](./04-volumes.md) & [Networking](./04b-docker-networking.md)
   - Persist data beyond container lifecycle
   - Connect containers together
   - Expose services to the host

10. [Docker Compose](./05-docker-compose.md)
    - Define multi-container applications
    - One command to start entire stack
    - [Hands-on Compose Demo](./docker-compose-demo/README.md)

**Time**: 6-8 hours  
**Outcome**: Can containerize any application

---

### Module 3: Kubernetes Fundamentals

**Goal**: Deploy and manage containerized applications in production.

11. [Kubernetes Basics](./07-kubernetes.md)
    - Architecture and core concepts
    - Pods, Deployments, Services
    - Basic kubectl commands

12. [K8s Components](./07b-kubernetes-components.md)
    - Control plane deep dive
    - Worker node components
    - How Kubernetes works internally

13. [K8s Objects](./07c-kubernetes-objects.md)
    - All workload types
    - When to use what
    - StatefulSets for databases

14. [K8s Networking](./07d-kubernetes-networking.md) & [RBAC](./07e-kubernetes-rbac.md)
    - How pods communicate
    - Load balancing and DNS
    - Secure your cluster

15. [K8s Storage & Scaling](./07f-kubernetes-storage.md)
    - Persistent storage in K8s
    - Auto-scaling applications
    - Resource management

16. [K8s Hands-On Workshop](./11-k8s-workshop.md)
    - Comprehensive practical exercises on KillerCoda

**Time**: 10-12 hours  
**Outcome**: Can deploy production-grade applications

---

### Module 4: Projects & Production

**Goal**: Run real-world applications and projects.

17. [K8s Production Patterns](./08-kubernetes-production.md)
    - Secrets management
    - Ingress for routing
    - Health checks and lifecycle

18. [Cloud vs On-Premise](./07g-onpremise-vs-cloud.md)
    - Deployment options
    - Trade-offs and considerations
    - Setting up your own cluster

19. [Project 1: Python Deployment](./12-project1-python-guide.md)
    - Full-stack Python app on K8s
    - [Source Code](./k8s-projects/project-1-python/)

20. [Project 2: Java & React](./13-project2-java-react-guide.md)
    - Complex multi-language stack deployment

21. [Sample Files](./09-sample-files.md)
    - Complete real-world examples

**Time**: 6-8 hours  
**Outcome**: Production-ready knowledge with practical project experience

---

### Module 5: Specialized (Optional)

22. [Embedded Systems](./06-embedded.md)
    - Containers on resource-constrained devices
    - FPGA, Raspberry Pi, Smart Cards

---

## Key Concepts

### Docker Is NOT Magic

```
Container = Isolated Linux process using:
├── Namespaces (what can it see?)
├── Cgroups (what can it use?)
└── Union FS (layered filesystem)
```

### OCI Standards Enable Portability

```
Docker Image  = OCI Image
├── Works in Docker
├── Works in Podman
├── Works in Kubernetes (containerd)
└── Works anywhere OCI-compliant
```

### Kubernetes Provides Orchestration

```
You Declare:    "I want 3 web pods"
Kubernetes:     Makes it happen
                ├── Schedules pods
                ├── Monitors health
                ├── Restarts failures
                ├── Load balances traffic
                └── Scales automatically
```

---

## Quick Start Commands

### Docker

```bash
# Build an image
docker build -t myapp:v1 .

# Run a container
docker run -d -p 8080:80 --name web myapp:v1

# Check running containers
docker ps

# View logs
docker logs web

# Stop and remove
docker stop web && docker rm web

# Multi-container app
docker compose up -d
docker compose down
```

### Kubernetes

```bash
# Apply configuration
kubectl apply -f deployment.yaml

# Get resources
kubectl get pods
kubectl get services
kubectl get deployments

# View details
kubectl describe pod <pod-name>
kubectl logs <pod-name>

# Scale application
kubectl scale deployment web --replicas=5

# Update image (rolling update)
kubectl set image deployment/web web=myapp:v2

# Access running pod
kubectl exec -it <pod-name> -- bash
```

---

## Hands-On Practice

### Use Live Demo Scripts

The [Live Demo Scripts](./14-k8s-demo-cmd.md) contains step-by-step demonstrations:
- Building your first Docker image
- Running multi-container apps with Compose
- Deploying to Kubernetes
- Setting up CI/CD pipelines

### Experimentation Environments

- **Local**: Docker Desktop + Kubernetes enabled
- **Cloud Free Tiers**:
  - Play with Docker: https://labs.play-with-docker.com/
  - Play with Kubernetes: https://labs.play-with-k8s.com/
- **Production-like**: minikube, k3s, or kind

---

## Training Duration Estimates

```
Total Time: 30-40 hours minimum

Fast Track (Intense):
├── Module 1: 5 hours
├── Module 2: 8 hours
├── Module 3: 12 hours
└── Module 4: 8 hours
Total: 33 hours (over 7 days, 4-5 hours/day)

Comfortable Pace (Recommended):
├── Module 1: 8 hours (Week 1)
├── Module 2: 12 hours (Week 2-3)
├── Module 3: 15 hours (Week 4-5)
└── Module 4: 10 hours (Week 6-7)
Total: 45 hours (over 7 weeks, 6-7 hours/week)
```

---

## Additional Resources

### Official Documentation

- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [OCI Specifications](https://opencontainers.org/)

### Interactive Learning

- [Docker Tutorial](https://www.docker.com/101-tutorial/)
- [Kubernetes by Example](https://kubernetesbyexample.com/)
- [Katacoda Scenarios](https://www.katacoda.com/)

### Books (Recommended)

- "Docker Deep Dive" by Nigel Poulton
- "Kubernetes Up & Running" by Kelsey Hightower
- "The Kubernetes Book" by Nigel Poulton

### YouTube Channels

- TechWorld with Nana
- That DevOps Guy
- Cloud Native Foundation

---

## Getting Help

- **Questions during training**: Ask your instructor or team lead
-** **Docker Community**: https://forums.docker.com/
- **Kubernetes Slack**: https://slack.k8s.io/
- **Stack Overflow**: Tag questions with `docker` or `kubernetes`

---

## What You'll Achieve

After completing this training, you will be able to:

- ✅ Explain how containers work at a fundamental level
- ✅ Containerize any application with Docker
- ✅ Build optimized, production-ready Docker images
- ✅ Deploy multi-container applications
- ✅ Run applications in Kubernetes clusters
- ✅ Scale applications automatically
- ✅ Implement CI/CD pipelines
- ✅ Troubleshoot container and orchestration issues
- ✅ Make informed decisions about deployment strategies
- ✅ Communicate effectively with DevOps teams

**Let's get started! Open [00-overview-big-picture.md](./00-overview-big-picture.md) to begin your journey.**


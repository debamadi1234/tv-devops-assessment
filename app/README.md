# TurboVets DevOps Assessment — App

![Deploy to AWS](https://github.com/debamadi1234/tv-devops-assessment/actions/workflows/deploy.yml/badge.svg)

A production-ready Express.js + TypeScript application, containerized with Docker and deployed to AWS ECS Fargate via GitHub Actions.

---

## Local Development

### Prerequisites
- Docker Desktop
- Node.js 18+

### Run Locally with Docker Compose
```bash
git clone https://github.com/debamadi1234/tv-devops-assessment.git
cd tv-devops-assessment/app
docker compose up --build
```

The app will be available at:
- http://localhost:3000
- http://localhost:3000/health

### Run Without Docker
```bash
cd app
npm install
npm run dev
```

---

## Docker Setup

### Dockerfile
The Dockerfile uses a **multi-stage build**:

- **Stage 1 (builder):** Installs all dependencies and compiles TypeScript to JavaScript
- **Stage 2 (production):** Copies only the compiled output and production dependencies into a lean `node:18-alpine` image

This keeps the final image small and free of dev tooling.

### .dockerignore
Excludes `node_modules`, `dist`, `.env`, and `.git` to reduce image size and prevent secrets from being baked into the image.

---

## CI/CD Pipeline

The GitHub Actions workflow is located at `.github/workflows/deploy.yml`.

### Trigger
Pushes to the `main` branch automatically trigger the pipeline.

### Pipeline Steps
1. Configure AWS credentials from GitHub Secrets
2. Install CDKTF dependencies and CLI
3. Generate AWS provider bindings (`cdktf get`)
4. Synthesize Terraform JSON (`cdktf synth`)
5. Deploy infrastructure via `terraform apply`
6. Login to Amazon ECR
7. Build Docker image
8. Push image to ECR

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `AWS_ACCOUNT_ID` | Your AWS account ID |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `APP_NAME` | Application name (e.g. `tv-devops`) |

### To Add Secrets
1. Go to your GitHub repo
2. Settings → Secrets and variables → Actions
3. Click **New repository secret**
4. Add each secret from the table above

---

## Health Check

Once deployed, the `/health` endpoint is publicly accessible via the ALB:
```
http://<ALB_DNS_NAME>/health
```

Expected response:
```json
{"status":"ok"}
```
# TurboVets DevOps Assessment — Infrastructure

CDK for Terraform (CDKTF) in TypeScript defining the AWS infrastructure for the TurboVets DevOps assessment.

---

## Architecture

- **ECR** — Container registry for Docker images
- **VPC** — Isolated network with 2 public subnets across 2 availability zones
- **ECS Fargate** — Serverless container runtime
- **Application Load Balancer** — Public-facing HTTP load balancer routing to ECS
- **IAM** — Least-privilege execution role for ECS tasks
- **S3 + DynamoDB** — Remote Terraform state backend with locking

---

## Prerequisites

- Node.js 18+
- Terraform 1.5+
- CDKTF CLI: `npm install -g cdktf-cli`
- AWS CLI configured with sufficient permissions

---

## Configuration

All configuration is driven by environment variables. Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region to deploy into | `us-east-1` |
| `AWS_ACCOUNT_ID` | Your AWS account ID | `123456789012` |
| `APP_NAME` | Name prefix for all resources | `tv-devops` |

---

## Remote Backend Setup

Before deploying, create the S3 bucket and DynamoDB table for Terraform state:
```bash
aws s3 mb s3://tv-devops-tfstate-<YOUR_ACCOUNT_ID> --region us-east-1

aws dynamodb create-table \
  --table-name tv-devops-tfstate-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Then update the bucket name in `stack.ts` to match your account ID.

---

## Deploy

### Install dependencies
```bash
npm install
```

### Generate AWS provider bindings
```bash
cdktf get
```

### Synthesize Terraform JSON
```bash
cdktf synth
```

### Deploy to AWS
```bash
cd cdktf.out/stacks/tv-devops
terraform init
terraform apply -auto-approve
```

### Verify
After deploy, Terraform will output the ALB DNS name:
```
alb_dns_name = "tv-devops-alb-xxxx.us-east-1.elb.amazonaws.com"
```

Test the health endpoint:
```bash
curl http://<alb_dns_name>/health
```

Expected response:
```json
{"status":"ok"}
```

---

## Destroy

To tear down all infrastructure:
```bash
cd cdktf.out/stacks/tv-devops
terraform destroy -auto-approve
```

---

## Variables to Override for Your AWS Account

| What to change | Where | Description |
|----------------|-------|-------------|
| `AWS_ACCOUNT_ID` | `.env` | Your AWS account ID |
| `AWS_REGION` | `.env` | Your preferred region |
| `APP_NAME` | `.env` | Optional — rename all resources |
| S3 bucket name | `stack.ts` line with `S3Backend` | Must match your account ID |

---

## GitHub Actions Secrets Required

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_ACCOUNT_ID` | Your AWS account ID |
| `AWS_REGION` | Deployment region |
| `APP_NAME` | App/resource name prefix |
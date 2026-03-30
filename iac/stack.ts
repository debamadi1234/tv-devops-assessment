import { Construct } from "constructs";
import { TerraformStack, TerraformOutput, S3Backend } from "cdktf";
import { AwsProvider } from "./.gen/providers/aws/provider";
import { EcrRepository } from "./.gen/providers/aws/ecr-repository";
import { EcsCluster } from "./.gen/providers/aws/ecs-cluster";
import { EcsTaskDefinition } from "./.gen/providers/aws/ecs-task-definition";
import { EcsService } from "./.gen/providers/aws/ecs-service";
import { Vpc } from "./.gen/providers/aws/vpc";
import { Subnet } from "./.gen/providers/aws/subnet";
import { InternetGateway } from "./.gen/providers/aws/internet-gateway";
import { RouteTable } from "./.gen/providers/aws/route-table";
import { RouteTableAssociation } from "./.gen/providers/aws/route-table-association";
import { SecurityGroup } from "./.gen/providers/aws/security-group";
import { IamRole } from "./.gen/providers/aws/iam-role";
import { IamRolePolicyAttachment } from "./.gen/providers/aws/iam-role-policy-attachment";
import { Lb } from "./.gen/providers/aws/lb";
import { LbTargetGroup } from "./.gen/providers/aws/lb-target-group";
import { LbListener } from "./.gen/providers/aws/lb-listener";
import { S3Backend } from "cdktf";

interface TurboVetsStackProps {
  region: string;
  accountId: string;
  appName: string;
  containerPort: number;
}

export class TurboVetsStack extends TerraformStack {
  constructor(scope: Construct, id: string, props: TurboVetsStackProps) {
    super(scope, id);

    
    // Remote backend - S3
    new S3Backend(this, {
      bucket: "tv-devops-tfstate-522814733393",
      key: "tv-devops/terraform.tfstate",
      region: "us-east-1",
      dynamodbTable: "tv-devops-tfstate-lock",
      encrypt: true,
});

    const { region, accountId, appName, containerPort } = props;

    // Provider
    new AwsProvider(this, "aws", { region });

    // ECR Repository
    const ecr = new EcrRepository(this, "ecr", {
      name: appName,
      forceDelete: true,
      tags: { Name: appName },
    });

    // VPC
    const vpc = new Vpc(this, "vpc", {
      cidrBlock: "10.0.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: { Name: `${appName}-vpc` },
    });

    // Subnets
    const subnet1 = new Subnet(this, "subnet1", {
      vpcId: vpc.id,
      cidrBlock: "10.0.1.0/24",
      availabilityZone: `${region}a`,
      mapPublicIpOnLaunch: true,
      tags: { Name: `${appName}-subnet-1` },
    });

    const subnet2 = new Subnet(this, "subnet2", {
      vpcId: vpc.id,
      cidrBlock: "10.0.2.0/24",
      availabilityZone: `${region}b`,
      mapPublicIpOnLaunch: true,
      tags: { Name: `${appName}-subnet-2` },
    });

    // Internet Gateway
    const igw = new InternetGateway(this, "igw", {
      vpcId: vpc.id,
      tags: { Name: `${appName}-igw` },
    });

    // Route Table
    const routeTable = new RouteTable(this, "routeTable", {
      vpcId: vpc.id,
      route: [{ cidrBlock: "0.0.0.0/0", gatewayId: igw.id }],
      tags: { Name: `${appName}-rt` },
    });

    new RouteTableAssociation(this, "rta1", {
      subnetId: subnet1.id,
      routeTableId: routeTable.id,
    });

    new RouteTableAssociation(this, "rta2", {
      subnetId: subnet2.id,
      routeTableId: routeTable.id,
    });

    // Security Groups
    const albSg = new SecurityGroup(this, "albSg", {
      vpcId: vpc.id,
      name: `${appName}-alb-sg`,
      ingress: [
        {
          fromPort: 80,
          toPort: 80,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    });

    const ecsSg = new SecurityGroup(this, "ecsSg", {
      vpcId: vpc.id,
      name: `${appName}-ecs-sg`,
      ingress: [
        {
          fromPort: containerPort,
          toPort: containerPort,
          protocol: "tcp",
          securityGroups: [albSg.id],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    });

    // IAM Role for ECS Task Execution
    const executionRole = new IamRole(this, "executionRole", {
      name: `${appName}-execution-role`,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "ecs-tasks.amazonaws.com" },
            Action: "sts:AssumeRole",
          },
        ],
      }),
    });

    new IamRolePolicyAttachment(this, "executionRolePolicy", {
      role: executionRole.name,
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    // ECS Cluster
    const cluster = new EcsCluster(this, "cluster", {
      name: `${appName}-cluster`,
    });

    // ECS Task Definition
    const taskDef = new EcsTaskDefinition(this, "taskDef", {
      family: `${appName}-task`,
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      cpu: "256",
      memory: "512",
      executionRoleArn: executionRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name: appName,
          image: `${accountId}.dkr.ecr.${region}.amazonaws.com/${appName}:latest`,
          portMappings: [
            {
              containerPort,
              protocol: "tcp",
            },
          ],
          essential: true,
        },
      ]),
    });

    // Load Balancer
    const alb = new Lb(this, "alb", {
      name: `${appName}-alb`,
      internal: false,
      loadBalancerType: "application",
      securityGroups: [albSg.id],
      subnets: [subnet1.id, subnet2.id],
    });

    const targetGroup = new LbTargetGroup(this, "targetGroup", {
      name: `${appName}-tg`,
      port: containerPort,
      protocol: "HTTP",
      targetType: "ip",
      vpcId: vpc.id,
      healthCheck: {
        path: "/health",
        interval: 30,
        timeout: 5,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
      },
    });

    new LbListener(this, "listener", {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: "HTTP",
      defaultAction: [
        {
          type: "forward",
          targetGroupArn: targetGroup.arn,
        },
      ],
    });

    // ECS Service
    new EcsService(this, "service", {
      name: `${appName}-service`,
      cluster: cluster.id,
      taskDefinition: taskDef.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: [subnet1.id, subnet2.id],
        securityGroups: [ecsSg.id],
        assignPublicIp: true,
      },
      loadBalancer: [
        {
          targetGroupArn: targetGroup.arn,
          containerName: appName,
          containerPort,
        },
      ],
    });

    // Outputs
    new TerraformOutput(this, "ecr_repository_url", {
      value: ecr.repositoryUrl,
    });

    new TerraformOutput(this, "alb_dns_name", {
      value: alb.dnsName,
      description: "Load balancer URL — use this to hit /health",
    });
  }
}
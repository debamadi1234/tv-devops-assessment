import { App } from "cdktf";
import { TurboVetsStack } from "./stack";

const app = new App();

new TurboVetsStack(app, "tv-devops", {
  region: process.env.AWS_REGION || "us-east-1",
  accountId: process.env.AWS_ACCOUNT_ID || "",
  appName: process.env.APP_NAME || "tv-devops",
  containerPort: 3000,
});

app.synth();
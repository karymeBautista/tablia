#!/usr/bin/env node
import "source-map-support/register.js";
import { App } from "aws-cdk-lib";
import { TabliaStack } from "./tablia-stack";

const app = new App();

new TabliaStack(app, "TabliaStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1"
  },
  description: "Tablia CRUD: Next.js, API Gateway, Lambda y RDS MySQL"
});

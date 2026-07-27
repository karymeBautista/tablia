import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { TabliaStack } from "../src/tablia-stack";

describe("TabliaStack", () => {
  const app = new App();
  const stack = new TabliaStack(app, "TestTabliaStack", {
    env: { account: "111111111111", region: "us-east-1" }
  });
  const template = Template.fromStack(stack);

  it("crea RDS privado y una Lambda Node.js 22", () => {
    template.hasResourceProperties("AWS::RDS::DBInstance", {
      PubliclyAccessible: false,
      MultiAZ: false,
      Engine: "mysql"
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x"
    });
  });

  it("configura los métodos CRUD explícitos en API Gateway", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: method
      });
    }
  });

  it("mantiene privado el bucket del frontend", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: Match.objectLike({
        BlockPublicAcls: true,
        BlockPublicPolicy: true
      })
    });
    expect(template.findResources("AWS::CloudFront::Distribution")).not.toEqual({});
  });
});

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CfnOutput,
  CustomResource,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps
} from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as customResources from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export class TabliaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "private-isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      ]
    });

    const databaseSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc,
      description: "Acceso MySQL solo desde las Lambdas de Tablia"
    });
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, "LambdaSecurityGroup", {
      vpc,
      description: "Funciones Lambda con acceso privado a RDS"
    });
    databaseSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(3306),
      "MySQL desde Lambda"
    );

    const database = new rds.DatabaseInstance(this, "Database", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.of("8.0.43", "8.0")
      }),
      credentials: rds.Credentials.fromGeneratedSecret("tablia_admin"),
      databaseName: "tablia",
      instanceType: new ec2.InstanceType("t4g.micro"),
      allocatedStorage: 20,
      storageType: rds.StorageType.GP2,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [databaseSecurityGroup],
      backupRetention: Duration.days(1),
      deletionProtection: false,
      deleteAutomatedBackups: true,
      removalPolicy: RemovalPolicy.DESTROY
    });

    if (!database.secret) {
      throw new Error("RDS debe generar un secreto de credenciales");
    }

    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_HOST: database.dbInstanceEndpointAddress,
        DB_PORT: database.dbInstanceEndpointPort,
        DB_USER: database.secret.secretValueFromJson("username").unsafeUnwrap(),
        DB_PASSWORD: database.secret.secretValueFromJson("password").unsafeUnwrap(),
        DB_NAME: "tablia",
        DB_POOL_LIMIT: "2"
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: "node22"
      },
    } satisfies Partial<lambdaNode.NodejsFunctionProps>;

    const apiLogGroup = new logs.LogGroup(this, "ApiLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });
    const apiFunction = new lambdaNode.NodejsFunction(this, "ApiFunction", {
      ...commonLambdaProps,
      entry: path.join(rootDirectory, "apps/api/src/lambda.ts"),
      handler: "handler",
      memorySize: 512,
      timeout: Duration.seconds(20),
      reservedConcurrentExecutions: 5,
      tracing: lambda.Tracing.ACTIVE,
      logGroup: apiLogGroup
    });
    const migrationLogGroup = new logs.LogGroup(this, "MigrationLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });
    const migrationFunction = new lambdaNode.NodejsFunction(this, "MigrationFunction", {
      ...commonLambdaProps,
      entry: path.join(rootDirectory, "apps/api/src/migrate.lambda.ts"),
      handler: "handler",
      memorySize: 256,
      timeout: Duration.minutes(2),
      logGroup: migrationLogGroup
    });
    const migrationProvider = new customResources.Provider(this, "MigrationProvider", {
      onEventHandler: migrationFunction,
      logGroup: new logs.LogGroup(this, "MigrationProviderLogGroup", {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY
      })
    });
    const migration = new CustomResource(this, "DatabaseMigration", {
      serviceToken: migrationProvider.serviceToken,
      properties: { SchemaVersion: "1" }
    });
    migration.node.addDependency(database);
    apiFunction.node.addDependency(migration);

    const api = new apigateway.RestApi(this, "RestApi", {
      restApiName: "tablia-api",
      description: "CRUD público de personas",
      deployOptions: {
        stageName: "prod",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type"]
      },
      cloudWatchRole: true
    });

    const integration = new apigateway.LambdaIntegration(apiFunction, {
      proxy: true
    });
    const apiResource = api.root.addResource("api");
    apiResource.addResource("health").addMethod("GET", integration);
    const personas = apiResource.addResource("personas");
    personas.addMethod("GET", integration);
    personas.addMethod("POST", integration);
    const persona = personas.addResource("{id}");
    for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
      persona.addMethod(method, integration);
    }

    for (const responseType of [
      apigateway.ResponseType.DEFAULT_4XX,
      apigateway.ResponseType.DEFAULT_5XX
    ]) {
      api.addGatewayResponse(`Gateway${responseType.responseType}`, {
        type: responseType,
        responseHeaders: {
          "Access-Control-Allow-Origin": "'*'"
        }
      });
    }

    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const apiOrigin = new origins.HttpOrigin(
      `${api.restApiId}.execute-api.${this.region}.${this.urlSuffix}`,
      {
        originPath: `/${api.deploymentStage.stageName}`,
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY
      }
    );

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true
      },
      additionalBehaviors: {
        "api/*": {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
        }
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(1)
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(1)
        }
      ]
    });

    const webOutput = path.join(rootDirectory, "apps/web/out");
    const webAsset = existsSync(webOutput)
      ? webOutput
      : path.join(rootDirectory, "apps/web/deploy-placeholder");

    new s3deploy.BucketDeployment(this, "WebsiteDeployment", {
      destinationBucket: websiteBucket,
      sources: [s3deploy.Source.asset(webAsset)],
      distribution,
      distributionPaths: ["/*"],
      prune: true
    });

    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["xray:PutTraceSegments", "xray:PutTelemetryRecords"],
        resources: ["*"]
      })
    );

    Tags.of(this).add("Project", "Tablia");
    Tags.of(this).add("Environment", "TechnicalTest");
    Tags.of(this).add("CostProfile", "FreeTier");

    new CfnOutput(this, "WebUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "URL pública del dashboard"
    });
    new CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "URL directa de API Gateway para Postman"
    });
    new CfnOutput(this, "CloudFrontApiUrl", {
      value: `https://${distribution.distributionDomainName}/api`,
      description: "API a través de CloudFront"
    });
  }
}

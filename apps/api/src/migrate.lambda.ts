import type { CloudFormationCustomResourceEvent } from "aws-lambda";
import { runMigrations } from "./database";

export async function handler(event: CloudFormationCustomResourceEvent) {
  if (event.RequestType !== "Delete") {
    await runMigrations();
  }

  return {
    PhysicalResourceId: "tablia-personas-schema-v1",
    Data: { migrated: event.RequestType !== "Delete" }
  };
}

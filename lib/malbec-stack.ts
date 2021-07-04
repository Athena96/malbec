import * as cdk from '@aws-cdk/core';
import * as malbec_service from '../lib/malbec-service';
export enum Stage {
  Dev = "dev",
  Prod = "prod"
}
export class MalbecStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, stage: string, props?: cdk.StackProps) {
    super(scope, id, props);
    new malbec_service.MalbecService(this, 'Malbec', stage);
  }
}

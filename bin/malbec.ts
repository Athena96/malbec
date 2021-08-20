#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MalbecStack } from '../lib/malbec-stack';

const app = new cdk.App();
new MalbecStack(app, 'MalbecStack-Dev', 'dev');
new MalbecStack(app, 'MalbecStack-Prod', 'prod');

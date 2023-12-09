#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { IamLoginMonitorStack } from '../lib/iam-login-monitor-stack';

const app = new cdk.App();


new IamLoginMonitorStack(app, 'IamLoginMonitorStack', { env: { region: "us-east-1" } });

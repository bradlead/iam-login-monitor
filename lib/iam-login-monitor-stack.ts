import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class IamLoginMonitorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    const IdentityStoreId = this.node.tryGetContext('identityStoreId');

    // Create an eventbridge rule that triggers on Console Login events
    const signInRule = new events.Rule(this, 'rule', {
      eventPattern: {
        source: ["aws.signin"],
        detailType: ["AWS Console Sign In via CloudTrail"]
      },
    });

    const table = new dynamodb.Table(this, 'Logins', {
      partitionKey: { name: 'arn', type: dynamodb.AttributeType.STRING },
    });

    const ruleTargetLambda = new lambda.Function(this, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/event_func')),
      environment: {
        DatabaseTable: table.tableName
      }
    });

    table.grantReadWriteData(ruleTargetLambda);

    const transformer = {
      arn: events.EventField.fromPath('$.detail.userIdentity.arn'),
      timestamp: events.EventField.fromPath('$.detail.eventTime'),
    };

    // Add the lambda function as the rule target
    signInRule.addTarget(new targets.LambdaFunction(ruleTargetLambda, {
      deadLetterQueue: new sqs.Queue(this, 'DeadLetterQueue'),
      maxEventAge: cdk.Duration.hours(2),
      retryAttempts: 2,
      event: events.RuleTargetInput.fromObject(transformer)
    }));

    const cronRuleLambda = new lambda.Function(this, 'CronLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/cron_func')),
      environment: {
        DatabaseTable: table.tableName,
        IdentityStoreID: IdentityStoreId
      }
    });
// Give cronLambda access to delete iam users
    cronRuleLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['iam:DeleteUser'],
        resources: ['*'],
        effect: iam.Effect.ALLOW
      })
    );

    table.grantReadWriteData(cronRuleLambda);

    const lastLoginRule = new events.Rule(this, 'CronRule', {
      schedule: events.Schedule.expression('cron(0 12 * * ? *)'),
      enabled: true
    })

    lastLoginRule.addTarget(new targets.LambdaFunction(cronRuleLambda, {
      deadLetterQueue: new sqs.Queue(this, 'cronDeadLetterQueue'),
      retryAttempts: 2
    }));

    // Outputs
        new CfnOutput(this, 'DynamoDbTableName', { value: table.tableName });
        new CfnOutput(this, 'LambdFunctionArn', { value: ruleTargetLambda.functionArn });
  }
}
 
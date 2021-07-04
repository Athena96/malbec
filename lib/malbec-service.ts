import * as core from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as sqs from '@aws-cdk/aws-sqs';

import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { Stage } from './malbec-stack';
import { DynamoEventSource, SqsDlq } from '@aws-cdk/aws-lambda-event-sources';

import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';

const MATCHES_TABLE_NAME_PROD = 'MatchesTable-prod';
const MATCHES_TABLE_NAME_DEV = 'MatchesTable-dev';

const RUNNERS_TABLE_NAME_PROD = 'RunnersTable-prod';
const RUNNERS_TABLE_NAME_DEV = 'RunnersTable-dev';

const TIMES_TABLE_NAME_PROD = 'TimesTable-prod';
const TIMES_TABLE_NAME_DEV = 'TimesTable-dev';

const MATCHES_FUNCTION_NAME_PROD = 'Matches-prod';
const MATCHES_FUNCTION_NAME_DEV = 'Matches-dev';

const RUNNERS_FUNCTION_NAME_PROD = 'Runners-prod';
const RUNNERS_FUNCTION_NAME_DEV = 'Runners-dev';

const TIMES_FUNCTION_NAME_PROD = 'Times-prod';
const TIMES_FUNCTION_NAME_DEV = 'Times-dev';

const QUEUE_WRITER_FUNCTION_NAME_PROD = 'QueueWriter-prod';
const QUEUE_WRITER_FUNCTION_NAME_DEV = 'QueueWriter-dev';

const MATCHING_ENGINE_FUNCTION_NAME_PROD = 'MatchingEngine-prod';
const MATCHING_ENGINE_FUNCTION_NAME_DEV = 'MatchingEngine-dev';


const MATCHING_QUEUE_NAME_PROD = 'MatchesWriterQueue-prod';
const MATCHING_QUEUE_NAME_DEV = 'MatchesWriterQueue-dev';

export class MalbecService extends core.Construct {
    constructor(scope: core.Construct, id: string, stage: string) {
        super(scope, id);
        
        // ...
        const lambdaRole = new iam.Role(this, 'APILambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });
        lambdaRole.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
        );
        lambdaRole.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
        );
        lambdaRole.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess')
        );
        //
        //
        const matchesTable = new dynamodb.Table(this, 'MatchesTable', {
            partitionKey: {
                name: 'runnerid',
                type: dynamodb.AttributeType.STRING
            },
            tableName: stage === Stage.Prod ? MATCHES_TABLE_NAME_PROD : MATCHES_TABLE_NAME_DEV,
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: core.RemovalPolicy.RETAIN
        });
    
        const runnersTable = new dynamodb.Table(this, 'RunnersTable', {
            partitionKey: {
                name: 'runnerid',
                type: dynamodb.AttributeType.STRING
            },
            tableName: stage === Stage.Prod ? RUNNERS_TABLE_NAME_PROD : RUNNERS_TABLE_NAME_DEV,
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: core.RemovalPolicy.RETAIN,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES

        });

        const timesTable = new dynamodb.Table(this, 'TimesTable', {
            partitionKey: {
                name: 'timeid',
                type: dynamodb.AttributeType.STRING
            },
            tableName: stage === Stage.Prod ? TIMES_TABLE_NAME_PROD : TIMES_TABLE_NAME_DEV,
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: core.RemovalPolicy.RETAIN,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
        });

        //
        const matchesFunction = new lambda.Function(this, 'MatchesHandler', {
            functionName: stage === Stage.Prod ? MATCHES_FUNCTION_NAME_PROD : MATCHES_FUNCTION_NAME_DEV,
            timeout: core.Duration.seconds(900),
            runtime: lambda.Runtime.NODEJS_12_X,
            code: lambda.Code.fromAsset('resources'),
            handler: 'matchesFunction.handler',
            role: lambdaRole,
            environment: {
                MATCHES_TABLE_NAME: matchesTable.tableName,
                ENVIRONMENT: stage
            }
        });

        const runnersFunction = new lambda.Function(this, 'RunnersHandler', {
            functionName: stage === Stage.Prod ? RUNNERS_FUNCTION_NAME_PROD : RUNNERS_FUNCTION_NAME_DEV,
            runtime: lambda.Runtime.NODEJS_12_X,
            code: lambda.Code.fromAsset('resources'),
            handler: 'runnersFunction.handler',
            timeout: core.Duration.seconds(900),
            role: lambdaRole,
            environment: {
                RUNNERS_TABLE_NAME: runnersTable.tableName,
                ENVIRONMENT: stage
            }
        });

        const timesFunction = new lambda.Function(this, 'TimesHandler', {
            functionName: stage === Stage.Prod ? TIMES_FUNCTION_NAME_PROD : TIMES_FUNCTION_NAME_DEV,
            runtime: lambda.Runtime.NODEJS_12_X,
            code: lambda.Code.fromAsset('resources'),
            handler: 'timesFunction.handler',
            timeout: core.Duration.seconds(900),
            role: lambdaRole,
            environment: {
                TIMES_TABLE_NAME: timesTable.tableName,
                ENVIRONMENT: stage
            }
        });


        ///
        const api = new apigateway.RestApi(this, 'malbec-api', {
            restApiName: 'Malbec Service'
        });

        const matchesApi = api.root.addResource('matches');
        matchesApi.addResource('{runnerid}');
        const matchesIntegration = new apigateway.LambdaIntegration(matchesFunction);
        matchesApi.addMethod('GET', matchesIntegration);


        const runnersApi = api.root.addResource('runners');
        runnersApi.addResource('{runnerid}');
        const runnersIntegration = new apigateway.LambdaIntegration(runnersFunction);
        runnersApi.addMethod('GET', runnersIntegration);
        runnersApi.addMethod('POST', runnersIntegration);
        runnersApi.addMethod('DELETE', runnersIntegration);
        addCorsOptions(runnersApi);



        const timeApi = api.root.addResource('times');
        timeApi.addResource('{timeid}');
        
        const timesIntegration = new apigateway.LambdaIntegration(timesFunction);
        timeApi.addMethod('GET', timesIntegration);
        timeApi.addMethod('POST', timesIntegration);
        timeApi.addMethod('DELETE', timesIntegration);
        addCorsOptions(timeApi);

        //
        const queueWriter = new lambda.Function(this, 'QueueWriter', {
            functionName: stage === Stage.Prod ? QUEUE_WRITER_FUNCTION_NAME_PROD : QUEUE_WRITER_FUNCTION_NAME_DEV,

            runtime: lambda.Runtime.NODEJS_12_X,
            code: lambda.Code.fromAsset('resources'),
            handler: 'queueWriterFunction.handler',
            timeout: core.Duration.seconds(900),
            role: lambdaRole,
            environment: {
              ENVIRONMENT: stage
            }
        });
        queueWriter.addEventSource(new DynamoEventSource(timesTable, {
            startingPosition: lambda.StartingPosition.TRIM_HORIZON,
            batchSize: 1,
            bisectBatchOnError: true,
            retryAttempts: 3
        }));
        queueWriter.addEventSource(new DynamoEventSource(runnersTable, {
            startingPosition: lambda.StartingPosition.TRIM_HORIZON,
            batchSize: 1,
            bisectBatchOnError: true,
            retryAttempts: 3
        }));


        //
        const matchesWriterQueue = new sqs.Queue(this, 'MatchesWriterQueue', {
            queueName: stage === Stage.Prod ? MATCHING_QUEUE_NAME_PROD : MATCHING_QUEUE_NAME_DEV,

            visibilityTimeout: core.Duration.seconds(900),    
        });

 
        //
        const matchesEngineFunction = new lambda.Function(this, 'MatchesEngineFunction', {
            functionName: stage === Stage.Prod ? MATCHING_ENGINE_FUNCTION_NAME_PROD : MATCHING_ENGINE_FUNCTION_NAME_DEV,
            runtime: lambda.Runtime.NODEJS_12_X,
            code: lambda.Code.fromAsset('resources'),
            handler: 'matchesEngineFunction.handler',
            timeout: core.Duration.seconds(900),
            role: lambdaRole,
            environment: {
              ENVIRONMENT: stage
            }
        });

        matchesEngineFunction.addEventSource(new SqsEventSource(matchesWriterQueue, {
            batchSize: 1,
        }));
    }
}

export function addCorsOptions(apiResource: apigateway.IResource) {
    apiResource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Credentials': "'false'",
          'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": "{\"statusCode\": 200}"
      },
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Credentials': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },  
      }]
    })
  }
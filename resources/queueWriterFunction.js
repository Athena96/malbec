
const { getRunner } = require('./Helper/DynamoDBHelper');


var AWS = require('aws-sdk');
AWS.config.update({
    region: process.env.AWS_REGION
});
var sqs = new AWS.SQS();

exports.handler = async (event) => {
    console.log("queue writer function");
    console.log(JSON.stringify(event));
    const message = event.Records[0];
    console.log(message);

    // only find matches for runner when the user is UPDATED with all required fields to find a match.
    console.log("message.dynamodb.NewImage.runnerid: " + JSON.stringify(message.dynamodb.NewImage.runnerid));
    const runner = await getRunner(message.dynamodb.NewImage.runnerid.S);
    console.log('runner: ' + JSON.stringify(runner));

    console.log('runner[location]: ' + runner['location']);
    console.log('runner[runnerid]: ' + runner['runnerid']);

    const hasSufficientProfileInfo = runner['location'] && runner['runnerid'];
    console.log('hasSufficientProfileInfo: ' + hasSufficientProfileInfo);

    const addingTime = message.eventSourceARN.includes("TimesTable") && message.eventName === "INSERT";
    const updatingTime = message.eventSourceARN.includes("TimesTable") && message.eventName === "MODIFY";
    // const deletingTime = message.eventSourceARN.includes("TimesTable") && message.eventName === "DELETE";

    console.log('addingTime' + addingTime)

    console.log('updatingTime' + updatingTime)

    console.log('hasSufficientProfileInfo' + hasSufficientProfileInfo)
    console.log('(addingTime || updatingTime ) && (hasSufficientProfileInfo)' + (addingTime || updatingTime ) && (hasSufficientProfileInfo))

    // if user moves locations, update their matches.
    if ( (addingTime || updatingTime ) && (hasSufficientProfileInfo) ) {
        try {
            message['runnerid'] = message.dynamodb.NewImage.runnerid.S;
            message['race'] = message.dynamodb.NewImage.race.S;
            await sendMatchingRunMessage(message);
            console.log("Sent message to queue: " + JSON.stringify(message));
        
        } catch (error) {
            console.error(error);
        }

    }
}

sendMatchingRunMessage = async function (message) {
    const result = await sqs.sendMessage({
        MessageBody: JSON.stringify(message),
        QueueUrl: process.env.QUEUE_URL
      }).promise();
    console.log(result);
};
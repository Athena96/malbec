
var AWS = require('aws-sdk');
AWS.config.update({
    region: process.env.AWS_REGION
});
var ddb = new AWS.DynamoDB.DocumentClient();

// TIME

exports.saveTime = async function (time) {
    var params = {
        Item: time,
        TableName: process.env.TIMES_TABLE_NAME
    };
    const result = await ddb.put(params).promise();
};

exports.getTime = async function (timeid) {
    const result = await ddb.query({
        TableName : process.env.TIMES_TABLE_NAME,
        KeyConditionExpression: "#tid = :timeidVal",
        ExpressionAttributeNames:{
            "#tid": "timeid"
        },
        ExpressionAttributeValues: {
            ":timeidVal": timeid
        }
    }).promise();
    return result.Items[0];
};

exports.getTimeForRace = async function (runnerid, race) {
    try {
        const result = await ddb.query({
            TableName : process.env.TIMES_TABLE_NAME,
            IndexName: process.env.TIMES_TABLE_INDEX,
            KeyConditionExpression: "#runid = :runneridVal and #rid = :raceVal",
            ExpressionAttributeNames:{
                "#runid": "runnerid",
                "#rid": "race"
            },
            ExpressionAttributeValues: {
                ":runneridVal": runnerid,
                ":raceVal": race.race.S
            }
        }).promise();

        return result.Items[0];
    } catch (error) {
        console.error(error);

        return null;
    }

};

exports.getTimesForRunner = async function (runnerid) {
    let allTimesForRunner = [];
    let data = null;
    let key = null;
    do {

        data = await ddb.scan({
            TableName: process.env.TIMES_TABLE_NAME,
            Limit: 100,
            ExclusiveStartKey: key
          }).promise();

          if (data['Items'].length > 0) {
              for (const item of data['Items']) {
                  if (item.runnerid === runnerid) {
                      allTimesForRunner.push(item);
                  }
              }
          }
          key = data.LastEvaluatedKey;
    } while(typeof data.LastEvaluatedKey != "undefined");

    return allTimesForRunner;
};

exports.deleteTime = async function (timeid) {
    const result = await ddb.delete({
        TableName : process.env.TIMES_TABLE_NAME,
        Key: {
            "timeid": timeid
        }
    }).promise();
};


// MATCHES
exports.getMatchesForRunner = async function (runnerid) {
    const result = await ddb.query({
        TableName : process.env.MATCHES_TABLE_NAME,
        KeyConditionExpression: "#rid = :runnerIdVal",
        ExpressionAttributeNames:{
            "#rid": "runnerid"
        },
        ExpressionAttributeValues: {
            ":runnerIdVal": runnerid
        }
    }).promise();
    if (result.Items.length === 0) {
        return null;
    } else {
        return result.Items[0];
    }
};

// RUNNERS


exports.saveRunner = async function (runner) {
    var params = {
        Item: runner,
        TableName: process.env.RUNNERS_TABLE_NAME
    };
    const result = await ddb.put(params).promise();
};


exports.saveMatchesForRunnerRace = async function (newMatchingRunners) {
    
    var params = {
        Item: newMatchingRunners,
        TableName: process.env.MATCHES_TABLE_NAME
    };
    const result = await ddb.put(params).promise();
};


// move to helper

exports.getRunner = async function (runnerid) {
    const result = await ddb.query({
        TableName : process.env.RUNNERS_TABLE_NAME,
        KeyConditionExpression: "#rid = :runnerIdVal",
        ExpressionAttributeNames:{
            "#rid": "runnerid"
        },
        ExpressionAttributeValues: {
            ":runnerIdVal": runnerid
        }
    }).promise();
    return result.Items[0];
};

exports.deleteRunner = async function (runnerid) {
    const result = await ddb.delete({
        TableName : process.env.RUNNERS_TABLE_NAME,
        Key: {
            "runnerid": runnerid
        }
    }).promise();
};

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
    console.log(result);
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
    console.log(result);
    return result.Items[0];
};

exports.getTimeForRace = async function (runnerid, race) {
    console.log("runnerid: " + runnerid);
    console.log("race: " + race);

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
            ":raceVal": race
        }
    }).promise();
    console.log(result);
    return result.Items[0];
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
    console.log(result);
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
    console.log(result);
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
    console.log(result);
};

exports.saveMatches = async function (matches) {
    
    var params = {
        Item: matches,
        TableName: process.env.MATCHES_TABLE_NAME
    };
    const result = await ddb.put(params).promise();
    console.log('saveMatches: ' + JSON.stringify(result));
}

exports.saveMatchForRace = async function (existingMatches, matches, race, runner) {
    existingMatches[race] = matches;
    
    var params = {
        Item: existingMatches,
        TableName: process.env.MATCHES_TABLE_NAME
    };
    const result = await ddb.put(params).promise();
    console.log(result);
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
    console.log(result);
    return result.Items[0];
};

exports.deleteRunner = async function (runnerid) {
    const result = await ddb.delete({
        TableName : process.env.RUNNERS_TABLE_NAME,
        Key: {
            "runnerid": runnerid
        }
    }).promise();
    console.log(result);
};
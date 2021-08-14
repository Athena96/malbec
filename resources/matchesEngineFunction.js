const { getCORSHeaders  }= require('./Helper/NetworkingHelper');
const { getRunner } = require('./Helper/DynamoDBHelper');

const { getTimeForRace, saveMatchesForRunnerRace, getMatchesForRunner } = require('./Helper/DynamoDBHelper');

var AWS = require('aws-sdk');
AWS.config.update({
    region: process.env.AWS_REGION
});
var ddb = new AWS.DynamoDB.DocumentClient();
var PROCESSED = {};

exports.handler = async (event) => {
    console.log("matches engine function");
    console.log(JSON.stringify(event));
    const message = JSON.parse(event.Records[0].body);
    const newTime = Object.keys(message.dynamodb).includes('NewImage') ? message.dynamodb.NewImage : message.dynamodb.OldImage;
    
    try {
        const runner = newTime.runnerid.S;
        const race = newTime;
        await processMatches(runner, race);
        PROCESSED = {};
        
        return {
          statusCode: 200,
          body: 'success',
          headers: getCORSHeaders(),
        };
    } catch (error) {
        console.error(error);
        console.log("FAILURE: failed to get matches");
        // cloudwatch  metric fail
        return {
          statusCode: 500,
          body: 'FAILURE: failed to get matches',
          headers: getCORSHeaders(),
        };
    }
}


processMatches = async function (runnerid, race) {
    const runner = await getRunner(runnerid);

    console.log("process runner: " + JSON.stringify(runner));
    console.log("process race: " + JSON.stringify(race));

    let originalMatchesObject = await fetchMatchesForRunner(runner, race);
    console.log("ORIGINAL MATCHING RUNNERS: " + JSON.stringify(originalMatchesObject));
    let originalMatchesForRace = []
    for (const match of originalMatchesObject[race.race.S]) {
        originalMatchesForRace.push(match.runnerid);
    }

    let newMatchingRunners = await generateMatchesForRunnerRace(runner, race);
    console.log("NEW MATCHING RUNNERS: " + JSON.stringify(newMatchingRunners));
    let newMatchesForRace = []
    for (const newMatch of newMatchingRunners) {
        newMatchesForRace.push(newMatch.runnerid);
    }

    console.log("save new matches");
    let updatedMatchesObject = originalMatchesObject;
    updatedMatchesObject[race.race.S] = newMatchingRunners;
    console.log("updatedMatchesObject: " + JSON.stringify(updatedMatchesObject));

    await saveMatchesForRunnerRace(updatedMatchesObject);
    
    PROCESSED[runner.runnerid] = true;

    // update all original matches
    console.log("originalMatchingRunners");

    console.log('originalMatchesForRace: ' + JSON.stringify(originalMatchesForRace));
    for (const originalRunner of originalMatchesForRace) {
        console.log("originalRunner: " + JSON.stringify(originalRunner));
        console.log("PROCESSED[originalRunner]: " + Object.keys(PROCESSED).includes(originalRunner));
        if (!Object.keys(PROCESSED).includes(originalRunner)) {
            await processMatches(originalRunner, race);
        }
        // let originalRunnersMatches = await generateMatchesForRunnerRace(originalRunner, race);
        // console.log(`originalRunnersMatches: ${originalRunner} : ${JSON.stringify(originalRunnersMatches)}`);

        // console.log("save originalRunnersMatches");
        // await saveMatchesForRunnerRace(originalRunner, race, originalRunnersMatches);
    
    }
    
    
    // update all new matches
    for (const newMatchingRunner of newMatchesForRace) {
        console.log("newMatchingRunner: " + JSON.stringify(newMatchingRunner));
        console.log("PROCESSED[newMatchingRunner]: " + Object.keys(PROCESSED).includes(newMatchingRunner));

        if (!Object.keys(PROCESSED).includes(newMatchingRunner)) {
            await processMatches(newMatchingRunner, race);
        }
        // let newRunnersMatches = await generateMatchesForRunnerRace(newMatchingRunner, race);
        // console.log(`newRunnersMatches: ${newMatchingRunner} : ${JSON.stringify(newRunnersMatches)}`);

        // console.log("save newRunnersMatches");
        // await saveMatchesForRunnerRace(newMatchingRunner, race, newRunnersMatches);
    
    }

}


fetchMatchesForRunner = async function (runner, race) {
    console.log(`fetchMatchesForRunner(${JSON.stringify(runner)}, ${JSON.stringify(race)})`)
    const params = {
        TableName : process.env.MATCHES_TABLE_NAME,
        KeyConditionExpression: "#rid = :runnerIdVal",
        ExpressionAttributeNames:{
            "#rid": "runnerid"
        },
        ExpressionAttributeValues: {
            ":runnerIdVal": runner.runnerid
        }
    };
    
    console.log(JSON.stringify(params));

    const result = await ddb.query(params).promise();
    if (result && result.Items && result.Items.length > 0 ) {
        return result.Items[0];
    } else {
        return {
            runnerid: runner.runnerid,
            [race.race.S]: []
        }
    }
}

getDistanceFromLatLonInKm = function (lat1, lon1, lat2, lon2) {
  
 function deg2rad(deg) {
  return deg * (Math.PI/180)
}
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}


fetchMatchingTimesForRunner = async function (runner, race, time) {
    console.log(`fetchMatchingTimesForRunner: ${JSON.stringify(runner)}, ${JSON.stringify(race)}, ${JSON.stringify(time)}`);
    if (!time) {
        console.log('RETURN');
        return [];
    }
    const timeBuff = 120;
    const geoBuff = 120;
    let matches = [];
    let data = null;
    let key = null;
    // store runners location in times entries?
    do {
        const params = {
            TableName : process.env.TIMES_TABLE_NAME,
            ExpressionAttributeNames:{
                "#rid": "runnerid",
                "#raceid": "race",
                "#tm": "time"
            },
            ExpressionAttributeValues: {
                ":runnerIdVal": runner.runnerid,
                ":raceType": race.race.S,
                ":timeValMin": time.time - timeBuff,
                ":timeValMax": time.time + timeBuff
            },
            FilterExpression: "#rid <> :runnerIdVal AND #raceid = :raceType AND #tm > :timeValMin AND #tm < :timeValMax",
            Limit: 100,
            ExclusiveStartKey: key
        };
        console.log("params: " + JSON.stringify(params));
        data = await ddb.scan(params).promise();
        if (data['Items'].length > 0) {
            matches = [...matches, ...data['Items']];
        }
        key = data.LastEvaluatedKey;
    } while (typeof data.LastEvaluatedKey != "undefined");
    
    const myLat = Number(runner.coordinates.split("#")[0]);
    const myLon = Number(runner.coordinates.split("#")[1]);
    let results = []
    for (const entry of matches) {
        const otherRunner = await getRunner(entry.runnerid);
        
        const otherLat = Number(otherRunner.coordinates.split("#")[0]);
        const otherLon = Number(otherRunner.coordinates.split("#")[1]);
        const dist = getDistanceFromLatLonInKm(myLat, myLon, otherLat, otherLon);

        if (dist <= 5.0) {
            results.push(entry);
        }
    }
    
    return results;
    
}


getTopKMatches = function (times, k) {
    // sort times best to worst
    // get top K
    // times.sort()
    if (times && times.length > 0) {
        return times;
    } else {
        return [];
    }
}


generateMatchesForRunnerRace = async function (runner, race) {
    console.log(`generateMatchesForRunnerRace(${JSON.stringify(runner)}, ${JSON.stringify(race)})`)
    const time = await getTimeForRace(runner.runnerid, race);
    console.log("time: " + JSON.stringify(time));
    
    let newMatchingTimes = await fetchMatchingTimesForRunner(runner, race, time);    
    console.log("newMatchingTimes: " + JSON.stringify(newMatchingTimes));
    
    let newMatchingRunners = getTopKMatches(newMatchingTimes, 5);
    console.log("newMatchingRunners: " + JSON.stringify(newMatchingRunners));


    return newMatchingRunners;
};
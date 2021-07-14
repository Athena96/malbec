const { getCORSHeaders  }= require('./Helper/NetworkingHelper');
const { getRunner } = require('./Helper/DynamoDBHelper');

const { getTimeForRace, saveMatchForRace, getMatchesForRunner, saveMatches } = require('./Helper/DynamoDBHelper');

var AWS = require('aws-sdk');
AWS.config.update({
    region: process.env.AWS_REGION
});
var ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    console.log("matches engine function");
    console.log(JSON.stringify(event));
    const message = JSON.parse(event.Records[0].body);

    const newTime = message.dynamodb.NewImage;
    try {
        const runner = await getRunner(newTime.runnerid.S);
        console.log("runner; " + JSON.stringify(runner));
        console.log(" runner.runnerid " + runner.runnerid);

        const race = newTime.race.S;
        const addingTime = message.eventSourceARN.includes("TimesTable") && message.eventName === "INSERT";
        const updatingTime = message.eventSourceARN.includes("TimesTable") && message.eventName === "MODIFY";
        // const deletingTime = message.eventSourceARN.includes("TimesTable") && message.eventName === "DELETE";
    
        let matches = [];
        if (addingTime || updatingTime) {
            const time = await getTimeForRace(runner.runnerid, race);
            matches = await generateMatchesForRace(runner, race, time);
        }
        console.log("SUCCESS: " + JSON.stringify(matches));
        console.log("write matches to DDB");
        
        let existingMatches = await getMatchesForRunner(runner.runnerid);
        if (!existingMatches) {
            existingMatches = {
                runnerid: runner.runnerid,
                [race]: []
            }
        }
        await saveMatchForRace(existingMatches, matches, race, runner);
        console.log("done!");
        
        
        return {
          statusCode: 200,
          body: JSON.stringify(matches),
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


// generateMatches = async function (runner) {
//     const races = [ '5k', '10k', 'halfmarathon', 'marathon' ];

//     let matches = {};

//     for (const race of races) {
//         const time = getTimeForRace(runner, race);
//         matches[race] = await generateMatchesForRace(runner, race, time);
//     }

//     return matches;
// };


fetchMatchesForRunner = async function (runner) {
    const result = await ddb.query({
        TableName : process.env.MATCHES_TABLE_NAME,
        KeyConditionExpression: "#rid = :runnerIdVal",
        ExpressionAttributeNames:{
            "#rid": "runnerid"
        },
        ExpressionAttributeValues: {
            ":runnerIdVal": runner.runnerid
        }
    }).promise();
    console.log(result);
    if (result && result.Items && result.Items.length > 0 ) {
        return result.Items[0];
    } else {
        return [];
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
    console.log("running fetchMatchingTimesForRunner");
    console.log("runner: " + JSON.stringify(runner));
    console.log("runner: " + typeof runner);
        console.log("race: " + JSON.stringify(race));
    console.log("race: " + typeof race);
        console.log("time: " + JSON.stringify(time));
    console.log("time: " + typeof time);
    
    const timeBuff = 120;
    const geoBuff = 120;
    let matches = [];
    let data = null;
    let key = null;
    // store runners location in times entries?
    do {
        data = await ddb.scan({
            TableName : process.env.TIMES_TABLE_NAME,
            ExpressionAttributeNames:{
                "#rid": "runnerid",
                "#raceid": "race",
                "#tm": "time"
            },
            ExpressionAttributeValues: {
                ":runnerIdVal": runner.runnerid,
                ":raceType": race,
                ":timeValMin": time.time - timeBuff,
                ":timeValMax": time.time + timeBuff
            },
            FilterExpression: "#rid <> :runnerIdVal AND #raceid = :raceType AND #tm > :timeValMin AND #tm < :timeValMax",
            Limit: 100,
            ExclusiveStartKey: key
        }).promise();
        if (data['Items'].length > 0) {
            matches = [...matches, ...data['Items']];
        }
        key = data.LastEvaluatedKey;
    } while (typeof data.LastEvaluatedKey != "undefined");
    
    console.log("filter by distance");
    console.log(JSON.stringify(matches));
    const myLat = Number(runner.coordinates.split("#")[0]);
    const myLon = Number(runner.coordinates.split("#")[1]);
    let results = []
    for (const entry of matches) {
        console.log("ent: "  + JSON.stringify(entry));
        const otherRunner = await getRunner(entry.runnerid);
        
        const otherLat = Number(otherRunner.coordinates.split("#")[0]);
        const otherLon = Number(otherRunner.coordinates.split("#")[1]);
        const dist = getDistanceFromLatLonInKm(myLat, myLon, otherLat, otherLon);
        console.log("DIST: " + dist);
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

updateMatchesForRunner = async function (runnerid, newMatchingRunner, matchRaceType) {
    //
    console.log('TODO: updateMatchesForRunner');
    
    // get matches for runner
    // udpate matches[matcheRaceType].push(newMatchingrunner)
    const runnersMatches = await getMatchesForRunner(runnerid);
    
    console.log('runnersMatches' + JSON.stringify(runnersMatches));
    console.log('matchRaceType' + matchRaceType);

    if(!runnersMatches[matchRaceType].includes(newMatchingRunner)) {
        console.log("HERE>...");

        console.log(JSON.stringify(runnersMatches));
        runnersMatches[matchRaceType].push(newMatchingRunner);
        
        console.log(JSON.stringify(runnersMatches));
        
        await saveMatches(runnersMatches);        
    }
}


generateMatchesForRace = async function (runner, race, time) {

    // MATCHES get my current matches for race
        /* 5k: [ 'runner1', 'runner2' ] */
        // empty if not matches yet: [ ]
    let originalMatchingRunners = await fetchMatchesForRunner(runner);
    console.log('originalMatchingRunners: ' + JSON.stringify(originalMatchingRunners));
    // race times where
        // runnerId != me
        // race == race
        // time > x && time < y
        // location
        // date?
    let newMatchingTimes = await fetchMatchingTimesForRunner(runner, race, time);
    console.log('newMatchingTimes: ' + JSON.stringify(newMatchingTimes));
    
    // NEWMATCHES = get runnerIds from top K
    // MATCHES = NEWMATCHES
    let newMatchingRunners = getTopKMatches(newMatchingTimes, 5);
    console.log('newMatchingRunners: ' + JSON.stringify(newMatchingRunners));

    // for runner in DIFF(MATCHES, NEWMATCHES)
        // ddb.update({runner.runnerId, race, myRunnerId})
    for (const newRunner of newMatchingRunners) {
        await updateMatchesForRunner(runner.runnerid, newRunner, race);
    }

    return newMatchingRunners;

};
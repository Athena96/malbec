const { getCORSHeaders } = require('./Helper/NetworkingHelper');
const Time = require('./Model/Time');

const { saveTime } = require('./Helper/DynamoDBHelper');
const { getTime } = require('./Helper/DynamoDBHelper');
const { getTimesForRunner } = require('./Helper/DynamoDBHelper');

const { deleteTime } = require('./Helper/DynamoDBHelper');

exports.handler = async (event) => {
    console.log("times function");
    console.log(JSON.stringify(event));

    try {
        switch(event.httpMethod) {
            case "GET":
                const runnerid = event.queryStringParameters.runnerid; // get times for runners

                let times = [];
                if (Object.keys(event.queryStringParameters).includes('timeid')) {
                    const timeid = event.queryStringParameters.timeid; // get a time
                    times = await getTime(timeid);
                } else {
                    times = await getTimesForRunner(runnerid);
                }

                return {
                    statusCode: 200,
                    body: JSON.stringify(times),
                    headers: getCORSHeaders(),
                  }; 
            case "POST":
                const time = new Time(event);
                await saveTime(time);
                return {
                    statusCode: 200,
                    body: `SUCCESS: added new time`,
                    headers: getCORSHeaders(),
                  }; 
            case "PUT":
                let sentTime = JSON.parse(event.body);
                console.log('sentTime: ' + JSON.stringify(sentTime));
                
                await saveTime(sentTime);
                
                return {
                    statusCode: 200,
                    body: `SUCCESS: updated time ${JSON.stringify(sentTime)}`,
                    headers: getCORSHeaders(),
                  };
            case "DELETE":
                const timeid = event.queryStringParameters.timeid;
                await deleteTime(timeid);
                return {
                    statusCode: 200,
                    body: `SUCCESS: deleted time ${timeid}`,
                    headers: getCORSHeaders(),
                  }; 
            default:
                console.log("unknown operation");
                return;
        }
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: 'FAILURE: failed to add new runner',
            headers: getCORSHeaders(),
          };
    }
}

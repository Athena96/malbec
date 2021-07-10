
const { getCORSHeaders } = require('./Helper/NetworkingHelper');
const { getMatchesForRunner } = require('./Helper/DynamoDBHelper');

exports.handler = async (event) => {
    console.log("matches function");
    console.log(JSON.stringify(event));    
    
    try {
        const runnerId = event.queryStringParameters.runnerid;
        const matches = await getMatchesForRunner(runnerId);
        console.log("SUCCESS: found matches for runner");
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

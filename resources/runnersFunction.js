const { getCORSHeaders } = require('./Helper/NetworkingHelper');
const Runner = require('./Model/Runner');
const { saveRunner } = require('./Helper/DynamoDBHelper');
const { getRunner } = require('./Helper/DynamoDBHelper');
const { deleteRunner } = require('./Helper/DynamoDBHelper');

exports.handler = async (event) => {
    console.log("runners function");
    console.log(JSON.stringify(event));
    const runnerid = event.queryStringParameters !== null ? event.queryStringParameters.runnerid : JSON.parse(event.body).runnerid;
    console.log(runnerid);

    try {
        switch(event.httpMethod) {
            case "GET":
                const runner = await getRunner(runnerid);
                return {
                    statusCode: 200,
                    body: JSON.stringify(runner),
                    headers: getCORSHeaders(),
                  }; 

            case "PUT":

                let sentRunner = JSON.parse(event.body);
                console.log('sentRunner: ' + JSON.stringify(sentRunner));
                
                await saveRunner(sentRunner);
                
                return {
                    statusCode: 200,
                    body: `SUCCESS: updated runner ${JSON.stringify(sentRunner)}`,
                    headers: getCORSHeaders(),
                  };
                 
            case "POST":

                const newRunner = await saveRunner(new Runner(event));
                return {
                    statusCode: 200,
                    body: `SUCCESS: added new runner ${JSON.stringify(newRunner)}`,
                    headers: getCORSHeaders(),
                  }; 
            case "DELETE":
                // todo delete all times and matches for runner as well.
                await deleteRunner(runnerid);
                return {
                    statusCode: 200,
                    body: `SUCCESS: deleted runner ${runnerid}`,
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
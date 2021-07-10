
class Matches {
    constructor(request) {
        const body = JSON.parse(request.body)
        console.log("Creating Match from: ");
        console.log(body);

        this.email = body.email.toLowerCase();
        this.firstname = body.firstname || '';
        this.lastname = body.lastname || '';
    }       
}

module.exports = Matches;

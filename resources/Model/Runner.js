
class Runner {
    constructor(request) {
        const body = JSON.parse(request.body)
        console.log("Creating Runner from: ");
        console.log(body);

        this.email = body.email.toLowerCase();
        // this.firstname = body.firstname || '';
        // this.lastname = body.lastname || '';
        this.runnerid = body.runnerid || '';
        // this.gender = body.gender || '';
        // this.birthday = body.birthday || '';
        // this.location = body.location || '';
        // this.coordinates = body.coordinates || '';
    }       
}

module.exports = Runner;

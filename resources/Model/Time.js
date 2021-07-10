
class Time {
    constructor(request) {
        const body = JSON.parse(request.body)
        console.log("Creating Time from: ");
        console.log(body);

        this.runnerid = body.runnerid;
        this.timeid = body.timeid;
        this.link = body.link || '';
        this.race = body.race || '';
        
        this.date = body.date || '';
        this.time = body.time || '';

    }       
}

module.exports = Time;

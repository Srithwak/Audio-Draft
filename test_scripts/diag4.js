const axios = require('axios');
const fs = require('fs');

async function testApi() {
    let log = [];
    const L = (msg) => { log.push(msg); console.log(msg); };

    // Fake a login or directly use user tokens if they were in memory - wait, I can just use my Diag test scripts to get a valid user token?
    // Let me try calling the Spotify API tracks directly using client credentials AGAIN, but paying attention to exactly why it fails.
    L("Starting mock server trace test...");

}
testApi();

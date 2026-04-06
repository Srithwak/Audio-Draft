const axios = require('axios');
async function run() {
    try {
        const res = await axios.get('http://127.0.0.1:3000/api/spotify/playlists/37i9dQZF1DXcBWIGoYBM5M/tracks', {
            headers: { 'Authorization': 'Bearer fake-user-123' }
        });
        console.log("OK", res.status);
    } catch (e) {
        console.log("FAIL", e.response?.status, e.response?.data);
    }
}
run();

const axios = require('axios');
const qs = require('querystring');
const fs = require('fs');
require('dotenv').config({ path: './database/.env' });

async function testSpotify() {
    let log = "";
    try {
        const tokenRes = await axios.post('https://accounts.spotify.com/api/token', 
            qs.stringify({ grant_type: 'client_credentials' }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')}`
            }
        });
        const token = tokenRes.data.access_token;
        log += "Got token\n";

        // 2. Test Trending
        const globalTop50Id = '37i9dQZEVXbMDoHDwVN2tF';
        try {
            const tr = await axios.get(`https://api.spotify.com/v1/playlists/${globalTop50Id}/tracks`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { limit: 50, fields: 'items(track(name,artists(name),album(name,images),duration_ms,external_urls,uri,id))' }
            });
            log += "Trending OK\n";
        } catch (e) {
            log += "Trending Error: " + JSON.stringify(e.response?.data) + "\n";
        }

        // 3. Test Search
        try {
            const sr = await axios.get('https://api.spotify.com/v1/search', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    q: `genre:pop happy`,
                    type: 'track',
                    limit: 20
                }
            });
            log += "Search OK\n";
        } catch (e) {
            log += "Search Error: " + JSON.stringify(e.response?.data) + "\n";
        }

    } catch (e) {
        log += "Auth error: " + JSON.stringify(e.response?.data) + "\n";
    }
    fs.writeFileSync('./test_scripts/output.log', log);
}
testSpotify();

const axios = require('axios');
const qs = require('querystring');
require('dotenv').config({ path: './database/.env' });

async function testSpotify() {
    try {
        // 1. Get Client Credentials Token
        const tokenRes = await axios.post('https://accounts.spotify.com/api/token', 
            qs.stringify({ grant_type: 'client_credentials' }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')}`
            }
        });
        const token = tokenRes.data.access_token;
        console.log("Got token.");

        // 2. Test Trending
        const globalTop50Id = '37i9dQZEVXbMDoHDwVN2tF';
        try {
            const tr = await axios.get(`https://api.spotify.com/v1/playlists/${globalTop50Id}/tracks`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { limit: 50, fields: 'items(track(name,artists(name),album(name,images),duration_ms,external_urls,uri,id))' }
            });
            console.log("Trending OK", tr.data.items[0].track.name);
        } catch (e) {
            console.log("Trending Error:", e.response?.data || e.message);
        }

        // 3. Test search (Generate from Description)
        try {
            const sr = await axios.get('https://api.spotify.com/v1/search', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    q: `genre:pop happy`,
                    type: 'track',
                    limit: 20
                }
            });
            console.log("Search OK", sr.data.tracks.items.length);
        } catch (e) {
            console.log("Search Error:", e.response?.data || e.message);
        }

    } catch (e) {
        console.error("Auth error:", e.response?.data || e.message);
    }
}
testSpotify();

const axios = require('axios');
const qs = require('querystring');
require('dotenv').config({ path: './database/.env' });

async function testSpotify() {
    try {
        const tokenRes = await axios.post('https://accounts.spotify.com/api/token', 
            qs.stringify({ grant_type: 'client_credentials' }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')}`
            }
        });
        const token = tokenRes.data.access_token;
        console.log("Got token:", token.substring(0, 10));

        // 2. Test Trending
        const globalTop50Id = '37i9dQZEVXbMDoHDwVN2tF';
        try {
            const tr = await axios.get(`https://api.spotify.com/v1/playlists/${globalTop50Id}/tracks`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { limit: 50, fields: 'items(track(name,artists(name),album(name,images),duration_ms,external_urls,uri,id))' }
            });
            console.log("Trending OK");
        } catch (e) {
            console.log("Trending Error:", JSON.stringify(e.response?.data));
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
            console.log("Search OK");
        } catch (e) {
            console.log("Search Error:", JSON.stringify(e.response?.data));
        }

    } catch (e) {
        console.error("Auth error:", JSON.stringify(e.response?.data));
    }
}
testSpotify();

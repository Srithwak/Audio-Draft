const axios = require('axios');
const qs = require('querystring');
const fs = require('fs');
require('dotenv').config({ path: './database/.env' });

async function run() {
    const out = [];
    const L = (s) => out.push(s);
    
    try {
        // Get token
        const tokenRes = await axios.post('https://accounts.spotify.com/api/token', 
            qs.stringify({ grant_type: 'client_credentials' }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')}`
            }
        });
        const token = tokenRes.data.access_token;
        L('TOKEN: OK');

        // Test 1: Playlist tracks WITHOUT fields param
        const playlistId = '37i9dQZEVXbMDoHDwVN2tF';
        try {
            const r = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { limit: 3 }
            });
            L('TEST1 NO-FIELDS: OK total=' + r.data.total);
            if (r.data.items && r.data.items[0] && r.data.items[0].track) {
                L('  First track: ' + r.data.items[0].track.name);
            }
        } catch (e) {
            L('TEST1 NO-FIELDS: FAIL status=' + e.response?.status);
            L('  data=' + JSON.stringify(e.response?.data));
        }

        // Test 2: Playlist tracks WITH fields param (the old broken way)
        try {
            const r = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { limit: 3, fields: 'items(track(name,artists(name),album(name,images),duration_ms,external_urls,uri,id))' }
            });
            L('TEST2 WITH-FIELDS: OK total=' + r.data.total);
        } catch (e) {
            L('TEST2 WITH-FIELDS: FAIL status=' + e.response?.status);
            L('  data=' + JSON.stringify(e.response?.data));
        }

        // Test 3: A user's private playlist would need user token
        // Test through server endpoint
        try {
            const r = await axios.get('http://127.0.0.1:3000/api/spotify/playlists/37i9dQZEVXbMDoHDwVN2tF/tracks', {
                headers: { 'Authorization': 'Bearer test-user' }
            });
            L('TEST3 SERVER-ENDPOINT: OK');
            L('  tracks count=' + (r.data.tracks ? r.data.tracks.length : 'none'));
            if (r.data.tracks && r.data.tracks[0]) {
                L('  first=' + r.data.tracks[0].name);
            }
        } catch (e) {
            L('TEST3 SERVER-ENDPOINT: FAIL status=' + e.response?.status);
            L('  data=' + JSON.stringify(e.response?.data));
        }

    } catch (e) {
        L('TOKEN FAIL: ' + JSON.stringify(e.response?.data || e.message));
    }
    
    fs.writeFileSync('./test_scripts/diag_output.txt', out.join('\n'), 'utf8');
}
run();

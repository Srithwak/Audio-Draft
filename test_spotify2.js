const fs = require('fs');
require('dotenv').config({ path: './database/.env' });
const axios = require('axios');
const querystring = require('querystring');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const log = [];
function L(msg) { log.push(msg); }

async function main() {
    L('Client ID: ' + (SPOTIFY_CLIENT_ID ? SPOTIFY_CLIENT_ID.substring(0,8) + '...' : 'MISSING'));
    L('Client Secret: ' + (SPOTIFY_CLIENT_SECRET ? SPOTIFY_CLIENT_SECRET.substring(0,8) + '...' : 'MISSING'));
    
    // 1. Get client credentials token
    let token = null;
    try {
        const res = await axios.post('https://accounts.spotify.com/api/token',
            querystring.stringify({ grant_type: 'client_credentials' }), {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        token = res.data.access_token;
        L('OK: Client credentials token obtained');
    } catch (err) {
        L('FAIL: Client credentials: ' + (err.response?.status || '') + ' ' + JSON.stringify(err.response?.data || err.message));
    }

    if (!token) {
        L('Cannot continue without token');
        fs.writeFileSync('test_results.log', log.join('\n'), 'utf8');
        process.exit(0);
    }

    // 2. Test public playlist (Today's Top Hits)
    try {
        const res = await axios.get('https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM5M/tracks', {
            headers: { 'Authorization': 'Bearer ' + token },
            params: { limit: 3 }
        });
        L('OK: Public playlist tracks fetched. Total: ' + res.data.total);
        (res.data.items || []).forEach((item, i) => {
            if (item.track) {
                L('  Track ' + (i+1) + ': ' + item.track.name + ' by ' + (item.track.artists || []).map(a => a.name).join(', '));
            }
        });
    } catch (err) {
        L('FAIL: Public playlist tracks: ' + (err.response?.status || '') + ' ' + JSON.stringify(err.response?.data || err.message));
    }

    // 3. Test through our server endpoint (as a non-Spotify-connected user)
    try {
        const res = await axios.get('http://127.0.0.1:3000/api/spotify/playlists/37i9dQZF1DXcBWIGoYBM5M/tracks', {
            headers: { 'Authorization': 'Bearer fake-user-id-123' }
        });
        L('OK: Server endpoint returned: ' + JSON.stringify(res.data).substring(0, 300));
    } catch (err) {
        L('FAIL: Server endpoint: ' + (err.response?.status || '') + ' ' + JSON.stringify(err.response?.data || err.message));
    }

    // 4. Test through our server - getting user's playlists
    try {
        const res = await axios.get('http://127.0.0.1:3000/api/spotify/playlists', {
            headers: { 'Authorization': 'Bearer fake-user-id-123' }
        });
        L('Server /api/spotify/playlists returned: ' + (res.status) + ' ' + JSON.stringify(res.data).substring(0, 200));
    } catch (err) {
        L('Server /api/spotify/playlists returned: ' + (err.response?.status || '') + ' ' + JSON.stringify(err.response?.data || err.message));
    }

    fs.writeFileSync('test_results.log', log.join('\n'), 'utf8');
    L('Results written to test_results.log');
}

main().catch(err => {
    L('Unhandled error: ' + err.message);
    fs.writeFileSync('test_results.log', log.join('\n'), 'utf8');
});

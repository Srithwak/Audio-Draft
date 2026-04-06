const axios = require('axios');
const qs = require('querystring');
const fs = require('fs');
require('dotenv').config({ path: './database/.env' });

async function run() {
    const out = [];
    
    try {
        const tokenRes = await axios.post('https://accounts.spotify.com/api/token', 
            qs.stringify({ grant_type: 'client_credentials' }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')}`
            }
        });
        const token = tokenRes.data.access_token;
        out.push('token_ok');

        // Test: Playlist tracks WITHOUT fields param using client creds
        const pid = '37i9dQZEVXbMDoHDwVN2tF';
        try {
            const r = await axios.get(`https://api.spotify.com/v1/playlists/${pid}/tracks`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { limit: 3 }
            });
            out.push('direct_api_ok');
            out.push('total_' + r.data.total);
        } catch (e) {
            out.push('direct_api_fail');
            out.push('status_' + e.response?.status);
            out.push('msg_' + (e.response?.data?.error?.message || 'unknown'));
        }

        // Test via server
        try {
            const r = await axios.get(`http://127.0.0.1:3000/api/spotify/playlists/${pid}/tracks`, {
                headers: { 'Authorization': 'Bearer test123' }
            });
            out.push('server_ok');
            out.push('trk_count_' + (r.data.tracks?.length || 0));
        } catch (e) {
            out.push('server_fail');
            out.push('srv_status_' + e.response?.status);
            out.push('srv_msg_' + (e.response?.data?.error || 'unknown'));
        }

    } catch (e) {
        out.push('token_fail');
        out.push(JSON.stringify(e.response?.data || e.message));
    }
    
    // Write each item on its own line
    fs.writeFileSync('./test_scripts/result.txt', out.join('\n'), 'utf8');
}
run();

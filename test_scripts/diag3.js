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

        // Test a public playlist that should work (Spotify editorial)
        const testIds = [
            '37i9dQZF1DXcBWIGoYBM5M',
            '37i9dQZF1DX0XUsuxWHRQd',
            '5ABHKGoOzxkaa28ttQV9sE'
        ];
        
        for (const pid of testIds) {
            try {
                const r = await axios.get(`https://api.spotify.com/v1/playlists/${pid}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                out.push(`playlist_${pid.substring(0,8)}_ok_${r.data.name}`);
                
                // Now try tracks
                try {
                    const tr = await axios.get(`https://api.spotify.com/v1/playlists/${pid}/tracks`, {
                        headers: { 'Authorization': `Bearer ${token}` },
                        params: { limit: 2 }
                    });
                    out.push(`tracks_ok_total_${tr.data.total}`);
                } catch (te) {
                    out.push(`tracks_fail_${te.response?.status}_${te.response?.data?.error?.message}`);
                }
            } catch (e) {
                out.push(`playlist_${pid.substring(0,8)}_fail_${e.response?.status}`);
            }
        }

        // Now check if server is running and test
        try {
            const r = await axios.get('http://127.0.0.1:3000/', { timeout: 3000 });
            out.push('server_running');
        } catch (e) {
            out.push('server_not_running');
        }

    } catch (e) {
        out.push('token_fail');
    }
    
    fs.writeFileSync('./test_scripts/result2.txt', out.join('\n'), 'utf8');
}
run();

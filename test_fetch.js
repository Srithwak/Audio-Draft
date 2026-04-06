const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
const PORT = 8888;

// Hardcoded explicit credentials
const CLIENT_ID = 'de6472af99064239960e491418bb85b5';
const CLIENT_SECRET = '4c20ea7d89c4420ca97e430d3f810280';
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

// The playlist we want to test
const TEST_PLAYLIST_ID = '5WljUurUGG7DAHvnaWYLK5';

app.get('/login', (req, res) => {
    const scope = 'playlist-read-private playlist-read-collaborative';
    const authUrl = 'https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URI
        });
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code || null;

    if (!code) {
        return res.send('Error: No code provided');
    }

    try {
        // 1. Get User Token
        const tokenResponse = await axios.post('https://accounts.spotify.com/api/token',
            querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }), {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = tokenResponse.data.access_token;
        console.log('\n✅ Successfully authenticated with User Token!');

        // 2. Fetch Playlist Tracks
        console.log(`\nFetching tracks for playlist: ${TEST_PLAYLIST_ID}...`);
        
        try {
            const tracksResponse = await axios.get(`https://api.spotify.com/v1/playlists/${TEST_PLAYLIST_ID}/tracks`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                params: { limit: 50 }
            });

            console.log('\n=== PLAYLIST TRACKS ===');
            const items = tracksResponse.data.items;
            
            if (items.length === 0) {
                console.log('Playlist is empty.');
                return res.send('<h2>Playlist is empty.</h2>');
            }

            let htmlResponse = '<h2>Successfully Loaded Tracks:</h2><ul>';
            items.forEach((item, index) => {
                const t = item.track;
                const artists = t.artists.map(a => a.name).join(', ');
                const text = `${index + 1}. ${t.name} - ${artists}`;
                console.log(text);
                htmlResponse += `<li>${text}</li>`;
            });
            htmlResponse += '</ul><p>Check your console for the same output!</p>';

            res.send(htmlResponse);
            
            // Clean up and exit
            setTimeout(() => {
                console.log('\nTest complete. Exiting script.');
                process.exit(0);
            }, 1000);

        } catch (apiErr) {
            console.error('\n❌ Failed to fetch tracks!');
            console.error('Status:', apiErr.response?.status);
            console.error('Message:', JSON.stringify(apiErr.response?.data || apiErr.message));
            res.send(`<h2>Failed to fetch tracks!</h2><p>Error: ${apiErr.response?.status} - ${JSON.stringify(apiErr.response?.data)}</p>`);
        }

    } catch (authErr) {
        console.error('Auth Failed:', authErr.response?.data || authErr.message);
        res.send('Failed to authenticate');
    }
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Spotify Playlist Fetch Test Started `);
    console.log(`=========================================`);
    console.log(`\nIMPORTANT: Spotify requires a USER token to get playlist tracks in Development Mode.`);
    console.log(`Please open your browser and go to this exact URL to login:`);
    console.log(`\n    http://localhost:${PORT}/login\n`);
    console.log(`Waiting for you to log in...`);
});

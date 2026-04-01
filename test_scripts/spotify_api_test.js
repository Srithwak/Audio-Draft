require('dotenv').config({ path: './database/.env' });
const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');

// const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
// const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const SPOTIFY_CLIENT_ID = "de6472af99064239960e491418bb85b5";
const SPOTIFY_CLIENT_SECRET = "4c20ea7d89c4420ca97e430d3f810280";

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error("FATAL: Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in database/.env");
    console.error("Add these lines to database/.env:");
    console.error('  SPOTIFY_CLIENT_ID="your_client_id_here"');
    console.error('  SPOTIFY_CLIENT_SECRET="your_client_secret_here"');
    process.exit(1);
}

const scopes = [
    'user-read-private',
    'user-read-recently-played',
    'user-top-read',
    'user-read-playback-state'
];

const spotifyApi = new SpotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    redirectUri: 'http://127.0.0.1:5001/spotify/callback'
});

const app = express();
const PORT = 5001;

function pretty(label, data) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${label}`);
    console.log(`${'='.repeat(60)}`);
    console.log(JSON.stringify(data, null, 2));
}

app.get('/login', (req, res) => {
    res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

app.get('/spotify/callback', async (req, res) => {
    const error = req.query.error;
    const code = req.query.code;

    if (error) {
        console.error('Callback Error:', error);
        return res.send(`Callback Error: ${error}`);
    }

    try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        const access_token = data.body['access_token'];
        const refresh_token = data.body['refresh_token'];

        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);

        res.send('Success! You can now close this window and look at your terminal.');

        await runSpotifyTests();
        process.exit(0);

    } catch (error) {
        console.error('Error getting Tokens:', error);
        res.send(`Error getting Tokens: ${error.message}`);
    }
});

async function runSpotifyTests() {
    try {
        const me = await spotifyApi.getMe();
        pretty("USER PROFILE", me.body);

        const timeRanges = ['short_term', 'medium_term', 'long_term'];

        for (const timeRange of timeRanges) {
            const topArtists = await spotifyApi.getMyTopArtists({ limit: 10, time_range: timeRange });
            pretty(`TOP ARTISTS — ${timeRange}`, topArtists.body.items.map(a => ({
                name: a.name,
                genres: a.genres || [],
                popularity: a.popularity
            })));
        }

        for (const timeRange of timeRanges) {
            const topTracks = await spotifyApi.getMyTopTracks({ limit: 10, time_range: timeRange });
            pretty(`TOP TRACKS — ${timeRange}`, topTracks.body.items.map(t => ({
                name: t.name,
                artist: t.artists[0]?.name,
                album: t.album.name
            })));
        }

        const recent = await spotifyApi.getMyRecentlyPlayedTracks({ limit: 20 });
        pretty("RECENTLY PLAYED", recent.body.items.map(i => ({
            name: i.track.name,
            artist: i.track.artists[0]?.name,
            played_at: i.played_at
        })));

        const current = await spotifyApi.getMyCurrentPlaybackState();
        if (current.body && current.body.item) {
            pretty("CURRENTLY PLAYING", {
                name: current.body.item.name,
                artist: current.body.item.artists[0]?.name,
                is_playing: current.body.is_playing,
                device: current.body.device?.name
            });
        } else {
            console.log("\n(Nothing currently playing)");
        }

        console.log("\n✅ Done!");
    } catch (error) {
        console.error("\n❌ Error during Spotify API calls:", error);
    }
}

app.listen(PORT, () => {
    console.log(`Server is running to handle Spotify OAuth callback.`);
    console.log(`👉 Please open your browser to: http://127.0.0.1:${PORT}/login to authenticate.`);
});

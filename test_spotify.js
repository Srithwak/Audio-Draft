// Quick diagnostic script to test Spotify token flows
require('dotenv').config({ path: './database/.env' });
const axios = require('axios');
const querystring = require('querystring');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function testClientCredentials() {
    console.log('=== Testing Client Credentials Flow ===');
    console.log('Client ID:', SPOTIFY_CLIENT_ID ? SPOTIFY_CLIENT_ID.substring(0,8) + '...' : 'MISSING');
    console.log('Client Secret:', SPOTIFY_CLIENT_SECRET ? SPOTIFY_CLIENT_SECRET.substring(0,8) + '...' : 'MISSING');
    
    try {
        const res = await axios.post('https://accounts.spotify.com/api/token',
            querystring.stringify({ grant_type: 'client_credentials' }), {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log('✓ Client credentials token obtained!');
        console.log('  Token prefix:', res.data.access_token.substring(0, 20) + '...');
        console.log('  Expires in:', res.data.expires_in, 'seconds');
        return res.data.access_token;
    } catch (err) {
        console.error('✗ Client credentials FAILED:', err.response?.status, err.response?.data);
        return null;
    }
}

async function testPlaylistTracks(token, playlistId) {
    console.log(`\n=== Testing Playlist Tracks (${playlistId}) ===`);
    try {
        const res = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { limit: 5 }
        });
        console.log('✓ Playlist tracks fetched!');
        console.log('  Total tracks:', res.data.total);
        if (res.data.items && res.data.items.length > 0) {
            res.data.items.forEach((item, i) => {
                if (item.track) {
                    console.log(`  [${i+1}] ${item.track.name} by ${item.track.artists?.map(a => a.name).join(', ')}`);
                }
            });
        }
        return true;
    } catch (err) {
        console.error('✗ Playlist tracks FAILED:', err.response?.status, JSON.stringify(err.response?.data, null, 2));
        return false;
    }
}

async function testGetPlaylists(token) {
    console.log('\n=== Testing Search for a Public Playlist ===');
    try {
        // Try to get a well-known public playlist (Spotify's "Today's Top Hits")
        const res = await axios.get(`https://api.spotify.com/v1/playlists/37i9dQZF1DXcBWIGoYBM5M`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('✓ Public playlist fetched:', res.data.name);
        console.log('  Owner:', res.data.owner?.display_name);
        console.log('  Tracks total:', res.data.tracks?.total);
        return res.data.id;
    } catch (err) {
        console.error('✗ Public playlist fetch FAILED:', err.response?.status, JSON.stringify(err.response?.data, null, 2));
        return null;
    }
}

async function main() {
    const token = await testClientCredentials();
    if (!token) {
        console.log('\n❌ Cannot proceed without a token.');
        process.exit(1);
    }
    
    // Test with a well-known public playlist
    const playlistId = await testGetPlaylists(token);
    if (playlistId) {
        await testPlaylistTracks(token, playlistId);
    }
    
    // Also test the actual endpoint through our server
    console.log('\n=== Testing via our server API ===');
    try {
        // First, get playlists (need a user token for this)
        const serverRes = await axios.get('http://127.0.0.1:3000/api/spotify/playlists', {
            headers: { 'Authorization': 'Bearer test-user' }
        });
        console.log('Server playlists response:', serverRes.status, JSON.stringify(serverRes.data).substring(0, 200));
    } catch (err) {
        console.log('Server playlists response:', err.response?.status, JSON.stringify(err.response?.data));
    }
}

main();

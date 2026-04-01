require('dotenv').config({ path: './database/.env' });
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const path = require('path');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Fail-fast if .env is missing ---
const supabaseUrl = process.env.API_URL;
const ANON_PUBLIC_KEY = process.env.ANON_PUBLIC_KEY;

if (!supabaseUrl || !ANON_PUBLIC_KEY) {
    console.error("FATAL: Missing API_URL or ANON_PUBLIC_KEY in database/.env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, ANON_PUBLIC_KEY);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Test connection
supabase.from('users').select('user_id').limit(1).then(({ error }) => {
    if (error) console.error("Error connecting to Supabase Users table:", error.message);
    else console.log("Connected to Supabase.");
});

const REDIRECT_URI = `http://127.0.0.1:${PORT}/spotify/callback`;

// --- Spotify credentials from .env ---
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.warn("WARNING: Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in database/.env — Spotify features disabled.");
}

// In-memory token storage (per user)
const spotifyTokens = new Map();

// --- Auth Middleware ---
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split(' ')[1]; // user_id as token (simple auth)
    req.user = { user_id: token };
    next();
};

// --- Spotify Token Helper (in-memory, no database) ---
async function getValidSpotifyToken(userId) {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        return { error: "Spotify not configured on server", token: null };
    }

    const stored = spotifyTokens.get(userId);
    if (!stored || !stored.refresh_token) {
        return { error: "Spotify not connected. Go to Settings to connect.", token: null };
    }

    let token = stored.access_token;

    // Refresh if expired or no token yet
    if (!token || !stored.expires_at || new Date(stored.expires_at) <= new Date()) {
        try {
            const refreshRes = await axios.post('https://accounts.spotify.com/api/token',
                querystring.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: stored.refresh_token
                }), {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            token = refreshRes.data.access_token;
            const expires_at = new Date(Date.now() + refreshRes.data.expires_in * 1000).toISOString();
            spotifyTokens.set(userId, { ...stored, access_token: token, expires_at });
        } catch (err) {
            console.error("Spotify token refresh failed:", err.response?.data || err.message);
            return { error: "Spotify token refresh failed", token: null };
        }
    }

    return { error: null, token };
}

// --- Root route ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// --- Register ---
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const { data: existingUsers, error: checkError } = await supabase
            .from('users')
            .select('user_id')
            .or(`email.eq.${email},username.eq.${username}`);

        if (checkError) throw checkError;

        if (existingUsers && existingUsers.length > 0) {
            return res.status(400).json({ error: "Username or email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const { data: insertData, error: insertError } = await supabase
            .from('users')
            .insert([{ username, email, password_hash }])
            .select('user_id, username, email, theme_pref');

        if (insertError) throw insertError;

        res.status(201).json({
            message: "Account created successfully",
            user: {
                id: insertData[0].user_id,
                username: insertData[0].username,
                email: insertData[0].email,
                theme_pref: insertData[0].theme_pref
            }
        });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// --- Login ---
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
    }

    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('user_id, username, email, password_hash, theme_pref')
            .eq('email', email);

        if (error) throw error;

        if (!users || users.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        res.json({
            message: "Login successful",
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                theme_pref: user.theme_pref
            }
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// --- Get current user profile ---
app.get('/api/auth/me', authenticateUser, async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('user_id, username, email, theme_pref')
            .eq('user_id', req.user.user_id);

        if (error) throw error;
        if (!users || users.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            user: {
                id: users[0].user_id,
                username: users[0].username,
                email: users[0].email,
                theme_pref: users[0].theme_pref
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Spotify Credentials (now server-side from .env, this is a no-op kept for frontend compat) ---
app.post('/api/settings/spotify', authenticateUser, async (req, res) => {
    // Credentials are now in .env, this endpoint just acknowledges
    res.json({ message: "Spotify credentials are configured on the server." });
});

// --- Update Theme Preference ---
app.put('/api/settings/theme', authenticateUser, async (req, res) => {
    const { theme_pref } = req.body;
    const user_id = req.user.user_id;

    if (!theme_pref || !['light', 'dark'].includes(theme_pref)) {
        return res.status(400).json({ error: "Invalid theme preference" });
    }

    try {
        const { error } = await supabase
            .from('users')
            .update({ theme_pref })
            .eq('user_id', user_id);

        if (error) throw error;
        res.json({ message: "Theme preference updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Blocked Entities ---
app.get('/api/blocks', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('blocked_entities')
            .select('block_id, entity_type, entity_value, created_at')
            .eq('user_id', req.user.user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ blocks: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/blocks', authenticateUser, async (req, res) => {
    const { entity_type, entity_value } = req.body;

    if (!entity_type || !entity_value) {
        return res.status(400).json({ error: "Missing type or value" });
    }

    try {
        const { error } = await supabase
            .from('blocked_entities')
            .insert([{
                user_id: req.user.user_id,
                entity_type,
                entity_value,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        res.status(201).json({ message: "Added to block list" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/blocks/:id', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabase
            .from('blocked_entities')
            .delete()
            .eq('block_id', req.params.id)
            .eq('user_id', req.user.user_id);

        if (error) throw error;
        res.json({ message: "Block removed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Notifications ---
app.get('/api/notifications', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('notification_id, type, message, is_read, created_at')
            .eq('user_id', req.user.user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ notifications: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notifications/:id/read', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('notification_id', req.params.id)
            .eq('user_id', req.user.user_id);

        if (error) throw error;
        res.json({ message: "Notification marked as read" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Playlists & Collaboration ---
app.get('/api/playlists', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('playlists')
            .select('playlist_id, name, description, is_collaborative, created_at')
            .eq('creator_id', req.user.user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ playlists: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/playlists', authenticateUser, async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Playlist name is required" });
    }

    try {
        const { error } = await supabase
            .from('playlists')
            .insert([{
                creator_id: req.user.user_id,
                name,
                description,
                is_collaborative: false,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        res.status(201).json({ message: "Playlist created" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/playlists/:id/invite', authenticateUser, async (req, res) => {
    const playlistId = req.params.id;
    const { identifier } = req.body;

    if (!identifier) {
        return res.status(400).json({ error: "User identifier required" });
    }

    try {
        // 1. Find target user
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('user_id, username')
            .or(`email.eq.${identifier},username.eq.${identifier}`);

        if (userError) throw userError;
        if (!users || users.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const targetUserId = users[0].user_id;
        if (targetUserId === req.user.user_id) {
            return res.status(400).json({ error: "Cannot invite yourself" });
        }

        // 2. Insert into Playlist_Collaborators
        const { error: collabError } = await supabase
            .from('playlist_collaborators')
            .insert([{
                playlist_id: playlistId,
                user_id: targetUserId
            }]);

        if (collabError && !collabError.message.includes('duplicate key value')) {
            throw collabError;
        }

        // 3. Update playlist to collaborative
        await supabase
            .from('playlists')
            .update({ is_collaborative: true })
            .eq('playlist_id', playlistId);

        // 4. Send Notification to target user
        await supabase
            .from('notifications')
            .insert([{
                user_id: targetUserId,
                type: 'SYSTEM',
                message: 'You have been invited to collaborate on a playlist.',
                is_read: false,
                created_at: new Date().toISOString()
            }]);

        res.json({ message: "User invited successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Social System (Search & Friends) ---
app.get('/api/users/search', authenticateUser, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json({ users: [] });

    try {
        const { data, error } = await supabase
            .from('users')
            .select('user_id, username, email')
            .or(`username.ilike.%${q}%,email.ilike.%${q}%`)
            .neq('user_id', req.user.user_id)
            .limit(10);

        if (error) throw error;
        res.json({ users: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/friends', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('friendships')
            .select('friend_id, user_id_1, user_id_2, status, requester_id, user1:user_id_1(username), user2:user_id_2(username)')
            .or(`user_id_1.eq.${req.user.user_id},user_id_2.eq.${req.user.user_id}`);

        if (error) throw error;
        res.json({ friendships: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/friends/request', authenticateUser, async (req, res) => {
    const target_user_id = req.body.target_user_id;
    const current_user_id = req.user.user_id;

    if (!target_user_id) return res.status(400).json({ error: "Target User ID required" });
    if (target_user_id === current_user_id) return res.status(400).json({ error: "Cannot add yourself" });

    // Respect schema constraint user_id_1 < user_id_2
    const [u1, u2] = [current_user_id, target_user_id].sort();

    try {
        const { data: existing } = await supabase
            .from('friendships')
            .select('friend_id')
            .eq('user_id_1', u1)
            .eq('user_id_2', u2);

        if (existing && existing.length > 0) {
            return res.status(400).json({ error: "Friendship already exists or is pending" });
        }

        const { error } = await supabase
            .from('friendships')
            .insert([{ user_id_1: u1, user_id_2: u2, status: 'PENDING', requester_id: current_user_id }]);

        if (error) throw error;

        // Send notification
        await supabase.from('notifications').insert([{
            user_id: target_user_id,
            type: 'FRIEND_REQUEST',
            message: 'You received a friend request!',
            is_read: false
        }]);

        res.json({ message: "Friend request sent" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/friends/accept', authenticateUser, async (req, res) => {
    const { friend_id } = req.body;
    try {
        const { error } = await supabase
            .from('friendships')
            .update({ status: 'ACCEPTED' })
            .eq('friend_id', friend_id)
            .eq('user_id_2', req.user.user_id);

        if (error) throw error;
        res.json({ message: "Friend request accepted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/friends/:id', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('friend_id', req.params.id)
            .or(`user_id_1.eq.${req.user.user_id},user_id_2.eq.${req.user.user_id}`);

        if (error) throw error;
        res.json({ message: "Friendship removed/declined" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Spotify Status ---
app.get('/api/spotify/status', authenticateUser, async (req, res) => {
    const hasServerCreds = !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
    const hasUserTokens = spotifyTokens.has(req.user.user_id);
    res.json({ configured: hasServerCreds, connected: hasUserTokens });
});

// --- Spotify Auth URL ---
app.get('/api/spotify/auth-url', authenticateUser, async (req, res) => {
    if (!SPOTIFY_CLIENT_ID) {
        return res.status(400).json({ error: "Spotify Client ID not configured on server" });
    }

    const scope = 'user-read-currently-playing user-read-playback-state user-top-read user-read-recently-played playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private';
    const url = 'https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: SPOTIFY_CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URI,
            state: req.user.user_id
        });

    res.json({ url });
});

// --- Spotify OAuth Callback ---
app.get('/spotify/callback', async (req, res) => {
    const { code, state: user_id } = req.query;

    if (!code) return res.redirect('/settings.html?error=no_code');

    try {
        const tokenRes = await axios.post('https://accounts.spotify.com/api/token',
            querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }), {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in } = tokenRes.data;
        const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

        // Store tokens in memory
        spotifyTokens.set(user_id, { access_token, refresh_token, expires_at });
        console.log(`Spotify connected for user ${user_id}`);

        res.redirect('/settings.html?success=spotify_connected');
    } catch (err) {
        console.error("Spotify Callback Error:", err.response?.data || err.message);
        res.redirect('/settings.html?error=spotify_auth_failed');
    }
});

// --- Spotify Currently Playing (with device info) ---
app.get('/api/spotify/currently-playing', authenticateUser, async (req, res) => {
    try {
        const { error: tokenError, token } = await getValidSpotifyToken(req.user.user_id);
        if (tokenError) return res.json({ playing: false });

        const spotifyRes = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (spotifyRes.status === 204 || !spotifyRes.data || !spotifyRes.data.item) {
            return res.json({ playing: false });
        }

        const track = spotifyRes.data.item;

        // Also fetch active devices for richer info
        let deviceName = 'Unknown Device';
        let deviceType = 'unknown';
        try {
            const devicesRes = await axios.get('https://api.spotify.com/v1/me/player/devices', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const active = devicesRes.data.devices?.find(d => d.is_active);
            if (active) {
                deviceName = active.name;
                deviceType = active.type?.toLowerCase() || 'unknown';
            }
        } catch (e) { /* device info is optional */ }

        const progress = spotifyRes.data.progress_ms || 0;
        const duration = track.duration_ms || 1;

        res.json({
            playing: true,
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            album: track.album.name,
            album_art: track.album.images[0]?.url,
            progress_ms: progress,
            duration_ms: duration,
            progress_pct: Math.round((progress / duration) * 100),
            device_name: deviceName,
            device_type: deviceType,
            is_playing: spotifyRes.data.is_playing
        });
    } catch (err) {
        res.json({ playing: false });
    }
});

// --- User's Spotify Playlists ---
app.get('/api/spotify/playlists', authenticateUser, async (req, res) => {
    try {
        const { error: tokenError, token } = await getValidSpotifyToken(req.user.user_id);
        if (tokenError) return res.status(401).json({ error: tokenError });

        const spotifyRes = await axios.get('https://api.spotify.com/v1/me/playlists', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { limit: 20 }
        });

        const playlists = spotifyRes.data.items.map(pl => ({
            id: pl.id,
            name: pl.name,
            description: pl.description || '',
            image: pl.images?.[0]?.url || null,
            track_count: pl.tracks?.total || 0,
            owner: pl.owner?.display_name || 'Unknown',
            external_url: pl.external_urls?.spotify || null,
            is_collaborative: pl.collaborative
        }));

        res.json({ playlists });
    } catch (err) {
        console.error("Spotify Playlists Error:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- Playlist Tracks ---
app.get('/api/spotify/playlists/:playlistId/tracks', authenticateUser, async (req, res) => {
    try {
        const { error: tokenError, token } = await getValidSpotifyToken(req.user.user_id);
        if (tokenError) return res.status(401).json({ error: tokenError });

        const spotifyRes = await axios.get(`https://api.spotify.com/v1/playlists/${req.params.playlistId}/tracks`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { limit: 50, fields: 'items(track(name,artists(name),album(name,images),duration_ms,external_urls,uri,id))' }
        });

        const tracks = spotifyRes.data.items
            .filter(item => item.track)
            .map(item => ({
                name: item.track.name,
                artist: item.track.artists.map(a => a.name).join(', '),
                album: item.track.album.name,
                image: item.track.album.images?.[2]?.url || item.track.album.images?.[0]?.url || null,
                duration_ms: item.track.duration_ms,
                external_url: item.track.external_urls?.spotify || null,
                uri: item.track.uri || null,
                id: item.track.id || null
            }));

        res.json({ tracks });
    } catch (err) {
        console.error("Playlist Tracks Error:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- Analytics (Real Spotify Data) ---
app.get('/api/analytics', authenticateUser, async (req, res) => {
    const timeframe = req.query.timeframe || 'short_term';
    const validTimeframes = ['short_term', 'medium_term', 'long_term'];
    if (!validTimeframes.includes(timeframe)) {
        return res.status(400).json({ error: "Invalid timeframe. Use short_term, medium_term, or long_term." });
    }

    try {
        const { error: tokenError, token } = await getValidSpotifyToken(req.user.user_id);
        if (tokenError) return res.status(401).json({ error: tokenError });

        const [artistsRes, tracksRes, recentRes] = await Promise.all([
            axios.get('https://api.spotify.com/v1/me/top/artists', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { time_range: timeframe, limit: 10 }
            }),
            axios.get('https://api.spotify.com/v1/me/top/tracks', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { time_range: timeframe, limit: 10 }
            }),
            axios.get('https://api.spotify.com/v1/me/player/recently-played', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { limit: 10 }
            }).catch(() => ({ data: { items: [] } }))
        ]);

        const artists = artistsRes.data.items.map(a => ({
            name: a.name,
            image: a.images?.[1]?.url || a.images?.[0]?.url || null,
            genres: (a.genres || []).slice(0, 3)
        }));

        const tracks = tracksRes.data.items.map(t => ({
            name: t.name,
            artist: t.artists.map(a => a.name).join(', '),
            album: t.album.name,
            image: t.album.images?.[1]?.url || t.album.images?.[0]?.url || null,
            duration_ms: t.duration_ms
        }));

        const recent = recentRes.data.items.map(i => ({
            name: i.track.name,
            artist: i.track.artists.map(a => a.name).join(', '),
            played_at: i.played_at,
            image: i.track.album.images?.[2]?.url || i.track.album.images?.[0]?.url || null
        }));

        const genreCounts = {};
        artists.forEach(a => {
            (a.genres || []).forEach(g => {
                genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
        });
        const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

        res.json({
            genre: topGenre !== 'Unknown' ? topGenre : null,
            top_artist: artists[0]?.name || null,
            top_track: tracks[0]?.name || null,
            top_track_artist: tracks[0]?.artist || null,
            track_count: tracks.length,
            artists,
            tracks,
            recent
        });
    } catch (err) {
        console.error("Analytics Error:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===================================================================
// NEW ENDPOINTS — Fulfilling all test use cases
// ===================================================================

// --- UC2: Create Playlist from Description ---
app.post('/api/playlists/generate-from-description', authenticateUser, async (req, res) => {
    const { description } = req.body;
    if (!description || !description.trim()) {
        return res.status(400).json({ error: "Description is required" });
    }

    try {
        const { error: tokenError, token } = await getValidSpotifyToken(req.user.user_id);
        if (tokenError) return res.status(401).json({ error: tokenError });

        // Extract mood/genre keywords from the description
        const moodKeywords = {
            happy: ['happy', 'joy', 'cheerful', 'upbeat', 'excited', 'fun', 'celebration', 'party'],
            sad: ['sad', 'melancholy', 'heartbreak', 'lonely', 'crying', 'depressed', 'gloomy'],
            energetic: ['energetic', 'workout', 'gym', 'running', 'pump', 'hype', 'intense', 'power'],
            calm: ['calm', 'relax', 'peaceful', 'meditation', 'sleep', 'ambient', 'chill', 'soothing'],
            romantic: ['romantic', 'love', 'date', 'valentine', 'couple', 'passion'],
            angry: ['angry', 'rage', 'aggressive', 'metal', 'hardcore'],
            focus: ['focus', 'study', 'work', 'concentrate', 'productivity', 'coding'],
            road_trip: ['road trip', 'driving', 'travel', 'adventure', 'summer']
        };

        const genreKeywords = {
            pop: ['pop'],
            rock: ['rock', 'alternative', 'indie'],
            'hip-hop': ['hip hop', 'hip-hop', 'rap', 'trap'],
            electronic: ['electronic', 'edm', 'house', 'techno', 'dubstep'],
            jazz: ['jazz', 'blues', 'swing'],
            classical: ['classical', 'orchestra', 'symphony', 'piano'],
            country: ['country', 'folk', 'bluegrass'],
            'r-n-b': ['r&b', 'rnb', 'soul', 'funk'],
            latin: ['latin', 'reggaeton', 'salsa', 'bachata'],
            metal: ['metal', 'heavy metal', 'death metal']
        };

        const descLower = description.toLowerCase();
        let seedGenres = [];
        let searchQuery = description;

        // Find matching genres
        for (const [genre, keywords] of Object.entries(genreKeywords)) {
            if (keywords.some(kw => descLower.includes(kw))) {
                seedGenres.push(genre);
            }
        }
        if (seedGenres.length === 0) seedGenres = ['pop']; // default
        seedGenres = seedGenres.slice(0, 2);

        // Search Spotify for tracks matching the description
        const searchRes = await axios.get('https://api.spotify.com/v1/search', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                q: `genre:${seedGenres[0]} ${description.split(' ').slice(0, 3).join(' ')}`,
                type: 'track',
                limit: 20
            }
        });

        const tracks = (searchRes.data.tracks?.items || []).map(t => ({
            name: t.name,
            artist: t.artists.map(a => a.name).join(', '),
            album: t.album.name,
            image: t.album.images?.[1]?.url || t.album.images?.[0]?.url || null,
            duration_ms: t.duration_ms,
            uri: t.uri,
            id: t.id,
            external_url: t.external_urls?.spotify || null
        }));

        if (tracks.length === 0) {
            return res.status(404).json({ error: "No matching songs found for that description. Try different keywords." });
        }

        // Save the playlist to Supabase
        const playlistName = `${description.substring(0, 50)}`;
        const { data: plData, error: plError } = await supabase
            .from('playlists')
            .insert([{
                creator_id: req.user.user_id,
                name: playlistName,
                description: description,
                is_collaborative: false,
                created_at: new Date().toISOString()
            }])
            .select('playlist_id');

        if (plError) throw plError;

        res.json({
            message: "Playlist generated from description",
            playlist_id: plData?.[0]?.playlist_id || null,
            playlist_name: playlistName,
            tracks
        });
    } catch (err) {
        console.error("Generate from Description Error:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- UC3: Generate Playlist from Listening History ---
app.post('/api/playlists/generate-from-history', authenticateUser, async (req, res) => {
    try {
        const { error: tokenError, token } = await getValidSpotifyToken(req.user.user_id);
        if (tokenError) return res.status(401).json({ error: tokenError });

        // Get recently played + top tracks
        const [recentRes, topRes] = await Promise.all([
            axios.get('https://api.spotify.com/v1/me/player/recently-played', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { limit: 30 }
            }).catch(() => ({ data: { items: [] } })),
            axios.get('https://api.spotify.com/v1/me/top/tracks', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { time_range: 'short_term', limit: 20 }
            }).catch(() => ({ data: { items: [] } }))
        ]);

        const recentTracks = (recentRes.data.items || []).map(i => i.track);
        const topTracks = topRes.data.items || [];

        // Combine and deduplicate
        const trackMap = new Map();
        [...topTracks, ...recentTracks].forEach(t => {
            if (t && t.id && !trackMap.has(t.id)) {
                trackMap.set(t.id, {
                    name: t.name,
                    artist: t.artists.map(a => a.name).join(', '),
                    album: t.album.name,
                    image: t.album.images?.[1]?.url || t.album.images?.[0]?.url || null,
                    duration_ms: t.duration_ms,
                    uri: t.uri,
                    id: t.id,
                    external_url: t.external_urls?.spotify || null
                });
            }
        });

        const tracks = Array.from(trackMap.values()).slice(0, 25);

        if (tracks.length === 0) {
            return res.status(404).json({ error: "No listening history available. Listen to some music on Spotify first!" });
        }

        // Count existing history playlists
        const { data: existingPlaylists } = await supabase
            .from('playlists')
            .select('playlist_id')
            .eq('creator_id', req.user.user_id)
            .like('name', 'Your History Playlist%');

        const count = (existingPlaylists?.length || 0) + 1;
        const playlistName = `Your History Playlist #${count}`;

        const { data: plData, error: plError } = await supabase
            .from('playlists')
            .insert([{
                creator_id: req.user.user_id,
                name: playlistName,
                description: 'Generated from your listening history',
                is_collaborative: false,
                created_at: new Date().toISOString()
            }])
            .select('playlist_id');

        if (plError) throw plError;

        res.json({
            message: "Playlist generated from listening history",
            playlist_id: plData?.[0]?.playlist_id || null,
            playlist_name: playlistName,
            tracks
        });
    } catch (err) {
        console.error("Generate from History Error:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- UC4: Export Playlist to Spotify ---
app.post('/api/playlists/:id/export', authenticateUser, async (req, res) => {
    const playlistId = req.params.id;

    try {
        const { error: tokenError, token } = await getValidSpotifyToken(req.user.user_id);
        if (tokenError) return res.status(401).json({ error: "Spotify not connected. Go to Settings to connect your account." });

        // Get the playlist from Supabase
        const { data: playlists, error: plError } = await supabase
            .from('playlists')
            .select('name, description')
            .eq('playlist_id', playlistId);

        if (plError) throw plError;
        if (!playlists || playlists.length === 0) {
            return res.status(404).json({ error: "Playlist not found" });
        }

        const playlist = playlists[0];

        // Get Spotify user ID
        const meRes = await axios.get('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const spotifyUserId = meRes.data.id;

        // Create playlist on Spotify
        const createRes = await axios.post(
            `https://api.spotify.com/v1/users/${spotifyUserId}/playlists`,
            {
                name: playlist.name,
                description: playlist.description || 'Exported from Audio-Draft2',
                public: false
            },
            { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );

        const spotifyPlaylistId = createRes.data.id;

        // If we have track URIs in the request body, add them
        const { track_uris } = req.body;
        if (track_uris && track_uris.length > 0) {
            await axios.post(
                `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks`,
                { uris: track_uris.slice(0, 100) },
                { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );
        }

        // Record the export
        await supabase.from('playlist_exports').insert([{
            playlist_id: playlistId,
            user_id: req.user.user_id,
            spotify_playlist_id: spotifyPlaylistId,
            exported_at: new Date().toISOString(),
            status: 'SUCCESS'
        }]);

        // Send notification
        await supabase.from('notifications').insert([{
            user_id: req.user.user_id,
            type: 'EXPORT',
            message: `Playlist "${playlist.name}" exported to Spotify successfully!`,
            is_read: false,
            created_at: new Date().toISOString()
        }]);

        res.json({
            message: "Playlist exported to Spotify successfully",
            spotify_playlist_id: spotifyPlaylistId,
            spotify_url: `https://open.spotify.com/playlist/${spotifyPlaylistId}`
        });
    } catch (err) {
        console.error("Export Error:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- UC5: Collaboration — Add/Remove Songs, Permissions ---
app.post('/api/playlists/:id/songs', authenticateUser, async (req, res) => {
    const { song_name, artist, uri } = req.body;
    if (!song_name) return res.status(400).json({ error: "Song name is required" });

    try {
        // Check permission
        const playlistId = req.params.id;
        const userId = req.user.user_id;

        const { data: pl } = await supabase.from('playlists').select('creator_id').eq('playlist_id', playlistId);
        const isOwner = pl && pl[0] && pl[0].creator_id === userId;

        if (!isOwner) {
            const { data: collab } = await supabase.from('playlist_collaborators')
                .select('permission_level')
                .eq('playlist_id', playlistId)
                .eq('user_id', userId);

            if (!collab || collab.length === 0 || collab[0].permission_level === 'viewer') {
                return res.status(403).json({ error: "You don't have permission to add songs" });
            }
        }

        // Upsert song into Songs table
        let songId;
        const { data: existing } = await supabase.from('songs')
            .select('song_id')
            .eq('title', song_name)
            .eq('artist', artist || '')
            .limit(1);

        if (existing && existing.length > 0) {
            songId = existing[0].song_id;
        } else {
            const { data: newSong, error: songErr } = await supabase.from('songs')
                .insert([{ title: song_name, artist: artist || '', spotify_uri: uri || '' }])
                .select('song_id');
            if (songErr) throw songErr;
            songId = newSong[0].song_id;
        }

        // Create version entry
        const { data: version, error: verErr } = await supabase.from('playlist_versions')
            .insert([{
                playlist_id: playlistId,
                created_by: userId,
                snapshot_date: new Date().toISOString(),
                label: `Added ${song_name}`,
                is_manual: true
            }])
            .select('version_id');

        if (verErr) throw verErr;

        // Add song to playlist
        await supabase.from('playlist_songs').insert([{
            version_id: version[0].version_id,
            song_id: songId,
            added_by: userId,
            added_at: new Date().toISOString()
        }]);

        res.json({ message: "Song added to playlist" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/playlists/:id/songs/:songId', authenticateUser, async (req, res) => {
    try {
        const playlistId = req.params.id;
        const songId = req.params.songId;
        const userId = req.user.user_id;

        // Check permission
        const { data: pl } = await supabase.from('playlists').select('creator_id').eq('playlist_id', playlistId);
        const isOwner = pl && pl[0] && pl[0].creator_id === userId;

        if (!isOwner) {
            const { data: collab } = await supabase.from('playlist_collaborators')
                .select('permission_level')
                .eq('playlist_id', playlistId)
                .eq('user_id', userId);

            if (!collab || collab.length === 0 || collab[0].permission_level === 'viewer') {
                return res.status(403).json({ error: "You don't have permission to remove songs" });
            }
        }

        // Get version IDs for this playlist
        const { data: versions } = await supabase.from('playlist_versions')
            .select('version_id')
            .eq('playlist_id', playlistId);

        if (versions && versions.length > 0) {
            const versionIds = versions.map(v => v.version_id);
            await supabase.from('playlist_songs')
                .delete()
                .eq('song_id', songId)
                .in('version_id', versionIds);
        }

        res.json({ message: "Song removed from playlist" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/playlists/:id/permissions', authenticateUser, async (req, res) => {
    const { user_id: targetUserId, permission_level } = req.body;
    const validLevels = ['owner', 'editor', 'viewer'];

    if (!targetUserId || !permission_level || !validLevels.includes(permission_level)) {
        return res.status(400).json({ error: "Invalid user_id or permission_level (owner|editor|viewer)" });
    }

    try {
        // Only owner can change permissions
        const { data: pl } = await supabase.from('playlists')
            .select('creator_id')
            .eq('playlist_id', req.params.id);

        if (!pl || pl.length === 0 || pl[0].creator_id !== req.user.user_id) {
            return res.status(403).json({ error: "Only the playlist owner can change permissions" });
        }

        const { error } = await supabase.from('playlist_collaborators')
            .update({ permission_level })
            .eq('playlist_id', req.params.id)
            .eq('user_id', targetUserId);

        if (error) throw error;
        res.json({ message: "Permission updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- UC7: Compare Playlists ---
app.post('/api/playlists/compare', authenticateUser, async (req, res) => {
    const { playlist_id_1, playlist_id_2, tracks_1, tracks_2 } = req.body;

    if (!tracks_1 || !tracks_2) {
        return res.status(400).json({ error: "Both track lists are required for comparison" });
    }

    try {
        // Find common tracks by name+artist
        const set1 = new Map(tracks_1.map(t => [`${t.name.toLowerCase()}|${t.artist.toLowerCase()}`, t]));
        const commonTracks = [];
        const uniqueTo2 = [];

        tracks_2.forEach(t => {
            const key = `${t.name.toLowerCase()}|${t.artist.toLowerCase()}`;
            if (set1.has(key)) {
                commonTracks.push(t);
                set1.delete(key);
            } else {
                uniqueTo2.push(t);
            }
        });

        const uniqueTo1 = Array.from(set1.values());

        // Calculate similarity percentage
        const totalUnique = new Set([
            ...tracks_1.map(t => `${t.name.toLowerCase()}|${t.artist.toLowerCase()}`),
            ...tracks_2.map(t => `${t.name.toLowerCase()}|${t.artist.toLowerCase()}`)
        ]).size;
        const similarity = totalUnique > 0 ? Math.round((commonTracks.length / totalUnique) * 100) : 0;

        // Genre comparison (extract from artist names as a proxy)
        const getArtists = (tracks) => {
            const artists = {};
            tracks.forEach(t => {
                (t.artist || '').split(', ').forEach(a => {
                    artists[a] = (artists[a] || 0) + 1;
                });
            });
            return Object.entries(artists).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
        };

        res.json({
            similarity_pct: similarity,
            common_tracks: commonTracks,
            unique_to_playlist_1: uniqueTo1,
            unique_to_playlist_2: uniqueTo2,
            playlist_1_count: tracks_1.length,
            playlist_2_count: tracks_2.length,
            common_count: commonTracks.length,
            top_artists_1: getArtists(tracks_1),
            top_artists_2: getArtists(tracks_2)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- UC9: Trending Songs ---
app.get('/api/trending', authenticateUser, async (req, res) => {
    try {
        const { error: tokenError, token } = await getValidSpotifyToken(req.user.user_id);
        if (tokenError) return res.status(401).json({ error: tokenError });

        // Get global top 50 from Spotify's "Top 50 - Global" playlist
        // Spotify's curated global top 50 playlist ID
        const globalTop50Id = '37i9dQZEVXbMDoHDwVN2tF';

        const spotifyRes = await axios.get(`https://api.spotify.com/v1/playlists/${globalTop50Id}/tracks`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { limit: 50, fields: 'items(track(name,artists(name),album(name,images),duration_ms,external_urls,popularity,uri,id))' }
        });

        let tracks = spotifyRes.data.items
            .filter(item => item.track)
            .map((item, index) => ({
                rank: index + 1,
                name: item.track.name,
                artist: item.track.artists.map(a => a.name).join(', '),
                album: item.track.album.name,
                image: item.track.album.images?.[1]?.url || item.track.album.images?.[0]?.url || null,
                duration_ms: item.track.duration_ms,
                popularity: item.track.popularity || 0,
                external_url: item.track.external_urls?.spotify || null,
                uri: item.track.uri || null,
                id: item.track.id || null
            }));

        // Sort by popularity (descending), then alphabetically for ties
        tracks.sort((a, b) => {
            if (b.popularity !== a.popularity) return b.popularity - a.popularity;
            return a.name.localeCompare(b.name);
        });

        // Re-rank after sorting
        tracks = tracks.map((t, i) => ({ ...t, rank: i + 1 }));

        res.json({ tracks });
    } catch (err) {
        console.error("Trending Error:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- UC11: Tag Songs with Mood Descriptors ---
app.get('/api/mood-tags', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('mood_tag_definitions')
            .select('tag_def_id, label, description')
            .order('label');

        if (error) throw error;
        res.json({ tags: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/songs/mood', authenticateUser, async (req, res) => {
    const { song_name, artist, mood_label, spotify_uri } = req.body;

    if (!song_name || !mood_label) {
        return res.status(400).json({ error: "Song name and mood label are required" });
    }

    try {
        // Find or create the song
        let songId;
        const { data: existing } = await supabase.from('songs')
            .select('song_id')
            .eq('title', song_name)
            .limit(1);

        if (existing && existing.length > 0) {
            songId = existing[0].song_id;
        } else {
            const { data: newSong, error: songErr } = await supabase.from('songs')
                .insert([{ title: song_name, artist: artist || '', spotify_uri: spotify_uri || '' }])
                .select('song_id');
            if (songErr) throw songErr;
            songId = newSong[0].song_id;
        }

        // Find or create mood tag definition
        let tagDefId;
        const { data: existingTag } = await supabase.from('mood_tag_definitions')
            .select('tag_def_id')
            .eq('label', mood_label)
            .limit(1);

        if (existingTag && existingTag.length > 0) {
            tagDefId = existingTag[0].tag_def_id;
        } else {
            const { data: newTag, error: tagErr } = await supabase.from('mood_tag_definitions')
                .insert([{ label: mood_label, description: mood_label }])
                .select('tag_def_id');
            if (tagErr) throw tagErr;
            tagDefId = newTag[0].tag_def_id;
        }

        // Add mood tag
        const { error } = await supabase.from('mood_tags')
            .insert([{
                song_id: songId,
                user_id: req.user.user_id,
                label: tagDefId,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        res.json({ message: "Mood tag added" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/songs/mood/:songName', authenticateUser, async (req, res) => {
    try {
        const songName = decodeURIComponent(req.params.songName);
        const { data: songs } = await supabase.from('songs')
            .select('song_id')
            .eq('title', songName)
            .limit(1);

        if (!songs || songs.length === 0) {
            return res.json({ moods: [] });
        }

        const { data: tags, error } = await supabase.from('mood_tags')
            .select('tag_id, label, created_at, mood_tag_definitions!inner(label)')
            .eq('song_id', songs[0].song_id);

        if (error) throw error;

        const moods = (tags || []).map(t => ({
            tag_id: t.tag_id,
            label: t.mood_tag_definitions?.label || 'Unknown',
            created_at: t.created_at
        }));

        res.json({ moods });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/songs/mood/:tagId', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabase.from('mood_tags')
            .delete()
            .eq('tag_id', req.params.tagId)
            .eq('user_id', req.user.user_id);

        if (error) throw error;
        res.json({ message: "Mood tag removed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- UC12: Rename Playlist ---
app.put('/api/playlists/:id/rename', authenticateUser, async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Playlist name cannot be empty" });
    }

    try {
        const { data: pl } = await supabase.from('playlists')
            .select('creator_id')
            .eq('playlist_id', req.params.id);

        if (!pl || pl.length === 0) {
            return res.status(404).json({ error: "Playlist not found" });
        }

        if (pl[0].creator_id !== req.user.user_id) {
            return res.status(403).json({ error: "Only the playlist owner can rename it" });
        }

        const { error } = await supabase.from('playlists')
            .update({ name: name.trim() })
            .eq('playlist_id', req.params.id);

        if (error) throw error;
        res.json({ message: "Playlist renamed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- UC14: Rate and Review Songs ---
app.post('/api/songs/review', authenticateUser, async (req, res) => {
    const { song_name, artist, rating, review_text, spotify_uri } = req.body;

    if (!song_name || !rating) {
        return res.status(400).json({ error: "Song name and rating are required" });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    try {
        // Find or create song
        let songId;
        const { data: existing } = await supabase.from('songs')
            .select('song_id')
            .eq('title', song_name)
            .limit(1);

        if (existing && existing.length > 0) {
            songId = existing[0].song_id;
        } else {
            const { data: newSong, error: songErr } = await supabase.from('songs')
                .insert([{ title: song_name, artist: artist || '', spotify_uri: spotify_uri || '' }])
                .select('song_id');
            if (songErr) throw songErr;
            songId = newSong[0].song_id;
        }

        // Check if review already exists (upsert)
        const { data: existingReview } = await supabase.from('song_reviews')
            .select('review_id')
            .eq('song_id', songId)
            .eq('user_id', req.user.user_id);

        if (existingReview && existingReview.length > 0) {
            const { error } = await supabase.from('song_reviews')
                .update({ rating, review_text: review_text || '', created_at: new Date().toISOString() })
                .eq('review_id', existingReview[0].review_id);
            if (error) throw error;
            return res.json({ message: "Review updated" });
        }

        const { error } = await supabase.from('song_reviews')
            .insert([{
                song_id: songId,
                user_id: req.user.user_id,
                rating,
                review_text: review_text || '',
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        res.json({ message: "Review submitted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/songs/reviews/:songName', authenticateUser, async (req, res) => {
    try {
        const songName = decodeURIComponent(req.params.songName);
        const { data: songs } = await supabase.from('songs')
            .select('song_id')
            .eq('title', songName)
            .limit(1);

        if (!songs || songs.length === 0) {
            return res.json({ reviews: [], average_rating: null });
        }

        const { data: reviews, error } = await supabase.from('song_reviews')
            .select('review_id, rating, review_text, created_at, user_id')
            .eq('song_id', songs[0].song_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get usernames
        const userIds = [...new Set((reviews || []).map(r => r.user_id))];
        let userMap = {};
        if (userIds.length > 0) {
            const { data: users } = await supabase.from('users')
                .select('user_id, username')
                .in('user_id', userIds);
            (users || []).forEach(u => { userMap[u.user_id] = u.username; });
        }

        const enrichedReviews = (reviews || []).map(r => ({
            ...r,
            username: userMap[r.user_id] || 'Unknown'
        }));

        const avgRating = reviews && reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : null;

        res.json({ reviews: enrichedReviews, average_rating: avgRating });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/songs/review/:reviewId', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabase.from('song_reviews')
            .delete()
            .eq('review_id', req.params.reviewId)
            .eq('user_id', req.user.user_id);

        if (error) throw error;
        res.json({ message: "Review deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- UC15: Profile Analytics ---
app.get('/api/profile-analytics', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.user_id;

        // Get user's playlists count
        const { data: playlists } = await supabase.from('playlists')
            .select('playlist_id, name, created_at')
            .eq('creator_id', userId);

        // Get user's reviews
        const { data: reviews } = await supabase.from('song_reviews')
            .select('rating')
            .eq('user_id', userId);

        // Get user's friendships
        const { data: friendships } = await supabase.from('friendships')
            .select('friend_id')
            .eq('status', 'ACCEPTED')
            .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

        // Get exports
        const { data: exports } = await supabase.from('playlist_exports')
            .select('export_id')
            .eq('user_id', userId);

        // Get Spotify data if available
        let spotifyData = null;
        try {
            const { error: tokenError, token } = await getValidSpotifyToken(userId);
            if (!tokenError && token) {
                const [topArtists, topTracks, recent] = await Promise.all([
                    axios.get('https://api.spotify.com/v1/me/top/artists', {
                        headers: { 'Authorization': `Bearer ${token}` },
                        params: { time_range: 'long_term', limit: 5 }
                    }).catch(() => ({ data: { items: [] } })),
                    axios.get('https://api.spotify.com/v1/me/top/tracks', {
                        headers: { 'Authorization': `Bearer ${token}` },
                        params: { time_range: 'long_term', limit: 5 }
                    }).catch(() => ({ data: { items: [] } })),
                    axios.get('https://api.spotify.com/v1/me/player/recently-played', {
                        headers: { 'Authorization': `Bearer ${token}` },
                        params: { limit: 50 }
                    }).catch(() => ({ data: { items: [] } }))
                ]);

                // Calculate estimated listening time from recent plays
                const totalMs = recent.data.items.reduce((sum, i) => sum + (i.track?.duration_ms || 0), 0);

                spotifyData = {
                    top_artists: topArtists.data.items.map(a => ({
                        name: a.name,
                        image: a.images?.[1]?.url || a.images?.[0]?.url || null,
                        genres: (a.genres || []).slice(0, 2)
                    })),
                    top_tracks: topTracks.data.items.map(t => ({
                        name: t.name,
                        artist: t.artists.map(a => a.name).join(', '),
                        image: t.album.images?.[1]?.url || null
                    })),
                    recent_listening_ms: totalMs,
                    recent_track_count: recent.data.items.length
                };
            }
        } catch (e) { /* Spotify data is optional */ }

        const avgRating = reviews && reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : null;

        res.json({
            playlists_count: playlists?.length || 0,
            reviews_count: reviews?.length || 0,
            average_rating_given: avgRating,
            friends_count: friendships?.length || 0,
            exports_count: exports?.length || 0,
            playlists: (playlists || []).slice(0, 10).map(p => ({ name: p.name, created_at: p.created_at })),
            spotify: spotifyData
        });
    } catch (err) {
        console.error("Profile Analytics Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- Get user's Supabase playlists (for internal features) ---
app.get('/api/playlists/internal', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('playlists')
            .select('playlist_id, name, description, is_collaborative, created_at')
            .eq('creator_id', req.user.user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ playlists: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server started. Open http://localhost:${PORT} in your browser.`);
});

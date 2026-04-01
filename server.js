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

    const scope = 'user-read-currently-playing user-read-playback-state user-top-read user-read-recently-played playlist-read-private playlist-read-collaborative';
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
            params: { limit: 50, fields: 'items(track(name,artists(name),album(name,images),duration_ms,external_urls))' }
        });

        const tracks = spotifyRes.data.items
            .filter(item => item.track)
            .map(item => ({
                name: item.track.name,
                artist: item.track.artists.map(a => a.name).join(', '),
                album: item.track.album.name,
                image: item.track.album.images?.[2]?.url || item.track.album.images?.[0]?.url || null,
                duration_ms: item.track.duration_ms,
                external_url: item.track.external_urls?.spotify || null
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

app.listen(PORT, () => {
    console.log(`Server started. Open http://localhost:${PORT} in your browser.`);
});

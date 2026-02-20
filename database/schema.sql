CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS Users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    theme_pref VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Songs Table
CREATE TABLE IF NOT EXISTS Songs (
    song_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    album VARCHAR(255),
    genre VARCHAR(100),
    duration_ms INTEGER,
    spotify_uri VARCHAR(255)
);

-- 3. Audio_Features Table
CREATE TABLE IF NOT EXISTS Audio_Features (
    feature_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    song_id UUID REFERENCES Songs(song_id) ON DELETE CASCADE,
    tempo FLOAT,
    energy FLOAT,
    key INTEGER,
    valence FLOAT,
    danceability FLOAT,
    acousticness FLOAT
);

-- 4. Mood_Tags Table
CREATE TABLE IF NOT EXISTS Mood_Tags (
    tag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    song_id UUID REFERENCES Songs(song_id) ON DELETE CASCADE,
    user_id UUID REFERENCES Users(user_id) ON DELETE SET NULL,
    label VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Playlists Table
CREATE TABLE IF NOT EXISTS Playlists (
    playlist_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_collaborative BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Playlist_Versions Table
CREATE TABLE IF NOT EXISTS Playlist_Versions (
    version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID REFERENCES Playlists(playlist_id) ON DELETE CASCADE,
    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    label VARCHAR(100)
);

-- 7. Playlist_Songs Table
CREATE TABLE IF NOT EXISTS Playlist_Songs (
    mapping_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID REFERENCES Playlist_Versions(version_id) ON DELETE CASCADE,
    song_id UUID REFERENCES Songs(song_id) ON DELETE CASCADE,
    position INTEGER,
    added_by UUID REFERENCES Users(user_id) ON DELETE SET NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Collaborators Table
CREATE TABLE IF NOT EXISTS Collaborators (
    collab_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID REFERENCES Playlists(playlist_id) ON DELETE CASCADE,
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    permission_level VARCHAR(50),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Listening_History Table
CREATE TABLE IF NOT EXISTS Listening_History (
    listen_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    song_id UUID REFERENCES Songs(song_id) ON DELETE CASCADE,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    skipped BOOLEAN DEFAULT FALSE,
    completion_pct FLOAT
);

-- 10. User_Analytics Table
CREATE TABLE IF NOT EXISTS User_Analytics (
    analytics_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    top_genre VARCHAR(100),
    total_playtime BIGINT,
    timeframe VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Notifications Table
CREATE TABLE IF NOT EXISTS Notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    type VARCHAR(100),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    related_id UUID
);

-- 12. Song_Popularity Table
CREATE TABLE IF NOT EXISTS Song_Popularity (
    popularity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    song_id UUID REFERENCES Songs(song_id) ON DELETE CASCADE,
    play_count BIGINT DEFAULT 0,
    trending_score FLOAT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Playlist_Exports Table
CREATE TABLE IF NOT EXISTS Playlist_Exports (
    export_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID REFERENCES Playlists(playlist_id) ON DELETE CASCADE,
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    spotify_playlist_id VARCHAR(255),
    exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50)
);

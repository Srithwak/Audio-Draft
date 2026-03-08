# Audio-Draft2 🎵

Audio-Draft2 is an exploratory music application designed to let users manage their music experiences, collaborate on playlists, review songs, and personalize their listening environment.

## 🚀 Features

### Phase 1: Authentication & Foundation
- **User Authentication**: Secure Login and Registration integrated with Supabase PostgreSQL.
- **Session Management**: Persistent sessions using hashed passwords and token-based storage.

### Phase 2: Core User Experience
- **Interactive Dashboard**: A clean, centralized dashboard displaying recent tracks.
- **Song Ratings & Reviews** (Use Case 12): Rate tracks out of 5 stars and leave written reviews.
- **Playlist Collaboration** (Use Case 5): Create custom playlists and invite other users to collaborate on them.
- **System Notifications** (Use Case 6): Receive system alerts when you are invited to a new collaborative playlist.
- **Content Blocking & Settings** (Use Case 15): Block specific artists and genres from appearing in your feeds, and manage your Spotify API Keys.

## 🛠️ Technology Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript 
- **Backend Server**: Node.js & Express.js
- **Database**: Supabase PostgreSQL

## 💻 How to Run the App Locally

To test the application on your computer:

1. **Install Dependencies**: Ensure Node.js is installed. Navigate to this directory and run:
   ```bash
   npm install
   ```
2. **Setup Environment**: Ensure your `.env` file is properly configured inside the `database/` folder with your Supabase `API_URL` and `ANON_PUBLIC_KEY`.
3. **Start the Server**: Start the local Node backend by running:
   ```bash
   node server.js
   ```
4. **Access the Web App**: Open your web browser and navigate to:
   [http://localhost:3000](http://localhost:3000)
5. **Run as Desktop App (One-Click)**: For convenience, you can just double-click the `start.bat` file in your project folder! It will automatically start the backend server, launch the native Windows Electon app, and safely shut the server down when you close the app.
   
6. **Build Desktop App**: To generate the portable Windows desktop executable, run:
   ```bash
   npm run build
   ```
   *The distributable executable will be saved in the `release/Audio-Draft2-win32-x64/` directory. You can run the `Audio-Draft2.exe` directly from there.*

---
*Created as part of the Audio-Draft2 Software Engineering phase implementations.*

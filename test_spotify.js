const CLIENT_ID = "de6472af99064239960e491418bb85b5";
const CLIENT_SECRET = "4c20ea7d89c4420ca97e430d3f810280";

const http = require("http");
const axios = require("axios");

const REDIRECT_URI = "http://127.0.0.1:8888/callback";

const SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-read-email"
].join(" ");

const authUrl =
  "https://accounts.spotify.com/authorize?" +
  `client_id=${CLIENT_ID}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&show_dialog=true`;

console.log("\n👉 Open this URL:\n");
console.log(authUrl);

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:8888");

  if (url.pathname !== "/callback") {
    res.end("Waiting for Spotify login...");
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) { res.end("No code found"); return; }
  res.end("Success! Go back to terminal.");

  try {
    // STEP 1: get token
    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          Authorization: "Basic " + Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    const access_token = tokenRes.data.access_token;
    const headers = { Authorization: `Bearer ${access_token}` };

    // STEP 2: who am i
    const meRes = await axios.get("https://api.spotify.com/v1/me", { headers });
    console.log(`\n🎵 Logged in as: ${meRes.data.display_name} (${meRes.data.email})\n`);

    // STEP 3: get playlist list
    let playlistRefs = [];
    let urlPl = "https://api.spotify.com/v1/me/playlists?limit=50";
    while (urlPl) {
      const resPl = await axios.get(urlPl, { headers });
      playlistRefs.push(...resPl.data.items);
      urlPl = resPl.data.next;
    }
    console.log(`✅ Found ${playlistRefs.length} playlists\n`);

    // STEP 4: for each playlist fetch full object and read items
    for (const ref of playlistRefs) {
      console.log(`\n=== ${ref.name} ===`);

      try {
        const plRes = await axios.get(`https://api.spotify.com/v1/playlists/${ref.id}`, { headers });
        const pl = plRes.data;

        // tracks are under pl.items.items, each track under item.item
        let trackItems = [...pl.items.items];
        let nextUrl = pl.items.next;

        // paginate if more than 100 tracks
        while (nextUrl) {
          const nextRes = await axios.get(nextUrl, { headers });
          trackItems.push(...nextRes.data.items);
          nextUrl = nextRes.data.next;
        }

        if (trackItems.length === 0) {
          console.log("  (empty playlist)");
          continue;
        }

        trackItems.forEach((item, i) => {
          const track = item.item || item.track;
          if (!track) return;
          const name = track.name;
          const artists = track.artists.map(a => a.name).join(", ");
          console.log(`  ${i + 1}. ${name} - ${artists}`);
        });

      } catch (err) {
        const status = err.response?.data?.error?.status;
        const msg = err.response?.data?.error?.message || err.message;
        console.warn(`  ⚠️  Skipped — ${status}: ${msg}`);
      }
    }

    console.log("\n✅ Done!\n");
    process.exit();

  } catch (err) {
    console.error("\n❌ ERROR:\n", err.response?.data || err.message);
    process.exit(1);
  }
}).listen(8888, () => {
  console.log("\n🚀 Waiting for callback on http://127.0.0.1:8888/callback\n");
});
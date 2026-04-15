const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const decode = require('audio-decode');
const MusicTempo = require('music-tempo');
const path = require('path');

async function analyzeTrack(artist, song) {
    const query = `${song} ${artist} audio`;
    const tempFile = path.resolve(__dirname, 'temp_audio.mp3');

    try {
        console.log(`1. Searching and downloading: "${query}"...`);
        
        // This acts exactly like yt-dlp, finding the first YouTube result and ripping the MP3
        await youtubedl(`ytsearch1:${query}`, {
            extractAudio: true,
            audioFormat: 'mp3',
            output: tempFile,
            maxDownloads: 1,
            quiet: true
        });

        console.log("2. Decoding audio into raw data...");
        const audioBuffer = fs.readFileSync(tempFile);
        const decodedAudio = await decode(audioBuffer);

        console.log("3. Analyzing Tempo (BPM)...");
        let audioData = [];
        
        // We only analyze the first 30 seconds to keep it lightning fast and save RAM
        // 44100 is the standard sample rate per second
        const sampleLimit = 44100 * 30; 
        
        if (decodedAudio.numberOfChannels === 2) {
            const ch1 = decodedAudio.getChannelData(0);
            const ch2 = decodedAudio.getChannelData(1);
            const limit = Math.min(ch1.length, sampleLimit);
            
            for (let i = 0; i < limit; i++) {
                audioData[i] = (ch1[i] + ch2[i]) / 2; // Mix down to mono
            }
        } else {
            const ch1 = decodedAudio.getChannelData(0);
            audioData = Array.from(ch1).slice(0, sampleLimit);
        }

        const mt = new MusicTempo(audioData);

        console.log("\n=== 🎵 AUDIO-DRAFT LOCAL ANALYSIS ===");
        console.log(`Track: ${song} by ${artist}`);
        console.log(`Calculated BPM: ${Math.round(mt.tempo)}`);
        console.log("=====================================\n");

    } catch (error) {
        console.error("❌ Error during analysis:", error.message);
    } finally {
        // Always delete the temporary MP3 file, even if the script crashes
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
}

// Test it with any song
analyzeTrack("The Weeknd", "Blinding Lights");
require('dotenv').config({ path: './database/.env' });
const { createClient } = require('@supabase/supabase-js');

const API_URL = process.env.API_URL;
const ANON_PUBLIC_KEY = process.env.ANON_PUBLIC_KEY;

if (!API_URL || !ANON_PUBLIC_KEY) {
    console.error("FATAL: Missing API_URL or ANON_PUBLIC_KEY in database/.env");
    process.exit(1);
}

const supabase = createClient(API_URL, ANON_PUBLIC_KEY);

async function main() {
    console.log("Fetching users from Supabase...");

    if (typeof supabase.from !== 'function') {
        console.error("Error: supabase.from is not a function. The client may not be initialized correctly.");
        console.log("Supabase object:", Object.keys(supabase));
        return;
    }

    const { data, error } = await supabase.from("users").select("user_id, username, email, created_at");

    if (error) {
        console.error("Error fetching data:", error);
    } else {
        console.log("Users Data:");
        console.log(data);
    }
}

main();

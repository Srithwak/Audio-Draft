const { createClient } = require('@supabase/supabase-js');

const SUPABASE_DIRECT_CONNECT = "postgresql://postgres:Donuts0519*@db.dapejabajxyemszxbcqm.supabase.co:5432/postgres";
const API_URL = "https://dapejabajxyemszxbcqm.supabase.co";
const ANON_PUBLIC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhcGVqYWJhanh5ZW1zenhiY3FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjk5MzQsImV4cCI6MjA4NzkwNTkzNH0.JJGVSi9w766w0-sr4t92fobqZfzVqwEQoPBwPZc2BV4";

const supabase = createClient(API_URL, ANON_PUBLIC_KEY);

async function main() {
    console.log("Fetching users from Supabase...");

    // Check if table method exists
    if (typeof supabase.from !== 'function') {
        console.error("Error: supabase.from is not a function. The client may not be initialized correctly.");
        console.log("Supabase object:", Object.keys(supabase));
        return;
    }

    const { data, error } = await supabase.from("users").select("*");

    if (error) {
        console.error("Error fetching data:", error);
    } else {
        console.log("Users Data:");
        console.log(data);
    }
}

main();

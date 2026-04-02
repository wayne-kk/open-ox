/**
 * Quick Supabase connectivity test
 * Run: node scripts/test-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Parse .env.local manually (no dotenv dependency needed)
const env = Object.fromEntries(
    readFileSync(".env.local", "utf-8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => {
            const idx = l.indexOf("=");
            return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
        })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

console.log("SUPABASE_URL:", url);
console.log("KEY prefix:", key?.slice(0, 20) + "...");
console.log("");

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Test 1: Query projects table
console.log("Test 1: SELECT from projects table...");
const { data, error } = await supabase.from("projects").select("id, name, status").limit(5);
if (error) {
    console.error("  FAIL:", error.message);
    console.error("  Code:", error.code);
} else {
    console.log("  PASS — projects table accessible");
    console.log("  Row count:", data.length);
    if (data.length > 0) console.log("  Sample:", JSON.stringify(data[0]));
}

// Test 2: Storage bucket
console.log("\nTest 2: List Storage bucket 'project-files'...");
const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
if (bucketErr) {
    console.error("  FAIL:", bucketErr.message);
} else {
    const found = buckets.find((b) => b.name === "project-files");
    if (found) {
        console.log("  PASS — bucket 'project-files' exists");
    } else {
        console.warn("  WARN — bucket 'project-files' NOT found");
        console.log("  Available buckets:", buckets.map((b) => b.name).join(", ") || "(none)");
    }
}

// Test 3: Insert + delete a test row
console.log("\nTest 3: INSERT test row...");
const testId = `test_${Date.now()}`;
const { error: insertErr } = await supabase.from("projects").insert({
    id: testId,
    name: "test",
    user_prompt: "connectivity test",
    status: "generating",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    modification_history: [],
});
if (insertErr) {
    console.error("  FAIL:", insertErr.message);
} else {
    console.log("  PASS — insert ok");
    // Clean up
    await supabase.from("projects").delete().eq("id", testId);
    console.log("  Cleanup: test row deleted");
}

console.log("\nDone.");

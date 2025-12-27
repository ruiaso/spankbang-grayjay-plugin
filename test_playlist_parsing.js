// Test script to verify playlist parsing logic
// This simulates the parsePlaylistsPage function with test HTML

const testHtml = `
<a href="/dqd68/playlist/asmr+joi/" class="playlist-item" data-id="23065136" data-testid="playlist-item">
    <div class="thumb">
        <span class="cover">
            <img loading="lazy" src="https://tbi.sb-cd.com/t/14750662/1/4/w:300/t6-enh/asian-hottie-closeup-long-toes.jpg" alt="ASMR JOI thumbnail">
        </span>
        <span class="cover">
            <img loading="lazy" src="https://tbi.sb-cd.com/t/12322543/1/2/w:300/t6-enh/utdfvl.jpg" alt="ASMR JOI thumbnail">
        </span>
        <span class="cover">
            <img loading="lazy" src="https://tbi.sb-cd.com/t/12902947/1/2/w:300/t6-enh/pmiki-hot-joi.jpg" alt="ASMR JOI thumbnail">
        </span>
        <span class="cover">
            <img loading="lazy" src="https://tbi.sb-cd.com/t/13850780/1/3/w:300/t6-enh/goon.jpg" alt="ASMR JOI thumbnail">
        </span>
        <span class="play fa fa-play-circle-o fa-3x"></span>
        <span class="len"> 7 videos </span>
    </div>
    <p class="inf">ASMR JOI</p>
    <a class="ft-button-bordered-short-width" href="/users/playlists?id=23065136" data-testid="playlist-edit-button">Edit</a>
</a>
`;

// Test the key patterns
console.log("=== Testing Playlist Parsing ===\n");

// Test 1: Check if we can match the playlist-item anchor tag - using full match not just capture group
const playlistAnchorPattern = /<a[^>]*class="[^"]*playlist-item[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
const anchorMatch = playlistAnchorPattern.exec(testHtml);
if (anchorMatch) {
    console.log("✓ Successfully matched <a> tag with class='playlist-item'");
    const fullMatch = anchorMatch[0];  // Full match includes the <a> tag itself
    const block = anchorMatch[1];  // Just the contents
    console.log(`  Full match length: ${fullMatch.length} characters`);
    console.log(`  Block length: ${block.length} characters`);
    
    // Test 2: Extract href from full match (not just block)
    const hrefMatch = fullMatch.match(/href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?"/i);
    if (hrefMatch) {
        console.log(`✓ Extracted playlist URL: /${hrefMatch[1]}/playlist/${hrefMatch[2]}/`);
        console.log(`  Short ID: ${hrefMatch[1]}`);
        console.log(`  Slug: ${hrefMatch[2]}`);
    } else {
        console.log("✗ Failed to extract href");
    }
    
    // Test 3: Extract name from <p class="inf">
    const nameMatch = block.match(/<p[^>]*class="[^"]*inf[^"]*"[^>]*>([^<]+)<\/p>/i);
    if (nameMatch) {
        console.log(`✓ Extracted name: ${nameMatch[1].trim()}`);
    } else {
        console.log("✗ Failed to extract name from <p class='inf'>");
    }
    
    // Test 4: Extract video count from <span class="len">
    const countPattern = /<span[^>]*class="[^"]*len[^"]*"[^>]*>\s*(\d+)\s*videos?/i;
    const countMatch = block.match(countPattern);
    if (countMatch) {
        console.log(`✓ Extracted video count: ${countMatch[1]}`);
    } else {
        console.log("✗ Failed to extract video count from <span class='len'>");
        
        // Try fallback pattern
        const fallbackCount = block.match(/(\d+)\s*videos?/i);
        if (fallbackCount) {
            console.log(`✓ Extracted video count (fallback): ${fallbackCount[1]}`);
        } else {
            console.log("✗ Failed with fallback pattern too");
        }
    }
    
    // Test 5: Extract thumbnail
    const thumbMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i);
    if (thumbMatch) {
        console.log(`✓ Extracted thumbnail: ${thumbMatch[1].substring(0, 60)}...`);
    } else {
        console.log("✗ Failed to extract thumbnail");
    }
    
} else {
    console.log("✗ Failed to match <a> tag with class='playlist-item'");
}

console.log("\n=== Test Complete ===");


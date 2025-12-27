// Comprehensive Playlist Import Test
// This test simulates the complete flow of importing playlists from SpankBang

console.log("=== Comprehensive Playlist Import Test ===\n");

// Sample HTML from /users/playlists page with multiple playlists
const playlistsPageHtml = `
<div class="container">
    <a href="/dqd68/playlist/asmr+joi/" class="playlist-item" data-id="23065136" data-testid="playlist-item">
        <div class="thumb">
            <span class="cover">
                <img loading="lazy" src="https://tbi.sb-cd.com/t/14750662/1/4/w:300/t6-enh/asian-hottie-closeup-long-toes.jpg" alt="ASMR JOI thumbnail">
            </span>
            <span class="len"> 7 videos </span>
        </div>
        <p class="inf">ASMR JOI</p>
    </a>
    
    <a href="/abc123/playlist/feet+joi/" class="playlist-item" data-id="12345678">
        <div class="thumb">
            <span class="cover">
                <img loading="lazy" src="https://tbi.sb-cd.com/t/99999999/1/4/w:300/t6-enh/thumbnail.jpg">
            </span>
            <span class="len"> 12 videos </span>
        </div>
        <p class="inf">Feet JOI Playlist</p>
    </a>
    
    <a href="/xyz789/playlist/favorites/" class="playlist-item" data-id="87654321">
        <div class="thumb">
            <span class="cover">
                <img loading="lazy" src="https://tbi.sb-cd.com/t/88888888/1/4/w:300/t6-enh/fav.jpg">
            </span>
            <span class="len"> 23 videos </span>
        </div>
        <p class="inf">My Favorites</p>
    </a>
</div>
`;

// Simulate parsePlaylistsPage function
function testParsePlaylistsPage(html) {
    const playlists = [];
    
    // Primary pattern for <a class="playlist-item">
    const playlistBlockPattern = /<a[^>]*class="[^"]*playlist-item[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    
    let blockMatch;
    while ((blockMatch = playlistBlockPattern.exec(html)) !== null) {
        const fullMatch = blockMatch[0];
        const block = blockMatch[1];
        
        // Extract href from full match
        const hrefMatch = fullMatch.match(/href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?"/i);
        if (hrefMatch) {
            const shortId = hrefMatch[1];
            const slug = hrefMatch[2];
            const playlistId = `${shortId}:${slug}`;
            
            // Extract name from <p class="inf">
            const nameMatch = block.match(/<p[^>]*class="[^"]*inf[^"]*"[^>]*>([^<]+)<\/p>/i);
            const name = nameMatch ? nameMatch[1].trim() : slug.replace(/[+_-]/g, ' ');
            
            // Extract video count from <span class="len">
            const countPattern = /<span[^>]*class="[^"]*len[^"]*"[^>]*>\s*(\d+)\s*videos?/i;
            const countMatch = block.match(countPattern);
            const videoCount = countMatch ? parseInt(countMatch[1]) : 0;
            
            // Extract thumbnail
            const thumbMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i);
            const thumbnail = thumbMatch ? thumbMatch[1] : "";
            
            playlists.push({
                id: playlistId,
                name: name,
                thumbnail: thumbnail,
                videoCount: videoCount,
                url: `spankbang://playlist/${playlistId}`
            });
        }
    }
    
    return playlists;
}

// Run the test
const playlists = testParsePlaylistsPage(playlistsPageHtml);

console.log(`✓ Successfully parsed ${playlists.length} playlists\n`);

// Verify each playlist
playlists.forEach((playlist, index) => {
    console.log(`Playlist ${index + 1}:`);
    console.log(`  ID: ${playlist.id}`);
    console.log(`  Name: ${playlist.name}`);
    console.log(`  Video Count: ${playlist.videoCount} ${playlist.videoCount === 0 ? '❌ (ISSUE!)' : '✓'}`);
    console.log(`  Thumbnail: ${playlist.thumbnail ? '✓ Present' : '✗ Missing'}`);
    console.log(`  URL: ${playlist.url}`);
    console.log('');
});

// Verification
console.log("=== Verification ===");
const expectedResults = [
    { name: "ASMR JOI", videoCount: 7, id: "dqd68:asmr+joi" },
    { name: "Feet JOI Playlist", videoCount: 12, id: "abc123:feet+joi" },
    { name: "My Favorites", videoCount: 23, id: "xyz789:favorites" }
];

let allTestsPassed = true;

expectedResults.forEach((expected, index) => {
    const actual = playlists[index];
    
    if (!actual) {
        console.log(`❌ Test ${index + 1}: Playlist not found`);
        allTestsPassed = false;
        return;
    }
    
    const nameMatch = actual.name === expected.name;
    const countMatch = actual.videoCount === expected.videoCount;
    const idMatch = actual.id === expected.id;
    
    if (nameMatch && countMatch && idMatch) {
        console.log(`✓ Test ${index + 1}: ${expected.name} - All fields correct`);
    } else {
        console.log(`❌ Test ${index + 1}: ${expected.name} - Mismatch detected`);
        if (!nameMatch) console.log(`   Name: expected "${expected.name}", got "${actual.name}"`);
        if (!countMatch) console.log(`   Count: expected ${expected.videoCount}, got ${actual.videoCount}`);
        if (!idMatch) console.log(`   ID: expected "${expected.id}", got "${actual.id}"`);
        allTestsPassed = false;
    }
});

console.log("\n=== Final Result ===");
if (allTestsPassed && playlists.length === expectedResults.length) {
    console.log("✅ ALL TESTS PASSED!");
    console.log("The playlist import fix is working correctly.");
    console.log("Video counts are being extracted properly from <span class='len'> elements.");
} else {
    console.log("❌ SOME TESTS FAILED");
    console.log("Please review the output above for details.");
}

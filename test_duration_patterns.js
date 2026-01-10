// Test duration pattern matching
function parseDuration(durationStr) {
    if (!durationStr) return 0;
    let totalSeconds = 0;

    if (typeof durationStr === 'number') {
        return durationStr;
    }

    // Handle pure numeric strings (seconds only)
    const numericOnly = durationStr.toString().trim().match(/^(\d+)$/);
    if (numericOnly) {
        return parseInt(numericOnly[1]);
    }

    const colonMatch = durationStr.match(/(\d+):(\d+)(?::(\d+))?/);
    if (colonMatch) {
        if (colonMatch[3]) {
            totalSeconds = parseInt(colonMatch[1]) * 3600 + parseInt(colonMatch[2]) * 60 + parseInt(colonMatch[3]);
        } else {
            totalSeconds = parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
        }
        return totalSeconds;
    }

    return totalSeconds;
}

// Sample HTML blocks (simulating what SpankBang might return)
const testBlocks = [
    // Test 1: Duration in span with class "l"
    '<div class="video-item"><a href="/abc123/video/test-video"><span class="l">12:21</span><img src="thumb.jpg"></a></div>',
    
    // Test 2: Duration in data attribute
    '<div class="video-item" data-duration="741"><a href="/abc123/video/test-video"><img src="thumb.jpg"></a></div>',
    
    // Test 3: Watch progress AND duration (history page scenario)
    '<div class="history-item"><a class="thumb" href="/abc123/video/test-video"><span class="progress">Watched 1:07</span><span class="l">12:21</span></a></div>',
    
    // Test 4: Just duration in plain span
    '<div><a href="/abc123/video/test-video"><span>15:58</span></a></div>',
    
    // Test 5: No duration at all
    '<div class="video-item"><a href="/abc123/video/test-video"><img src="thumb.jpg"></a></div>'
];

console.log("Testing duration extraction patterns:\n");

testBlocks.forEach((block, index) => {
    console.log(`\n=== Test ${index + 1} ===`);
    console.log("Block:", block.substring(0, 100) + "...");
    
    const allTimeMatches = [];
    
    // Ultra-aggressive patterns
    const ultraAggressivePatterns = [
        /(\d{1,2}:\d{2}:\d{2})/g,
        /(\d{1,3}:\d{2})/g
    ];
    
    for (const pattern of ultraAggressivePatterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(block)) !== null) {
            const durStr = match[1].trim();
            const parsed = parseDuration(durStr);
            if (parsed > 0) {
                allTimeMatches.push({ value: parsed, original: durStr });
            }
        }
    }
    
    // Check data attributes
    const dataPattern = /data-duration="([^"]+)"/gi;
    let dataMatch;
    while ((dataMatch = dataPattern.exec(block)) !== null) {
        const durStr = dataMatch[1].trim();
        const parsed = parseDuration(durStr);
        if (parsed > 0) {
            allTimeMatches.push({ value: parsed, original: durStr + ' (data-attr)' });
        }
    }
    
    if (allTimeMatches.length > 0) {
        allTimeMatches.sort((a, b) => b.value - a.value);
        const duration = allTimeMatches[0].value;
        const mm = Math.floor(duration / 60);
        const ss = (duration % 60).toString().padStart(2, '0');
        console.log(`✅ Found ${allTimeMatches.length} time(s): ${allTimeMatches.map(m => m.original).join(', ')}`);
        console.log(`   Selected: ${duration}s (${mm}:${ss})`);
    } else {
        console.log("❌ NO DURATION FOUND");
    }
});

console.log("\n\n=== parseDuration Tests ===");
const durTests = ["12:21", "741", "1:07", "15:58", "0:32", "1:23:45"];
durTests.forEach(test => {
    const result = parseDuration(test);
    const mm = Math.floor(result / 60);
    const ss = (result % 60).toString().padStart(2, '0');
    console.log(`parseDuration("${test}") = ${result}s (${mm}:${ss})`);
});

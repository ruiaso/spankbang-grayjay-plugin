// Test file for SpankBang Grayjay plugin parsing functions
// Tests the recent fixes for duration extraction, view counts, and uploader names

// Import the functions we need to test (simulate loading from SpankbangScript.js)
// Since we can't use ES6 imports, we'll copy the functions here for testing

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

    const REGEX_PATTERNS = {
        parsing: {
            duration: /(\d+)h|(\d+)m|(\d+)s/g
        }
    };

    const parts = durationStr.toLowerCase().match(REGEX_PATTERNS.parsing.duration);
    if (parts) {
        for (const part of parts) {
            const numericValue = parseInt(part);
            if (!isNaN(numericValue)) {
                if (part.includes('h')) {
                    totalSeconds += numericValue * 3600;
                } else if (part.includes('m')) {
                    totalSeconds += numericValue * 60;
                } else if (part.includes('s')) {
                    totalSeconds += numericValue;
                }
            }
        }
    }

    return totalSeconds;
}

function extractAllDurationCandidatesFromContext(html, opts = {}) {
    const options = {
        excludeProgress: opts.excludeProgress !== false, // default true
        maxSeconds: typeof opts.maxSeconds === 'number' ? opts.maxSeconds : 24 * 60 * 60
    };

    if (!html || typeof html !== 'string') return [];

    const candidates = [];

    // 1) Data attributes (often seconds)
    const dataAttrPatterns = [
        /data-duration=["']([^"']+)["']/gi,
        /data-length=["']([^"']+)["']/gi,
        /data-time=["']([^"']+)["']/gi
    ];

    for (const pattern of dataAttrPatterns) {
        let m;
        pattern.lastIndex = 0;
        while ((m = pattern.exec(html)) !== null) {
            if (!m[1]) continue;
            const parsed = parseDuration(m[1].trim());
            if (parsed > 0 && parsed <= options.maxSeconds) candidates.push(parsed);
        }
    }

    // 2) itemprop/meta/JSON-LD PT duration formats
    const ptPattern = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/gi;
    let pt;
    while ((pt = ptPattern.exec(html)) !== null) {
        const h = parseInt(pt[1] || '0');
        const m = parseInt(pt[2] || '0');
        const s = parseInt(pt[3] || '0');
        const total = h * 3600 + m * 60 + s;
        if (total > 0 && total <= options.maxSeconds) candidates.push(total);
    }

    // 3) Common span patterns
    const spanPatterns = [
        /<span[^>]*class=["'][^"']*\bl\b[^"']*["'][^>]*>([^<]+)<\/span>/gi,
        /<span[^>]*class=["'][^"']*(?:duration|length|time)[^"']*["'][^>]*>([^<]+)<\/span>/gi
    ];

    for (const pattern of spanPatterns) {
        let m;
        pattern.lastIndex = 0;
        while ((m = pattern.exec(html)) !== null) {
            if (!m[1]) continue;
            const text = m[1].replace(/<[^>]*>/g, '').trim();
            const parsed = parseDuration(text);
            if (parsed > 0 && parsed <= options.maxSeconds) candidates.push(parsed);
        }
    }

    // 4) Any time-like tokens (MM:SS or HH:MM:SS)
    const timeToken = /\b\d{1,3}:\d{2}(?::\d{2})?\b/g;
    let match;
    while ((match = timeToken.exec(html)) !== null) {
        const token = match[0];
        if (!token) continue;

        if (options.excludeProgress) {
            const start = Math.max(0, match.index - 40);
            const end = Math.min(html.length, match.index + token.length + 40);
            const context = html.substring(start, end);
            if (/watched|progress|viewed|remaining|elapsed/i.test(context)) {
                continue;
            }
        }

        const parsed = parseDuration(token);
        if (parsed > 0 && parsed <= options.maxSeconds) candidates.push(parsed);
    }

    // De-dupe + basic sanity
    const uniq = Array.from(new Set(candidates)).filter(s => s >= 5);
    return uniq;
}

function extractBestDurationSecondsFromContext(html, opts = {}) {
    const preferLargest = opts.preferLargest !== false; // default true
    const candidates = extractAllDurationCandidatesFromContext(html, opts);
    if (!candidates || candidates.length === 0) return 0;

    if (preferLargest) {
        return candidates.reduce((a, b) => (b > a ? b : a), 0);
    }
    return candidates[0] || 0;
}

function parseViewCount(viewsStr) {
    if (!viewsStr) return 0;

    viewsStr = viewsStr.toString().trim().toLowerCase();

    const multipliers = {
        'k': 1000,
        'm': 1000000,
        'b': 1000000000
    };

    for (const [suffix, multiplier] of Object.entries(multipliers)) {
        if (viewsStr.includes(suffix)) {
            const num = parseFloat(viewsStr.replace(/[^0-9.]/g, ''));
            return Math.floor(num * multiplier);
        }
    }

    return parseInt(viewsStr.replace(/[,.\s]/g, '')) || 0;
}

function extractViewCountFromContext(html) {
    if (!html || typeof html !== 'string') return 0;

    const patterns = [
        /data-views=["']([^"']+)["']/i,
        /data-viewcount=["']([^"']+)["']/i,
        /data-view-count=["']([^"']+)["']/i,
        /<span[^>]*class=["'][^"']*(?:v|views)[^"']*["'][^>]*>([^<]+)<\/span>/i,
        /"interactionCount"\s*:\s*"?(\d+)"?/i,
        /(\d+(?:[,.]\d+)?[KMB]?)\s*views?/i
    ];

    for (const pattern of patterns) {
        const m = html.match(pattern);
        if (m && m[1]) {
            const parsed = parseViewCount(m[1].trim());
            if (parsed > 0) return parsed;
        }
    }

    return 0;
}

function isLikelyBadUploaderName(name, channelSlug = "") {
    if (!name) return true;
    const trimmed = name.toString().replace(/<[^>]*>/g, '').trim();
    if (trimmed.length === 0) return true;

    // Common non-name strings seen in UI
    if (/^\d+\s*videos?$/i.test(trimmed)) return true;
    if (/^\d+\s*views?$/i.test(trimmed)) return true;
    if (/^\d+$/.test(trimmed)) return true;

    const likelyBad = ['HD', '4K', 'VR', 'POV', 'NEW', 'HOT', 'TOP', 'PREMIUM', 'VERIFIED'];
    if (likelyBad.includes(trimmed.toUpperCase())) return true;

    // If a short label doesn't resemble the channel slug at all, it is often a tag
    const slugNorm = (channelSlug || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameNorm = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (slugNorm.length >= 5 && nameNorm.length <= 5 && !slugNorm.includes(nameNorm)) {
        return true;
    }

    return false;
}

function findTitleForChannelLink(html, shortId, channelSlug) {
    if (!html || !shortId || !channelSlug) return "";
    const escapedSlug = channelSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedId = shortId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const pattern = new RegExp(`href=["']\\/${escapedId}\\/channel\\/${escapedSlug}\\/?[^"']*["'][^>]*title=["']([^"']+)["']`, 'i');
    const m = html.match(pattern);
    return m && m[1] ? m[1].trim() : "";
}

// Test runner
function runTests() {
    let totalTests = 0;
    let passedTests = 0;

    function test(name, testFn) {
        totalTests++;
        try {
            const result = testFn();
            if (result) {
                console.log(`✅ PASS: ${name}`);
                passedTests++;
            } else {
                console.log(`❌ FAIL: ${name}`);
            }
        } catch (error) {
            console.log(`❌ ERROR: ${name} - ${error.message}`);
        }
    }

    console.log("=== SpankBang Plugin Parsing Tests ===\n");

    // Test 1: Duration extraction consistency - prefer larger duration when both progress and full duration exist
    test("Duration extraction - prefer larger duration (history page scenario)", () => {
        const historyHtml = `
            <div class="history-item">
                <a href="/abc123/video/test-video">
                    <span class="progress">Watched 1:26</span>
                    <span class="l">15:54</span>
                    <img src="thumb.jpg">
                </a>
            </div>
        `;
        
        const duration = extractBestDurationSecondsFromContext(historyHtml, { preferLargest: true });
        const expected = 15 * 60 + 54; // 954 seconds
        console.log(`   Found duration: ${duration}s (expected: ${expected}s)`);
        return duration === expected;
    });

    // Test 2: Duration extraction - multiple candidates, pick largest
    test("Duration extraction - multiple candidates, pick largest", () => {
        const multiDurationHtml = `
            <div class="video-item">
                <span class="l">5:30</span>
                <span class="duration">12:45</span>
                <span>2:15</span>
            </div>
        `;
        
        const duration = extractBestDurationSecondsFromContext(multiDurationHtml, { preferLargest: true });
        const expected = 12 * 60 + 45; // 765 seconds
        console.log(`   Found duration: ${duration}s (expected: ${expected}s)`);
        return duration === expected;
    });

    // Test 3: Duration extraction - data attribute
    test("Duration extraction - data attribute", () => {
        const dataAttrHtml = `<div class="video-item" data-duration="741"><a href="/abc123/video/test-video"><img src="thumb.jpg"></a></div>`;
        
        const duration = extractBestDurationSecondsFromContext(dataAttrHtml);
        console.log(`   Found duration: ${duration}s (expected: 741s)`);
        return duration === 741;
    });

    // Test 4: View count extraction - "59K views" pattern
    test("View count extraction - 59K views pattern", () => {
        const viewsHtml = `<div class="video-info"><span>59K views</span></div>`;
        
        const views = extractViewCountFromContext(viewsHtml);
        console.log(`   Found views: ${views} (expected: 59000)`);
        return views === 59000;
    });

    // Test 5: View count extraction - data-views attribute
    test("View count extraction - data-views attribute", () => {
        const viewsHtml = `<div class="video-item" data-views="123456"><span>Video Title</span></div>`;
        
        const views = extractViewCountFromContext(viewsHtml);
        console.log(`   Found views: ${views} (expected: 123456)`);
        return views === 123456;
    });

    // Test 6: View count extraction - JSON interactionCount
    test("View count extraction - JSON interactionCount", () => {
        const viewsHtml = `<script type="application/ld+json">{"interactionCount": "987654"}</script>`;
        
        const views = extractViewCountFromContext(viewsHtml);
        console.log(`   Found views: ${views} (expected: 987654)`);
        return views === 987654;
    });

    // Test 7: View count extraction - span with views class
    test("View count extraction - span with views class", () => {
        const viewsHtml = `<span class="views">1.2M views</span>`;
        
        const views = extractViewCountFromContext(viewsHtml);
        console.log(`   Found views: ${views} (expected: 1200000)`);
        return views === 1200000;
    });

    // Test 8: Uploader name validation - reject 'HD'
    test("Uploader name validation - reject 'HD'", () => {
        const result = isLikelyBadUploaderName('HD', 'somechannel');
        console.log(`   isLikelyBadUploaderName('HD') = ${result} (expected: true)`);
        return result === true;
    });

    // Test 9: Uploader name validation - reject 'Solo' (correctly rejected due to slug mismatch)
    test("Uploader name validation - reject 'Solo'", () => {
        const result = isLikelyBadUploaderName('Solo', 'somechannel');
        console.log(`   isLikelyBadUploaderName('Solo') = ${result} (expected: true)`);
        console.log(`   NOTE: 'Solo' rejected because it doesn't match channel slug 'somechannel' (tag detection)`);
        return result === true; // Solo should be rejected as it's likely a tag
    });

    // Test 10: Uploader name validation - reject '148 videos'
    test("Uploader name validation - reject '148 videos'", () => {
        const result = isLikelyBadUploaderName('148 videos', 'somechannel');
        console.log(`   isLikelyBadUploaderName('148 videos') = ${result} (expected: true)`);
        return result === true;
    });

    // Test 11: Uploader name validation - accept valid name
    test("Uploader name validation - accept valid name", () => {
        const result = isLikelyBadUploaderName('John Doe', 'johndoe');
        console.log(`   isLikelyBadUploaderName('John Doe') = ${result} (expected: false)`);
        return result === false;
    });

    // Test 12: Channel title attribute fallback
    test("Channel title attribute fallback", () => {
        const html = `
            <div>
                <a href="/abc123/channel/johndoe" title="John Doe Official">
                    <span>HD</span>
                </a>
            </div>
        `;
        
        const title = findTitleForChannelLink(html, 'abc123', 'johndoe');
        console.log(`   Found title: "${title}" (expected: "John Doe Official")`);
        return title === "John Doe Official";
    });

    // Test 13: Duration extraction - exclude progress indicators
    test("Duration extraction - exclude progress indicators", () => {
        const progressHtml = `
            <div class="video-item">
                <span>Watched 3:45 of 12:30</span>
                <span class="l">12:30</span>
            </div>
        `;
        
        const duration = extractBestDurationSecondsFromContext(progressHtml, { excludeProgress: true });
        const expected = 12 * 60 + 30; // 750 seconds
        console.log(`   Found duration: ${duration}s (expected: ${expected}s)`);
        return duration === expected;
    });

    // Test 14: View count parsing - edge cases
    test("View count parsing - edge cases", () => {
        const tests = [
            { input: "1,234,567", expected: 1234567 },
            { input: "2.5K", expected: 2500 },
            { input: "1.2M", expected: 1200000 },
            { input: "3B", expected: 3000000000 }
        ];
        
        for (const testCase of tests) {
            const result = parseViewCount(testCase.input);
            console.log(`   parseViewCount("${testCase.input}") = ${result} (expected: ${testCase.expected})`);
            if (result !== testCase.expected) {
                return false;
            }
        }
        return true;
    });

    // Test 15: Uploader name validation - short tag vs channel slug
    test("Uploader name validation - short tag vs channel slug", () => {
        // Short name that doesn't match long channel slug should be rejected
        const result1 = isLikelyBadUploaderName('Hot', 'verylongchannelname');
        console.log(`   isLikelyBadUploaderName('Hot', 'verylongchannelname') = ${result1} (expected: true)`);
        
        // Short name that matches channel slug should be accepted
        const result2 = isLikelyBadUploaderName('John', 'johndoe');
        console.log(`   isLikelyBadUploaderName('John', 'johndoe') = ${result2} (expected: false)`);
        
        return result1 === true && result2 === false;
    });

    // Test 16: Duration extraction - PT format (JSON-LD)
    test("Duration extraction - PT format (JSON-LD)", () => {
        const ptHtml = `<script type="application/ld+json">{"duration": "PT15M30S"}</script>`;
        
        const duration = extractBestDurationSecondsFromContext(ptHtml);
        const expected = 15 * 60 + 30; // 930 seconds
        console.log(`   Found duration: ${duration}s (expected: ${expected}s)`);
        return duration === expected;
    });

    // Test 17: Duration extraction - no valid duration
    test("Duration extraction - no valid duration", () => {
        const noDurationHtml = `<div class="video-item"><img src="thumb.jpg"><span>No duration here</span></div>`;
        
        const duration = extractBestDurationSecondsFromContext(noDurationHtml);
        console.log(`   Found duration: ${duration}s (expected: 0s)`);
        return duration === 0;
    });

    // Test 18: View count extraction - no views found
    test("View count extraction - no views found", () => {
        const noViewsHtml = `<div class="video-item"><span>No views here</span></div>`;
        
        const views = extractViewCountFromContext(noViewsHtml);
        console.log(`   Found views: ${views} (expected: 0)`);
        return views === 0;
    });

    // Test 19: Channel title fallback - no title attribute
    test("Channel title fallback - no title attribute", () => {
        const html = `
            <div>
                <a href="/abc123/channel/johndoe">
                    <span>Some Channel</span>
                </a>
            </div>
        `;
        
        const title = findTitleForChannelLink(html, 'abc123', 'johndoe');
        console.log(`   Found title: "${title}" (expected: "")`);
        return title === "";
    });

    // Test 20: Duration extraction with progress context exclusion
    test("Duration extraction - complex progress exclusion", () => {
        const complexProgressHtml = `
            <div class="video-item">
                <span>You watched 5:30 of this video</span>
                <span>Video progress: 2:15 remaining</span>
                <span class="l">18:45</span>
            </div>
        `;
        
        const duration = extractBestDurationSecondsFromContext(complexProgressHtml, { excludeProgress: true });
        const expected = 18 * 60 + 45; // 1125 seconds
        console.log(`   Found duration: ${duration}s (expected: ${expected}s)`);
        return duration === expected;
    });

    console.log(`\n=== Test Results ===`);
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    return passedTests === totalTests;
}

// Run the tests
console.log("Starting SpankBang plugin parsing tests...");
const success = runTests();
console.log(success ? "All tests completed!" : "Some tests failed!");
process.exit(success ? 0 : 1);
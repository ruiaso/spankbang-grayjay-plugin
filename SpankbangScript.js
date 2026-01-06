const BASE_URL = "https://spankbang.com";
const PLATFORM = "Spankbang";
const PLATFORM_CLAIMTYPE = 3;

var config = {};
let localConfig = {
    modelIds: {}
};
var state = {
    sessionCookie: "",
    isAuthenticated: false,
    authCookies: "",
    username: "",
    userId: "",
    cookieExpiry: 0
};

const CONFIG = {
    DEFAULT_PAGE_SIZE: 20,
    COMMENTS_PAGE_SIZE: 50,
    VIDEO_QUALITIES: {
        "240": { name: "240p", width: 426, height: 240 },
        "480": { name: "480p", width: 854, height: 480 },
        "720": { name: "720p", width: 1280, height: 720 },
        "1080": { name: "1080p", width: 1920, height: 1080 },
        "2160": { name: "4K", width: 3840, height: 2160 },
        "4k": { name: "4K", width: 3840, height: 2160 }
    },
    INTERNAL_URL_SCHEME: "spankbang://",
    EXTERNAL_URL_BASE: "https://spankbang.com",
    THUMB_BASE: "https://tbi.sb-cd.com"
};

const API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
};

const REGEX_PATTERNS = {
    urls: {
        videoStandard: /^https?:\/\/(?:www\.)?spankbang\.com\/([^\/\?]+)\/video\/([^\/\?]+)$/,
        videoAlt: /^https?:\/\/(?:www\.)?spankbang\.com\/([^\/\?]+)\/video\//,
        channelUser: /^https?:\/\/(?:www\.)?spankbang\.com\/profile\/([^\/\?]+)/,
        channelCreator: /^https?:\/\/(?:www\.)?spankbang\.com\/creators\/([^\/\?]+)/,
        pornstar: /^https?:\/\/(?:www\.)?spankbang\.com\/pornstar\/([^\/\?]+)/,
        channelInternal: /^spankbang:\/\/channel\/(.+)$/,
        profileInternal: /^spankbang:\/\/profile\/(.+)$/
    },
    extraction: {
        videoId: /\/([^\/]+)\/video\//,
        videoIdAlt: /video\/(\d+)/,
        streamUrl: /"(https?:\/\/[^"]+\.mp4[^"]*)"/g,
        title: /<h1[^>]*>([^<]+)<\/h1>/,
        duration: /"duration"\s*:\s*"?(\d+)"?/,
        views: /"interactionCount"\s*:\s*"?(\d+)"?/
    }
};

function getAuthHeaders() {
    const headers = { ...API_HEADERS };
    if (state.authCookies && state.authCookies.length > 0) {
        headers["Cookie"] = state.authCookies;
        log("Using auth cookies for request");
    }
    return headers;
}

function validateCookies() {
    if (!state.authCookies || state.authCookies.length === 0) {
        return { valid: false, message: "No cookies set. Please configure your SpankBang cookies in plugin settings." };
    }
    
    // Check if cookies have expired (if expiry was set)
    if (state.cookieExpiry > 0 && Date.now() > state.cookieExpiry) {
        return { valid: false, message: "Cookies have expired. Please update your SpankBang cookies." };
    }
    
    return { valid: true, message: "Cookies are valid" };
}

function setCookies(cookieString) {
    if (!cookieString || cookieString.trim().length === 0) {
        throw new ScriptException("Cookie string cannot be empty");
    }
    
    state.authCookies = cookieString.trim();
    // Set expiry to 30 days from now (typical cookie lifetime)
    state.cookieExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000);
    state.isAuthenticated = true;
    
    // Try to extract username from cookies if present
    const usernameMatch = cookieString.match(/username=([^;]+)/);
    if (usernameMatch) {
        state.username = decodeURIComponent(usernameMatch[1]);
    }
    
    log("Cookies set successfully. Authentication enabled.");
    return true;
}

function clearCookies() {
    state.authCookies = "";
    state.isAuthenticated = false;
    state.cookieExpiry = 0;
    state.username = "";
    state.userId = "";
    log("Cookies cleared");
}

function makeRequest(url, headers = null, context = 'request') {
    try {
        const requestHeaders = headers || getAuthHeaders();
        const response = http.GET(url, requestHeaders, false);
        if (!response.isOk) {
            throw new ScriptException(`${context} failed with status ${response.code}`);
        }
        return response.body;
    } catch (error) {
        throw new ScriptException(`Failed to fetch ${context}: ${error.message}`);
    }
}

function makeRequestNoThrow(url, headers = null, context = 'request') {
    try {
        const requestHeaders = headers || getAuthHeaders();
        const response = http.GET(url, requestHeaders, false);
        return { isOk: response.isOk, code: response.code, body: response.body };
    } catch (error) {
        return { isOk: false, code: 0, body: null, error: error.message };
    }
}

function extractVideoId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for video ID extraction");
    }

    const patterns = [
        /-(\d+)$/,
        /videos\/[^\/]+-(\d+)/,
        /xvideos\/(\d+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    const slugMatch = url.match(/videos\/([^\/\?]+)/);
    if (slugMatch && slugMatch[1]) {
        return slugMatch[1];
    }

    throw new ScriptException(`Could not extract video ID from URL: ${url}`);
}

function extractChannelId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for channel ID extraction");
    }

    const channelInternalMatch = url.match(REGEX_PATTERNS.urls.channelInternal);
    if (channelInternalMatch && channelInternalMatch[1]) {
        return { type: 'channel', id: channelInternalMatch[1] };
    }

    const profileInternalMatch = url.match(REGEX_PATTERNS.urls.profileInternal);
    if (profileInternalMatch && profileInternalMatch[1]) {
        if (profileInternalMatch[1].startsWith('pornstar:')) {
            return { type: 'pornstar', id: profileInternalMatch[1].replace('pornstar:', '') };
        }
        return { type: 'user', id: profileInternalMatch[1] };
    }

    const userMatch = url.match(REGEX_PATTERNS.urls.channelUser);
    if (userMatch && userMatch[1]) {
        return { type: 'user', id: userMatch[1] };
    }

    const creatorMatch = url.match(REGEX_PATTERNS.urls.channelCreator);
    if (creatorMatch && creatorMatch[1]) {
        return { type: 'creator', id: creatorMatch[1] };
    }

    const pornstarMatch = url.match(REGEX_PATTERNS.urls.pornstar);
    if (pornstarMatch && pornstarMatch[1]) {
        return { type: 'pornstar', id: pornstarMatch[1] };
    }

    const profilesMatch = url.match(/\/profile\/([^\/\?]+)/);
    if (profilesMatch && profilesMatch[1]) {
        return { type: 'user', id: profilesMatch[1] };
    }

    const pornstarsMatch = url.match(/\/pornstar\/([^\/\?]+)/);
    if (pornstarsMatch && pornstarsMatch[1]) {
        return { type: 'pornstar', id: pornstarsMatch[1] };
    }

    throw new ScriptException(`Could not extract channel ID from URL: ${url}`);
}

function parseDuration(durationStr) {
    if (!durationStr) return 0;

    let totalSeconds = 0;

    if (typeof durationStr === 'number') {
        return durationStr;
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

    const ptMatch = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (ptMatch) {
        totalSeconds = (parseInt(ptMatch[1]) || 0) * 3600 + 
                       (parseInt(ptMatch[2]) || 0) * 60 + 
                       (parseInt(ptMatch[3]) || 0);
        return totalSeconds;
    }

    return parseInt(durationStr) || 0;
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

function parseRelativeDate(dateStr) {
    if (!dateStr) return 0;
    
    const now = Math.floor(Date.now() / 1000);
    const lowerDateStr = dateStr.toLowerCase().trim();
    
    const relativeMatch = lowerDateStr.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i);
    if (relativeMatch) {
        const num = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2].toLowerCase();
        
        const multipliers = {
            'second': 1,
            'minute': 60,
            'hour': 3600,
            'day': 86400,
            'week': 604800,
            'month': 2592000,
            'year': 31536000
        };
        
        if (multipliers[unit]) {
            return now - (num * multipliers[unit]);
        }
    }
    
    if (lowerDateStr.includes('just now') || lowerDateStr.includes('moments ago')) {
        return now;
    }
    if (lowerDateStr.includes('yesterday')) {
        return now - 86400;
    }
    if (lowerDateStr.includes('today')) {
        return now;
    }
    
    try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            return Math.floor(parsed.getTime() / 1000);
        }
    } catch (e) {}
    
    return 0;
}

function cleanVideoTitle(title) {
    if (!title) return "Unknown";
    return title
        .replace(/\s*-\s*Spankbang\.com\s*$/i, '')
        .replace(/\s*\|\s*Spankbang\s*$/i, '')
        .replace(/\s*-\s*Spankbang\s*$/i, '')
        .trim();
}

function createThumbnails(thumbnail) {
    if (!thumbnail) {
        return new Thumbnails([]);
    }
    return new Thumbnails([
        new Thumbnail(thumbnail, 0)
    ]);
}

function createPlatformAuthor(uploader) {
    const avatar = uploader.avatar || "";
    const authorUrl = uploader.url || "";
    const authorName = uploader.name || "";

    return new PlatformAuthorLink(
        new PlatformID(PLATFORM, authorName, plugin.config.id),
        authorName,
        authorUrl,
        avatar
    );
}

function createPlatformVideo(videoData) {
    return new PlatformVideo({
        id: new PlatformID(PLATFORM, videoData.id || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: createThumbnails(videoData.thumbnail),
        author: createPlatformAuthor(videoData.uploader || {}),
        datetime: videoData.uploadDate || 0,
        duration: videoData.duration || 0,
        viewCount: videoData.views || 0,
        url: videoData.url || `${CONFIG.EXTERNAL_URL_BASE}/videos/${videoData.id}`,
        isLive: false
    });
}

function createVideoSources(videoData) {
    const videoSources = [];

    // Add HLS first (highest priority for playback)
    if (videoData.sources && (videoData.sources.hls || videoData.sources.m3u8)) {
        const hlsUrl = videoData.sources.hls || videoData.sources.m3u8;
        if (hlsUrl && hlsUrl.startsWith('http')) {
            videoSources.push(new HLSSource({
                url: hlsUrl,
                name: "HLS (Adaptive)",
                priority: true
            }));
        }
    }

    const qualityOrder = ['2160', '1080', '720', '480', '240'];

    for (const quality of qualityOrder) {
        if (videoData.sources && videoData.sources[quality] && videoData.sources[quality].startsWith('http')) {
            const config = CONFIG.VIDEO_QUALITIES[quality] || { width: 854, height: 480 };
            videoSources.push(new VideoUrlSource({
                url: videoData.sources[quality],
                name: quality + "p",
                container: "video/mp4",
                width: config.width,
                height: config.height
            }));
        }
    }

    if (videoData.sources) {
        for (const [quality, url] of Object.entries(videoData.sources)) {
            if (quality === 'hls' || quality === 'm3u8') continue;
            const alreadyAdded = qualityOrder.includes(quality);
            if (!alreadyAdded && url && url.startsWith('http')) {
                const qualityKey = quality.replace('p', '');
                const configQ = CONFIG.VIDEO_QUALITIES[qualityKey] || { width: 854, height: 480 };
                videoSources.push(new VideoUrlSource({
                    url: url,
                    name: quality.toUpperCase(),
                    container: "video/mp4",
                    width: configQ.width,
                    height: configQ.height
                }));
            }
        }
    }

    if (videoSources.length === 0) {
        throw new ScriptException("No video sources available for this video");
    }

    return videoSources;
}

function createVideoDetails(videoData, url) {
    const videoSources = createVideoSources(videoData);

    let description = videoData.description || videoData.title || "";

    const details = new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, videoData.id || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: createThumbnails(videoData.thumbnail),
        author: createPlatformAuthor(videoData.uploader || {}),
        datetime: videoData.uploadDate || 0,
        duration: videoData.duration || 0,
        viewCount: videoData.views || 0,
        url: url,
        isLive: false,
        description: description,
        video: new VideoSourceDescriptor(videoSources),
        live: null,
        subtitles: [],
        rating: videoData.rating ? new RatingScaler(videoData.rating) : null
    });

    details.getContentRecommendations = function() {
        return source.getContentRecommendations(url);
    };

    return details;
}

function extractVideoSources(html) {
    const sources = {};

    // Try to extract HLS stream first (most reliable)
    const hlsPatterns = [
        /"hls"\s*:\s*"([^"]+)"/i,
        /"sources"\s*:\s*\[\s*\{[^}]*"type"\s*:\s*"application\/x-mpegURL"[^}]*"src"\s*:\s*"([^"]+)"/i,
        /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /"(https?:\/\/[^"]+\.m3u8[^"]*)"/,
        /https?:\/\/[^\s"<>]+\.m3u8[^\s"<>]*/
    ];

    for (const pattern of hlsPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let hlsUrl = match[1].replace(/\\/g, '');
            if (hlsUrl.startsWith('//')) hlsUrl = 'https:' + hlsUrl;
            if (hlsUrl.startsWith('http') && hlsUrl.includes('.m3u8')) {
                sources.hls = hlsUrl;
                sources.m3u8 = hlsUrl;
                break;
            }
        }
    }

    // If no HLS found, try MP4 sources
    if (!sources.hls) {
        const mp4Patterns = [
            /"(\d+)p?"\s*:\s*\{\s*[^}]*"url"\s*:\s*"([^"]+\.mp4[^"]*)"/gi,
            /"quality"\s*:\s*"?(\d+)p?"?\s*[^}]*"url"\s*:\s*"([^"]+)"/gi,
            /"(\d+)"\s*:\s*"(https?:\/\/[^"]+\.mp4[^"]*)"/gi,
            /https?:\/\/[^\s"<>]+\.mp4[^\s"<>]*/g
        ];

        for (const pattern of mp4Patterns) {
            let match;
            const localPattern = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
            while ((match = localPattern.exec(html)) !== null) {
                let quality = match[1];
                let url = match[2] ? match[2].replace(/\\/g, '') : match[0].replace(/\\/g, '');
                
                if (url.startsWith('//')) url = 'https:' + url;
                if (url && url.startsWith('http') && url.includes('.mp4')) {
                    if (!quality) quality = '720';
                    if (!sources[quality] || url.length > sources[quality].length) {
                        sources[quality] = url;
                    }
                }
            }
        }
    }

    return sources;
}

function parseVideoPage(html) {
    const videoData = {
        id: "",
        title: "Unknown",
        description: "",
        thumbnail: "",
        duration: 0,
        views: 0,
        uploadDate: 0,
        uploader: {
            name: "",
            url: "",
            avatar: ""
        },
        sources: {},
        rating: null
    };

    const titlePatterns = [
        /<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i,
        /<meta\s+property="og:title"\s+content="([^"]+)"/i,
        /<title>([^<]+)<\/title>/i,
        /"name"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of titlePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            videoData.title = cleanVideoTitle(match[1].trim());
            break;
        }
    }

    const thumbPatterns = [
        /<meta\s+property="og:image"\s+content="([^"]+)"/i,
        /"thumbnailUrl"\s*:\s*"([^"]+)"/,
        /"thumbnail"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of thumbPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            videoData.thumbnail = match[1].replace(/\\/g, '');
            break;
        }
    }

    const durationPatterns = [
        /"duration"\s*:\s*"?PT?(\d+)M?(\d*)S?"?/i,
        /itemprop="duration"\s*content="PT(\d+)M(\d+)?S?"/i,
        /"duration"\s*:\s*(\d+)/
    ];

    for (const pattern of durationPatterns) {
        const match = html.match(pattern);
        if (match) {
            if (match[2] !== undefined) {
                videoData.duration = (parseInt(match[1]) || 0) * 60 + (parseInt(match[2]) || 0);
            } else {
                videoData.duration = parseInt(match[1]) || 0;
            }
            break;
        }
    }

    const viewsPatterns = [
        /"interactionCount"\s*:\s*"?(\d+)"?/,
        /(\d[\d,]*)\s*(?:views?|plays?)/i
    ];

    for (const pattern of viewsPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            videoData.views = parseViewCount(match[1]);
            break;
        }
    }

    const datePatterns = [
        /"uploadDate"\s*:\s*"([^"]+)"/,
        /itemprop="uploadDate"\s*content="([^"]+)"/i,
        /"datePublished"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of datePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            videoData.uploadDate = parseRelativeDate(match[1]);
            break;
        }
    }

    const uploaderPatterns = [
        /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*class="[^"]*user[^"]*"[^>]*>[\s\S]*?(?:<img[^>]*src="([^"]+)")?[\s\S]*?([^<]+)<\/a>/i,
        /<a[^>]*href="\/pornstar\/([^"\/]+)"[^>]*>[\s\S]*?(?:<img[^>]*src="([^"]+)")?[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*class="[^"]*uploader[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"[^}]*"url"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of uploaderPatterns) {
        const match = html.match(pattern);
        if (match) {
            if (pattern.source.includes('author')) {
                videoData.uploader.name = match[1] || "";
                videoData.uploader.url = match[2] || "";
            } else if (match[0].includes('/profile/')) {
                videoData.uploader.name = (match[3] || match[1] || "").trim();
                videoData.uploader.url = `spankbang://profile/${match[1]}`;
                videoData.uploader.avatar = match[2] || "";
            } else if (match[0].includes('/pornstar/')) {
                videoData.uploader.name = (match[3] || match[1] || "").trim();
                videoData.uploader.url = `spankbang://profile/pornstar:${match[1]}`;
                videoData.uploader.avatar = match[2] || "";
            } else {
                videoData.uploader.name = (match[2] || "").trim();
                videoData.uploader.url = match[1] || "";
            }
            if (videoData.uploader.name) break;
        }
    }

    videoData.sources = extractVideoSources(html);

    const descPatterns = [
        /<meta\s+name="description"\s+content="([^"]+)"/i,
        /<meta\s+property="og:description"\s+content="([^"]+)"/i,
        /"description"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of descPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            videoData.description = match[1].replace(/\\n/g, '\n').trim();
            break;
        }
    }

    return videoData;
}

function parseSearchResults(html) {
    const videos = [];
    const seenIds = new Set();

    // First, try to find all video links on the page
    const allVideoLinksPattern = /href="([^"]*\/videos\/[^"]+)"/gi;
    let linkMatch;
    let videoUrlsFound = [];
    
    while ((linkMatch = allVideoLinksPattern.exec(html)) !== null) {
        const url = linkMatch[1].startsWith('http') ? linkMatch[1] : BASE_URL + linkMatch[1];
        videoUrlsFound.push(url);
    }

    // Remove duplicates and process
    for (const videoUrl of videoUrlsFound) {
        if (videos.length >= 100) break;
        
        const idMatch = videoUrl.match(/-(\d+)$/) || videoUrl.match(/\/videos\/([^\/\?-]+)/);
        const videoId = idMatch ? idMatch[1] : generateVideoId();
        
        if (seenIds.has(videoId)) continue;
        seenIds.add(videoId);

        // Extract title from URL or surrounding context
        let title = videoUrl.split('/videos/')[1]?.replace(/-/g, ' ') || "Unknown";
        
        // Try to find better title in nearby text
        const contextIdx = html.indexOf(videoUrl);
        if (contextIdx > 0) {
            const context = html.substring(Math.max(0, contextIdx - 500), Math.min(html.length, contextIdx + 200));
            
            const titleMatch = context.match(/title="([^"]+)"|<[^>]*>([^<]{5,100})<\/a>/);
            if (titleMatch && (titleMatch[1] || titleMatch[2])) {
                title = cleanVideoTitle(titleMatch[1] || titleMatch[2]);
            }
        }

        let thumbnail = "";
        const thumbPatterns = [
            /poster="([^"]+)"/,
            /(?:data-src|src)="([^"]+xh[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/,
            /(?:data-src|src)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/
        ];

        if (contextIdx > 0) {
            const thumbContext = html.substring(Math.max(0, contextIdx - 300), Math.min(html.length, contextIdx + 100));
            for (const pattern of thumbPatterns) {
                const match = thumbContext.match(pattern);
                if (match && match[1]) {
                    thumbnail = match[1];
                    if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
                    break;
                }
            }
        }

        videos.push({
            id: videoId,
            title: title || "Unknown",
            thumbnail: thumbnail,
            duration: 0,
            views: 0,
            uploadDate: 0,
            url: videoUrl,
            uploader: { name: "", url: "", avatar: "" }
        });
    }

    return videos;
}

function generateVideoId() {
    return 'unknown_' + Math.random().toString(36).substr(2, 9);
}

function parseRelatedVideos(html) {
    const relatedVideos = [];
    const seenIds = new Set();

    const relatedSectionPatterns = [
        /<div[^>]*class="[^"]*(?:related|recommendation)[^"]*"[^>]*>([\s\S]*?)(?:<\/div>|<\/section>)/i,
        /<section[^>]*class="[^"]*(?:related|recommendation)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
        /<div[^>]*id="[^"]*related[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ];

    let sectionHtml = html;
    for (const pattern of relatedSectionPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            sectionHtml = match[1];
            break;
        }
    }

    const linkPatterns = [
        /href="([^"]*\/videos\/[^"]+)"[^>]*(?:title|alt)="([^"]+)"/gi,
        /<a[^>]*href="([^"]*\/videos\/[^"]+)"[^>]*>[\s\S]*?<(?:h\d|span)[^>]*>([^<]+)</gi,
        /href="([^"]*\/videos\/[^"]+)"[^>]*>([^<]+)<\/a>/gi
    ];
    
    for (const linkPattern of linkPatterns) {
        let match;
        while ((match = linkPattern.exec(sectionHtml)) !== null && relatedVideos.length < 30) {
            const videoUrl = match[1].startsWith('http') ? match[1] : BASE_URL + match[1];
            const idMatch = videoUrl.match(/-(\d+)$/) || videoUrl.match(/\/videos\/([^\/-]+)/);
            const videoId = idMatch ? idMatch[1] : generateVideoId();

            if (seenIds.has(videoId) || !videoId) continue;
            seenIds.add(videoId);

            relatedVideos.push({
                id: videoId,
                title: cleanVideoTitle(match[2]),
                thumbnail: "",
                duration: 0,
                views: 0,
                url: videoUrl,
                uploader: { name: "", url: "", avatar: "" }
            });
        }
        
        if (relatedVideos.length > 0) break;
    }
    
    if (relatedVideos.length === 0) {
        const allLinksPattern = /href="([^"]*\/videos\/[^"]+)"[^>]*(?:title|alt)="([^"]+)"/gi;
        let match;
        while ((match = allLinksPattern.exec(html)) !== null && relatedVideos.length < 30) {
            const videoUrl = match[1].startsWith('http') ? match[1] : BASE_URL + match[1];
            const idMatch = videoUrl.match(/-(\d+)$/) || videoUrl.match(/\/videos\/([^\/-]+)/);
            const videoId = idMatch ? idMatch[1] : generateVideoId();

            if (seenIds.has(videoId) || !videoId) continue;
            seenIds.add(videoId);

            relatedVideos.push({
                id: videoId,
                title: cleanVideoTitle(match[2]),
                thumbnail: "",
                duration: 0,
                views: 0,
                url: videoUrl,
                uploader: { name: "", url: "", avatar: "" }
            });
        }
    }

    return relatedVideos;
}

function parsePornstarsPage(html) {
    const pornstars = [];

    const pornstarPatterns = [
        /<a[^>]*href="\/pornstar\/([^"\/]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<\/a>/gi,
        /<div[^>]*class="[^"]*pornstar[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/pornstar\/([^"\/]+)"[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<\/div>/gi
    ];

    for (const pattern of pornstarPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const pornstarSlug = match[1].replace(/\/$/, '');
            let avatar = match[2];

            if (avatar.startsWith('//')) {
                avatar = `https:${avatar}`;
            } else if (!avatar.startsWith('http')) {
                avatar = `https://spankbang.com${avatar}`;
            }

            let name = pornstarSlug.replace(/-/g, ' ');
            name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

            const existingIndex = pornstars.findIndex(p => p.id === `pornstar:${pornstarSlug}`);
            if (existingIndex === -1) {
                pornstars.push({
                    id: `pornstar:${pornstarSlug}`,
                    name: name,
                    avatar: avatar,
                    url: `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${pornstarSlug}`,
                    subscribers: 0,
                    videoCount: 0
                });
            }
        }

        if (pornstars.length > 0) break;
    }

    return pornstars;
}

function parseChannelPage(html, channelUrl) {
    const channelData = {
        id: "",
        name: "Unknown",
        description: "",
        thumbnail: "",
        banner: "",
        subscribers: 0,
        videoCount: 0,
        url: channelUrl
    };

    const namePatterns = [
        /<h1[^>]*class="[^"]*(?:user-name|title)[^"]*"[^>]*>([^<]+)<\/h1>/i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
        /<meta\s+property="og:title"\s+content="([^"]+)"/i,
        /<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i
    ];

    for (const pattern of namePatterns) {
        const match = html.match(pattern);
        if (match && match[1] && match[1].trim().length > 0) {
            channelData.name = match[1].trim();
            break;
        }
    }

    const avatarPatterns = [
        /<img[^>]*class="[^"]*(?:user-avatar|avatar|profile-picture)[^"]*"[^>]*(?:src|data-src)="([^"]+)"/i,
        /<img[^>]*(?:src|data-src)="([^"]+)"[^>]*class="[^"]*(?:user-avatar|avatar|profile-picture)[^"]*"/i,
        /<meta\s+property="og:image"\s+content="([^"]+)"/i,
        /<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i
    ];

    for (const pattern of avatarPatterns) {
        const match = html.match(pattern);
        if (match && match[1] && match[1].length > 0) {
            let avatar = match[1];
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            if (!avatar.startsWith('http')) avatar = 'https:' + avatar;
            channelData.thumbnail = avatar;
            break;
        }
    }

    const subscribersPatterns = [
        /(\d[\d,]*)\s*(?:subscribers?|followers?)/i,
        /class="[^"]*subscribers?[^"]*"[^>]*>[\s\S]*?(\d[\d,]*)/i
    ];
    
    for (const pattern of subscribersPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            channelData.subscribers = parseViewCount(match[1]);
            break;
        }
    }

    const videoCountPatterns = [
        /(\d[\d,]*)\s*videos?/i,
        /class="[^"]*video-count[^"]*"[^>]*>[\s\S]*?(\d[\d,]*)/i
    ];
    
    for (const pattern of videoCountPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            channelData.videoCount = parseViewCount(match[1]);
            break;
        }
    }

    const descPatterns = [
        /<div[^>]*class="[^"]*(?:user-about|description|bio)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<meta\s+name="description"\s+content="([^"]+)"/i,
        /<p[^>]*class="[^"]*(?:description|bio)[^"]*"[^>]*>([^<]+)<\/p>/i
    ];

    for (const pattern of descPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            channelData.description = match[1].replace(/<[^>]*>/g, '').trim();
            if (channelData.description.length > 10) break;
        }
    }

    return channelData;
}

source.enable = function(conf, settings, savedState) {
    config = conf ?? {};
    
    // Check if authentication cookies are available from Grayjay's auth system
    if (config.authentication && config.authentication.cookies) {
        try {
            // Grayjay provides cookies as an object or array
            let cookieString = "";
            
            if (typeof config.authentication.cookies === 'string') {
                cookieString = config.authentication.cookies;
            } else if (Array.isArray(config.authentication.cookies)) {
                cookieString = config.authentication.cookies.join('; ');
            } else if (typeof config.authentication.cookies === 'object') {
                // Convert cookie object to string format
                cookieString = Object.entries(config.authentication.cookies)
                    .map(([key, value]) => `${key}=${value}`)
                    .join('; ');
            }
            
            if (cookieString && cookieString.trim().length > 0) {
                setCookies(cookieString);
                log("Authentication cookies loaded from Grayjay authentication");
            }
        } catch (e) {
            log("Failed to load cookies from authentication: " + e.message);
        }
    }
    
    // Fallback: Load settings (for backward compatibility if any custom settings exist)
    if (!state.authCookies && settings && settings.authCookies) {
        try {
            const cookieValue = typeof settings.authCookies === 'string' 
                ? settings.authCookies 
                : settings.authCookies;
            
            if (cookieValue && cookieValue.trim().length > 0) {
                setCookies(cookieValue);
                log("Authentication cookies loaded from settings");
            }
        } catch (e) {
            log("Failed to load cookies from settings: " + e.message);
        }
    }
    
    // Restore previous state if available
    if (!state.authCookies && savedState) {
        try {
            const parsed = JSON.parse(savedState);
            if (parsed.authCookies) {
                state = { ...state, ...parsed };
                log("Authentication state restored from saved state");
            }
        } catch (e) {
            log("Failed to parse saved state: " + e.message);
        }
    }
    
    log("Spankbang plugin enabled. Authenticated: " + state.isAuthenticated);
    return true;
};

source.disable = function() {
    log("Spankbang plugin disabled");
};

source.saveState = function() {
    return JSON.stringify(state);
};

source.getHome = function() {
    return new ContentPager(getHomeResults(1), true, { page: 1 });
};

function getHomeResults(page) {
    // Parse the homepage directly - most reliable
    let url = BASE_URL + "/";
    log("Fetching home page: " + url);
    
    try {
        const html = makeRequest(url, API_HEADERS, 'home page');
        const videos = parseSearchResults(html);
        return videos.map(v => createPlatformVideo(v));
    } catch (error) {
        log("Home page error: " + error.message);
        throw error;
    }
}

source.getHomePager = function(context) {
    const nextPage = (context.page || 1) + 1;
    const videos = getHomeResults(nextPage);
    return new ContentPager(videos, videos.length > 0, { page: nextPage });
};

source.searchSuggestions = function(query) {
    return [];
};

source.getSearchCapabilities = function() {
    return {
        types: [Type.Feed.Videos],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.search = function(query, type, order, filters) {
    return new ContentPager(getSearchResults(query, 1), true, { query: query, page: 1 });
};

function getSearchResults(query, page) {
    const encodedQuery = encodeURIComponent(query);
    const url = page > 1 
        ? `${BASE_URL}/search/${encodedQuery}?page=${page}`
        : `${BASE_URL}/search/${encodedQuery}`;
    
    log("Searching: " + url);
    
    const html = makeRequest(url, API_HEADERS, 'search');
    const videos = parseSearchResults(html);
    
    return videos.map(v => createPlatformVideo(v));
}

source.getSearchPager = function(context) {
    const nextPage = (context.page || 1) + 1;
    const videos = getSearchResults(context.query, nextPage);
    return new ContentPager(videos, videos.length > 0, { query: context.query, page: nextPage });
};

source.getSearchChannelContentsCapabilities = function() {
    return {
        types: [Type.Feed.Videos],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.searchChannelContents = function(channelUrl, query, type, order, filters) {
    return new VideoPager([]);
};

source.searchChannels = function(query) {
    return new ChannelPager([]);
};

source.isContentDetailsUrl = function(url) {
    return url.includes('/videos/');
};

source.getContentDetails = function(url) {
    log("Getting video details for: " + url);
    
    const html = makeRequest(url, API_HEADERS, 'video details');
    const videoData = parseVideoPage(html);
    
    const idMatch = url.match(/-(\d+)$/) || url.match(/\/videos\/([^\/-]+)/);
    videoData.id = idMatch ? idMatch[1] : "";
    
    return createVideoDetails(videoData, url);
};

source.getContentRecommendations = function(url) {
    log("Getting recommendations for: " + url);
    
    try {
        const html = makeRequest(url, API_HEADERS, 'recommendations');
        const relatedVideos = parseRelatedVideos(html);
        
        return relatedVideos.map(v => createPlatformVideo(v));
    } catch (e) {
        log("Failed to get recommendations: " + e.message);
        return [];
    }
};

source.isChannelUrl = function(url) {
    return url.includes('/profile/') || url.includes('/pornstar/') || url.includes('/creators/') ||
           url.includes('spankbang://profile/') || url.includes('spankbang://channel/');
};

source.getChannel = function(url) {
    log("Getting channel: " + url);
    
    let channelUrl = url;
    
    if (url.startsWith('spankbang://')) {
        const channelInfo = extractChannelId(url);
        if (channelInfo.type === 'pornstar') {
            channelUrl = `${BASE_URL}/pornstar/${channelInfo.id}`;
        } else if (channelInfo.type === 'user') {
            channelUrl = `${BASE_URL}/profile/${channelInfo.id}`;
        } else if (channelInfo.type === 'creator') {
            channelUrl = `${BASE_URL}/creators/${channelInfo.id}`;
        }
    }
    
    const html = makeRequest(channelUrl, API_HEADERS, 'channel page');
    const channelData = parseChannelPage(html, channelUrl);
    
    const channelInfo = extractChannelId(url);
    channelData.id = channelInfo.id;
    
    return new PlatformChannel({
        id: new PlatformID(PLATFORM, channelData.id, plugin.config.id),
        name: channelData.name,
        thumbnail: channelData.thumbnail,
        banner: channelData.banner,
        subscribers: channelData.subscribers,
        description: channelData.description,
        url: channelUrl,
        links: {}
    });
};

source.getChannelContents = function(url, type, order, filters) {
    return new ContentPager(getChannelVideos(url, 1), true, { url: url, page: 1 });
};

function getChannelVideos(url, page) {
    let channelUrl = url;
    
    if (url.startsWith('spankbang://')) {
        const channelInfo = extractChannelId(url);
        if (channelInfo.type === 'pornstar') {
            channelUrl = `${BASE_URL}/pornstar/${channelInfo.id}`;
        } else if (channelInfo.type === 'user') {
            channelUrl = `${BASE_URL}/profile/${channelInfo.id}`;
        } else if (channelInfo.type === 'creator') {
            channelUrl = `${BASE_URL}/creators/${channelInfo.id}`;
        }
    } else if (!url.includes('/videos')) {
        channelUrl = url.replace(/\/$/, '') + '/videos';
    }
    
    if (page > 1) {
        channelUrl = channelUrl + `/${page}`;
    }
    
    log("Fetching channel videos: " + channelUrl);
    
    const html = makeRequest(channelUrl, API_HEADERS, 'channel videos');
    const videos = parseSearchResults(html);
    
    return videos.map(v => createPlatformVideo(v));
}

source.getChannelContentsPager = function(context) {
    const nextPage = (context.page || 1) + 1;
    const videos = getChannelVideos(context.url, nextPage);
    return new ContentPager(videos, videos.length > 0, { url: context.url, page: nextPage });
};

source.getChannelCapabilities = function() {
    return {
        types: [Type.Feed.Videos],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.getCreators = function(query, options) {
    return new CreatorPager(getCreatorResults(query, 1), true, { query: query, page: 1 });
};

function getCreatorResults(query, page) {
    const encodedQuery = encodeURIComponent(query);
    const url = page > 1
        ? `${BASE_URL}/pornstar/search/${encodedQuery}?page=${page}`
        : `${BASE_URL}/pornstar/search/${encodedQuery}`;
    
    log("Searching creators: " + url);
    
    const html = makeRequest(url, API_HEADERS, 'creator search');
    const pornstars = parsePornstarsPage(html);
    
    return pornstars.map(p => {
        return new PlatformAuthorLink(
            new PlatformID(PLATFORM, p.id, plugin.config.id),
            p.name,
            `spankbang://profile/pornstar:${p.id.replace('pornstar:', '')}`,
            p.avatar,
            p.subscribers
        );
    });
}

source.getCreatorsPager = function(context) {
    const nextPage = (context.page || 1) + 1;
    const creators = getCreatorResults(context.query, nextPage);
    return new CreatorPager(creators, creators.length > 0, { query: context.query, page: nextPage });
};

source.getComments = function(url) {
    return new CommentPager([], false, {});
};

source.getSubComments = function(comment) {
    return new CommentPager([], false, {});
};

function parseSubscriptionsPage(html) {
    const subscriptions = [];
    const seenIds = new Set();

    // Parse user subscriptions from /users/subscriptions
    const userSubPatterns = [
        /<a[^>]*href="\/profile\/([^"\/\?]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[^>]*alt="([^"]+)"/gi,
        /<div[^>]*class="[^"]*profile[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/profile\/([^"\/]+)"[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?([^<]+)<\/a>/gi
    ];

    for (const pattern of userSubPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const profileSlug = match[1].replace(/\/$/, '');
            if (seenIds.has(profileSlug)) continue;
            seenIds.add(profileSlug);

            let avatar = match[2] || "";
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (!avatar.startsWith('http') && avatar) avatar = 'https://spankbang.com' + avatar;

            const name = (match[3] || profileSlug.replace(/-/g, ' ')).trim();

            subscriptions.push({
                id: profileSlug,
                name: name,
                url: `spankbang://profile/${profileSlug}`,
                avatar: avatar,
                type: 'user'
            });
        }
    }

    return subscriptions;
}

function parsePornstarSubscriptionsPage(html) {
    const subscriptions = [];
    const seenIds = new Set();

    // Parse pornstar subscriptions from /users/subscriptions_pornstars
    const pornstarSubPatterns = [
        /<a[^>]*href="\/pornstar\/([^"\/\?]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[^>]*alt="([^"]+)"/gi,
        /<div[^>]*class="[^"]*pornstar[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/pornstar\/([^"\/]+)"[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<\/div>/gi
    ];

    for (const pattern of pornstarSubPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const pornstarSlug = match[1].replace(/\/$/, '');
            if (seenIds.has(`pornstar:${pornstarSlug}`)) continue;
            seenIds.add(`pornstar:${pornstarSlug}`);

            let avatar = match[2] || "";
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (!avatar.startsWith('http') && avatar) avatar = 'https://spankbang.com' + avatar;

            let name = match[3] || pornstarSlug.replace(/-/g, ' ');
            name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

            subscriptions.push({
                id: `pornstar:${pornstarSlug}`,
                name: name,
                url: `spankbang://profile/pornstar:${pornstarSlug}`,
                avatar: avatar,
                type: 'pornstar'
            });
        }
    }

    return subscriptions;
}

function parsePlaylistsPage(html) {
    const playlists = [];
    const seenIds = new Set();

    // Parse playlists from /users/playlists
    const playlistPatterns = [
        /<a[^>]*href="\/playlist\/([^"\/\?]+)"[^>]*>[\s\S]*?<[^>]*>([^<]+)<\/[^>]*>/gi,
        /<div[^>]*class="[^"]*playlist[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/playlist\/([^"\/]+)"[^>]*title="([^"]+)"/gi
    ];

    for (const pattern of playlistPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const playlistId = match[1].replace(/\/$/, '');
            if (seenIds.has(playlistId)) continue;
            seenIds.add(playlistId);

            const name = (match[2] || playlistId.replace(/-/g, ' ')).trim();

            playlists.push({
                id: playlistId,
                name: name,
                url: `${BASE_URL}/playlist/${playlistId}`
            });
        }
    }

    return playlists;
}

function parseHistoryPage(html) {
    const historyVideos = [];
    const seenIds = new Set();

    // Parse history videos from /users/history
    const videoPatterns = [
        /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>[\s\S]*?href="([^"]+)"[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)<[\s\S]*?<span[^>]*class="[^"]*(?:duration|time)[^"]*"[^>]*>([^<]+)</gi,
        /<a[^>]*href="(\/[^"]+\/video\/[^"]+)"[^>]*>[\s\S]{0,500}?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]{0,300}?(?:<[^>]*>)*([^<]{5,100})<[\s\S]{0,200}?<span[^>]*>([^<]+)<\/span>/gi
    ];

    for (const pattern of videoPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            let videoUrl = match[1];
            if (!videoUrl.startsWith('http')) {
                videoUrl = BASE_URL + videoUrl;
            }

            const idMatch = videoUrl.match(/-(\d+)$/) || videoUrl.match(/\/([^\/\?-]+)\/video/);
            const videoId = idMatch ? idMatch[1] : generateVideoId();

            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);

            let thumbnail = match[2] || "";
            if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
            else if (!thumbnail.startsWith('http') && thumbnail) thumbnail = BASE_URL + thumbnail;

            const title = cleanVideoTitle(match[3] || "Unknown");
            const durationStr = match[4] || "0:00";
            const duration = parseDuration(durationStr);

            historyVideos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail,
                duration: duration,
                views: 0,
                uploadDate: 0,
                url: videoUrl,
                uploader: { name: "", url: "", avatar: "" }
            });
        }
    }

    // If no videos found with detailed patterns, try simpler pattern
    if (historyVideos.length === 0) {
        const simplePattern = /href="([^"]*\/[^"]+\/video\/[^"]+)"/gi;
        let match;
        while ((match = simplePattern.exec(html)) !== null) {
            let videoUrl = match[1];
            if (!videoUrl.startsWith('http')) {
                videoUrl = BASE_URL + videoUrl;
            }

            const idMatch = videoUrl.match(/-(\d+)$/) || videoUrl.match(/\/([^\/\?-]+)\/video/);
            const videoId = idMatch ? idMatch[1] : generateVideoId();

            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);

            // Try to find thumbnail near the link
            const contextIdx = html.indexOf(match[0]);
            let thumbnail = "";
            let title = "Unknown";
            let duration = 0;

            if (contextIdx > 0) {
                const context = html.substring(Math.max(0, contextIdx - 500), Math.min(html.length, contextIdx + 300));
                
                const thumbMatch = context.match(/(?:data-src|src)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/);
                if (thumbMatch) {
                    thumbnail = thumbMatch[1];
                    if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
                }

                const titleMatch = context.match(/title="([^"]+)"/);
                if (titleMatch) {
                    title = cleanVideoTitle(titleMatch[1]);
                }

                const durationMatch = context.match(/<span[^>]*class="[^"]*(?:duration|time)[^"]*"[^>]*>([^<]+)<\/span>/);
                if (durationMatch) {
                    duration = parseDuration(durationMatch[1]);
                }
            }

            historyVideos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail,
                duration: duration,
                views: 0,
                uploadDate: 0,
                url: videoUrl,
                uploader: { name: "", url: "", avatar: "" }
            });
        }
    }

    return historyVideos;
}

source.getUserSubscriptions = function() {
    log("Getting user subscriptions");
    
    // Validate cookies first
    const cookieValidation = validateCookies();
    if (!cookieValidation.valid) {
        log("Cookie validation failed: " + cookieValidation.message);
        throw new ScriptException(cookieValidation.message);
    }
    
    const subscriptions = [];
    
    try {
        // Fetch user subscriptions using authenticated headers
        log("Fetching user subscriptions from /users/subscriptions");
        const userSubsHtml = makeRequest(`${BASE_URL}/users/subscriptions`, getAuthHeaders(), 'user subscriptions');
        
        const userSubs = parseSubscriptionsPage(userSubsHtml);
        subscriptions.push(...userSubs);
        log(`Found ${userSubs.length} user subscriptions`);
    } catch (error) {
        log("Failed to fetch user subscriptions: " + error.message);
        if (error.message.includes("401") || error.message.includes("403")) {
            throw new ScriptException("Authentication failed. Please update your cookies in plugin settings.");
        }
    }
    
    try {
        // Fetch pornstar subscriptions using authenticated headers
        log("Fetching pornstar subscriptions from /users/subscriptions_pornstars");
        const pornstarSubsHtml = makeRequest(`${BASE_URL}/users/subscriptions_pornstars`, getAuthHeaders(), 'pornstar subscriptions');
        
        const pornstarSubs = parsePornstarSubscriptionsPage(pornstarSubsHtml);
        subscriptions.push(...pornstarSubs);
        log(`Found ${pornstarSubs.length} pornstar subscriptions`);
    } catch (error) {
        log("Failed to fetch pornstar subscriptions: " + error.message);
    }
    
    log(`Total subscriptions found: ${subscriptions.length}`);
    return subscriptions.map(sub => sub.url);
};

source.getUserPlaylists = function() {
    log("Getting user playlists");

    // Validate cookies first
    const cookieValidation = validateCookies();
    if (!cookieValidation.valid) {
        log("Cookie validation failed: " + cookieValidation.message);
        throw new ScriptException(cookieValidation.message);
    }

    try {
        // Fetch playlists using authenticated headers
        log("Fetching playlists from /users/playlists");
        const playlistsHtml = makeRequest(`${BASE_URL}/users/playlists`, getAuthHeaders(), 'user playlists');
        
        const playlists = parsePlaylistsPage(playlistsHtml);
        log(`Found ${playlists.length} playlists`);
        return playlists.map(pl => pl.url);
    } catch (error) {
        log("Failed to fetch playlists: " + error.message);
        if (error.message.includes("401") || error.message.includes("403")) {
            throw new ScriptException("Authentication failed. Please update your cookies in plugin settings.");
        }
        return [];
    }
};

source.getUserHistory = function() {
    log("Getting user watch history");

    // Validate cookies first
    const cookieValidation = validateCookies();
    if (!cookieValidation.valid) {
        log("Cookie validation failed: " + cookieValidation.message);
        throw new ScriptException(cookieValidation.message);
    }

    try {
        // Fetch watch history using authenticated headers
        log("Fetching history from /users/history");
        const historyHtml = makeRequest(`${BASE_URL}/users/history`, getAuthHeaders(), 'user history');
        
        const historyVideos = parseHistoryPage(historyHtml);
        log(`Found ${historyVideos.length} history videos`);
        
        // Return as PlatformVideo objects
        return historyVideos.map(v => createPlatformVideo(v));
    } catch (error) {
        log("Failed to fetch history: " + error.message);
        if (error.message.includes("401") || error.message.includes("403")) {
            throw new ScriptException("Authentication failed. Please update your cookies in plugin settings.");
        }
        return [];
    }
};

source.getPlaylist = function(url) {
    throw new ScriptException("Playlists not implemented");
};

source.canDownload = function(video) {
    return true;
};

source.getDownloadables = function(video) {
    try {
        const url = video.url.value || video.url;
        const html = makeRequest(url, API_HEADERS, 'video download');
        const videoData = parseVideoPage(html);
        
        const downloads = [];
        
        if (videoData.sources) {
            const qualityOrder = ['2160', '1080', '720', '480', '240'];
            for (const quality of qualityOrder) {
                if (videoData.sources[quality] && videoData.sources[quality].startsWith('http')) {
                    const name = quality + "p";
                    downloads.push(new Downloadable({
                        name: name,
                        url: videoData.sources[quality],
                        mimeType: "video/mp4"
                    }));
                }
            }
        }
        
        if (videoData.sources && (videoData.sources.hls || videoData.sources.m3u8)) {
            const hlsUrl = videoData.sources.hls || videoData.sources.m3u8;
            downloads.push(new Downloadable({
                name: "HLS Stream",
                url: hlsUrl,
                mimeType: "application/x-mpegURL"
            }));
        }
        
        if (downloads.length === 0) {
            log("No downloads available for video: " + url);
            return [];
        }
        
        return downloads;
    } catch (error) {
        log("Failed to get downloadables: " + error.message);
        return [];
    }
};

log("Spankbang plugin loaded");

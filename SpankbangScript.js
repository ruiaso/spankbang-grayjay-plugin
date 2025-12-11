const BASE_URL = "https://spankbang.com";
const PLATFORM = "SpankBang";
const PLATFORM_CLAIMTYPE = 3;

var config = {};
let localConfig = {
    pornstarShortIds: {}
};
var state = {
    sessionCookie: "",
    isAuthenticated: false,
    authCookies: "",
    username: "",
    userId: ""
};

const CONFIG = {
    DEFAULT_PAGE_SIZE: 20,
    COMMENTS_PAGE_SIZE: 50,
    VIDEO_QUALITIES: {
        "240": { name: "240p", width: 320, height: 240 },
        "320": { name: "320p", width: 480, height: 320 },
        "360": { name: "360p", width: 640, height: 360 },
        "480": { name: "480p", width: 854, height: 480 },
        "720": { name: "720p", width: 1280, height: 720 },
        "1080": { name: "1080p", width: 1920, height: 1080 },
        "2160": { name: "4K", width: 3840, height: 2160 },
        "4k": { name: "4K", width: 3840, height: 2160 }
    },
    INTERNAL_URL_SCHEME: "spankbang://profile/",
    EXTERNAL_URL_BASE: "https://spankbang.com",
    PORNSTAR_IMG_BASE: "https://spankbang.com/pornstarimg/f/",
    SEARCH_FILTERS: {
        DURATION: {
            ANY: "",
            SHORT: "1",
            MEDIUM: "2",
            LONG: "3"
        },
        QUALITY: {
            ANY: "",
            HD: "1",
            FHD: "2",
            UHD: "3"
        },
        PERIOD: {
            ANY: "",
            TODAY: "1",
            WEEK: "2",
            MONTH: "3",
            YEAR: "4"
        },
        ORDER: {
            RELEVANCE: "",
            NEW: "1",
            TRENDING: "2",
            POPULAR: "3",
            VIEWS: "4",
            RATING: "5",
            LENGTH: "6"
        }
    }
};

const API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
};

const REGEX_PATTERNS = {
    urls: {
        videoStandard: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-zA-Z0-9]+)\/video\/.+$/,
        videoAlternative: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-zA-Z0-9]+)\/embed\/.+$/,
        videoShort: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-zA-Z0-9]+)\/.*$/,
        channelProfile: /^https?:\/\/(?:www\.)?spankbang\.com\/profile\/([^\/\?]+)/,
        channelOfficial: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-z0-9]+)\/channel\/([^\/\?]+)/,
        channelS: /^https?:\/\/(?:www\.)?spankbang\.com\/s\/([^\/\?]+)/,
        pornstar: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-z0-9]+)\/pornstar\/([^\/\?]+)/,
        pornstarSimple: /^https?:\/\/(?:www\.)?spankbang\.com\/pornstar\/([^\/\?]+)/,
        playlistInternal: /^spankbang:\/\/playlist\/(.+)$/,
        categoryInternal: /^spankbang:\/\/category\/(.+)$/,
        channelInternal: /^spankbang:\/\/channel\/(.+)$/,
        profileInternal: /^spankbang:\/\/profile\/(.+)$/,
        relativeProfile: /^\/profile\/([^\/\?]+)/,
        relativeChannel: /^\/([a-z0-9]+)\/channel\/([^\/\?]+)/,
        relativeS: /^\/s\/([^\/\?]+)/,
        relativePornstar: /^\/([a-z0-9]+)\/pornstar\/([^\/\?]+)/,
        relativePornstarSimple: /^\/pornstar\/([^\/\?]+)/
    },
    extraction: {
        videoId: /\/([a-zA-Z0-9]+)\/(?:video|embed|play)/,
        videoIdShort: /spankbang\.com\/([a-zA-Z0-9]+)\//,
        profileName: /\/(?:profile|s)\/([^\/\?]+)/,
        pornstarName: /\/pornstar\/([^\/\?]+)/,
        pornstarWithId: /\/([a-z0-9]+)\/pornstar\/([^\/\?]+)/,
        streamUrl: /stream_url_([0-9]+p)\s*=\s*'([^']+)'/g,
        m3u8Url: /source\s*src="([^"]+\.m3u8[^"]*)"/,
        title: /<h1[^>]*title="([^"]+)"/,
        duration: /itemprop="duration"\s*content="PT(\d+)M(\d+)?S?"/,
        views: /"interactionCount"\s*:\s*"?(\d+)"?/,
        uploadDate: /itemprop="uploadDate"\s*content="([^"]+)"/,
        thumbnail: /itemprop="thumbnailUrl"\s*content="([^"]+)"/,
        uploader: /class="n"\s*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</
    },
    parsing: {
        duration: /(\d+)h|(\d+)m|(\d+)s/g,
        htmlTags: /<[^>]*>/g,
        htmlBreaks: /<br\s*\/?>/gi
    }
};

function getAuthHeaders() {
    const headers = { ...API_HEADERS };
    if (state.authCookies && state.authCookies.length > 0) {
        headers["Cookie"] = state.authCookies;
    }
    return headers;
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

function resolvePornstarShortId(slug) {
    if (!localConfig.pornstarShortIds) {
        localConfig.pornstarShortIds = {};
    }
    
    const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '+');
    
    if (localConfig.pornstarShortIds[normalizedSlug]) {
        return localConfig.pornstarShortIds[normalizedSlug];
    }
    
    const simpleUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${normalizedSlug}`;
    log("Resolving pornstar shortId for: " + normalizedSlug + " via " + simpleUrl);
    const response = makeRequestNoThrow(simpleUrl, API_HEADERS, 'pornstar lookup');
    
    if (response.isOk && response.body) {
        const patterns = [
            new RegExp(`href=["']/([a-z0-9]+)/pornstar/${normalizedSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
            /<link[^>]*rel="canonical"[^>]*href="[^"]*\/([a-z0-9]+)\/pornstar\//i,
            /href="\/([a-z0-9]+)\/pornstar\/[^"]+"/,
            /data-pornstar-id="([a-z0-9]+)"/i,
            /"pornstar_id"\s*:\s*"?([a-z0-9]+)"?/i
        ];
        
        for (const pattern of patterns) {
            const match = response.body.match(pattern);
            if (match && match[1] && match[1].length >= 3 && match[1].length <= 10) {
                log("Found shortId via pattern: " + match[1]);
                localConfig.pornstarShortIds[normalizedSlug] = match[1];
                return match[1];
            }
        }
    }
    
    try {
        const searchUrl = `${BASE_URL}/s/${normalizedSlug}/`;
        log("Trying search fallback: " + searchUrl);
        const searchResponse = makeRequestNoThrow(searchUrl, API_HEADERS, 'pornstar search');
        if (searchResponse.isOk && searchResponse.body) {
            const escapedSlug = normalizedSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`href=["']/([a-z0-9]+)/pornstar/${escapedSlug}`, 'i');
            const searchMatch = searchResponse.body.match(pattern);
            if (searchMatch && searchMatch[1]) {
                log("Found shortId via search: " + searchMatch[1]);
                localConfig.pornstarShortIds[normalizedSlug] = searchMatch[1];
                return searchMatch[1];
            }
        }
    } catch (e) {
        log("Pornstar search fallback failed: " + e.message);
    }
    
    try {
        const pornstarsUrl = `${BASE_URL}/pornstars`;
        log("Trying pornstars listing fallback");
        const listResponse = makeRequestNoThrow(pornstarsUrl, API_HEADERS, 'pornstars list');
        if (listResponse.isOk && listResponse.body) {
            const escapedSlug = normalizedSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`href=["']/([a-z0-9]+)/pornstar/${escapedSlug}`, 'i');
            const listMatch = listResponse.body.match(pattern);
            if (listMatch && listMatch[1]) {
                log("Found shortId via pornstars listing: " + listMatch[1]);
                localConfig.pornstarShortIds[normalizedSlug] = listMatch[1];
                return listMatch[1];
            }
        }
    } catch (e) {
        log("Pornstars listing fallback failed: " + e.message);
    }
    
    log("Could not resolve shortId for pornstar: " + normalizedSlug);
    return null;
}

function extractVideoId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for video ID extraction");
    }

    const patterns = [
        REGEX_PATTERNS.extraction.videoId,
        REGEX_PATTERNS.extraction.videoIdShort
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
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
        return { type: 'profile', id: profileInternalMatch[1] };
    }

    const channelOfficialMatch = url.match(REGEX_PATTERNS.urls.channelOfficial);
    if (channelOfficialMatch && channelOfficialMatch[1] && channelOfficialMatch[2]) {
        return { type: 'channel', id: `${channelOfficialMatch[1]}:${channelOfficialMatch[2]}` };
    }

    const relativeChannelMatch = url.match(REGEX_PATTERNS.urls.relativeChannel);
    if (relativeChannelMatch && relativeChannelMatch[1] && relativeChannelMatch[2]) {
        return { type: 'channel', id: `${relativeChannelMatch[1]}:${relativeChannelMatch[2]}` };
    }

    const pornstarMatch = url.match(REGEX_PATTERNS.urls.pornstar);
    if (pornstarMatch && pornstarMatch[1] && pornstarMatch[2]) {
        return { type: 'pornstar', id: pornstarMatch[2], shortId: pornstarMatch[1] };
    }

    const pornstarSimpleMatch = url.match(REGEX_PATTERNS.urls.pornstarSimple);
    if (pornstarSimpleMatch && pornstarSimpleMatch[1]) {
        return { type: 'pornstar', id: pornstarSimpleMatch[1] };
    }

    const relativePornstarMatch = url.match(REGEX_PATTERNS.urls.relativePornstar);
    if (relativePornstarMatch && relativePornstarMatch[1] && relativePornstarMatch[2]) {
        return { type: 'pornstar', id: relativePornstarMatch[2], shortId: relativePornstarMatch[1] };
    }

    const relativePornstarSimpleMatch = url.match(REGEX_PATTERNS.urls.relativePornstarSimple);
    if (relativePornstarSimpleMatch && relativePornstarSimpleMatch[1]) {
        return { type: 'pornstar', id: relativePornstarSimpleMatch[1] };
    }

    const channelProfileMatch = url.match(REGEX_PATTERNS.urls.channelProfile);
    if (channelProfileMatch && channelProfileMatch[1]) {
        return { type: 'profile', id: channelProfileMatch[1] };
    }

    const relativeProfileMatch = url.match(REGEX_PATTERNS.urls.relativeProfile);
    if (relativeProfileMatch && relativeProfileMatch[1]) {
        return { type: 'profile', id: relativeProfileMatch[1] };
    }

    const profileMatch = url.match(REGEX_PATTERNS.extraction.profileName);
    if (profileMatch && profileMatch[1]) {
        return { type: 'profile', id: profileMatch[1] };
    }

    throw new ScriptException(`Could not extract channel ID from URL: ${url}`);
}

function extractProfileId(url) {
    const result = extractChannelId(url);
    if (result.type === 'channel') {
        return `channel:${result.id}`;
    } else if (result.type === 'pornstar') {
        return `pornstar:${result.id}`;
    }
    return result.id;
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

function extractAvatarFromHtml(html) {
    const avatarPatterns = [
        /src="(https?:\/\/spankbang\.com\/pornstarimg\/[^"]+)"/i,
        /src="(https?:\/\/[^"]*spankbang[^"]*\/avatar\/[^"]+)"/i,
        /src="(\/\/spankbang\.com\/avatar\/[^"]+)"/i,
        /<img[^>]*src="(\/avatar\/[^"]+)"/i,
        /src="(https?:\/\/[^"]+\/pornstarimg\/[^"]+)"/i
    ];

    for (const pattern of avatarPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let avatarUrl = match[1];
            if (avatarUrl.startsWith('//')) {
                return `https:${avatarUrl}`;
            }
            return avatarUrl.startsWith('http') ? avatarUrl : `https://spankbang.com${avatarUrl}`;
        }
    }
    return "";
}

function extractPornstarAvatarFromHtml(html, pornstarSlug) {
    const patterns = [
        new RegExp(`href="[^"]*pornstar/${pornstarSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[^>]*>[\\s\\S]*?<img[^>]*(?:data-src|src)="(https?://[^"]*pornstarimg[^"]+)"`, 'i'),
        /src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i,
        /data-src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return "";
}

function extractUploaderFromVideoToolbar(html) {
    const uploader = {
        name: "",
        url: "",
        avatar: ""
    };

    const toolbarMatch = html.match(/<ul[^>]*class="[^"]*video_toolbar[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
    const toolbarHtml = toolbarMatch ? toolbarMatch[1] : html;
    
    const infoSectionMatch = html.match(/<div[^>]*class="[^"]*info[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    const infoHtml = infoSectionMatch ? infoSectionMatch[1] : "";

    const uploaderPatterns = [
        {
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
            type: 'channel'
        },
        {
            pattern: /<li[^>]*class="[^"]*(?:channel|uploader|user)[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?(?:<img[^>]*(?:data-src|src)="([^"]+)")?[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
            type: 'channel'
        },
        {
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'channel'
        },
        {
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'pornstar'
        },
        {
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?([^<>]+)<\/a>/i,
            type: 'pornstar'
        },
        {
            pattern: /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'profile'
        }
    ];

    const searchHtmls = [toolbarHtml, infoHtml, html];
    
    for (const searchHtml of searchHtmls) {
        if (!searchHtml) continue;
        
        for (const { pattern, type } of uploaderPatterns) {
            const match = searchHtml.match(pattern);
            if (match) {
                let avatarUrl = match[3] || "";
                if (avatarUrl.startsWith('//')) {
                    avatarUrl = `https:${avatarUrl}`;
                } else if (avatarUrl && !avatarUrl.startsWith('http')) {
                    avatarUrl = `https://spankbang.com${avatarUrl}`;
                }

                if (type === 'channel') {
                    uploader.name = (match[4] || "").replace(/<[^>]*>/g, '').trim();
                    uploader.url = `spankbang://channel/${match[1]}:${match[2]}`;
                    uploader.avatar = avatarUrl;
                } else if (type === 'pornstar') {
                    uploader.name = (match[4] || "").replace(/<[^>]*>/g, '').trim();
                    uploader.url = `spankbang://profile/pornstar:${match[2]}`;
                    uploader.avatar = avatarUrl || extractPornstarAvatarFromHtml(html, match[2]);
                } else {
                    uploader.name = (match[3] || "").replace(/<[^>]*>/g, '').trim();
                    uploader.url = `spankbang://profile/${match[1]}`;
                    uploader.avatar = match[2] || "";
                }
                
                if (uploader.name && uploader.name.length > 0) {
                    if (!uploader.avatar) {
                        uploader.avatar = fetchUploaderAvatarIfNeeded(uploader, html);
                    }
                    return uploader;
                }
            }
        }
    }

    const simpleChannelPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*title="([^"]+)"/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /class="[^"]*n[^"]*"[^>]*><a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of simpleChannelPatterns) {
        const match = html.match(pattern);
        if (match) {
            uploader.name = match[3].replace(/<[^>]*>/g, '').trim();
            uploader.url = `spankbang://channel/${match[1]}:${match[2]}`;
            uploader.avatar = extractChannelAvatarNearLink(html, match[1], match[2]) || extractAvatarFromHtml(html);
            return uploader;
        }
    }

    const simplePornstarPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*title="([^"]+)"/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /class="[^"]*n[^"]*"[^>]*><a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of simplePornstarPatterns) {
        const match = html.match(pattern);
        if (match) {
            uploader.name = match[3].replace(/<[^>]*>/g, '').trim();
            uploader.url = `spankbang://profile/pornstar:${match[2]}`;
            uploader.avatar = extractPornstarAvatarFromHtml(html, match[2]) || extractAvatarFromHtml(html);
            return uploader;
        }
    }

    const simpleProfilePatterns = [
        /<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/profile\/([^"]+)"[^>]*title="([^"]+)"/i,
        /class="[^"]*n[^"]*"[^>]*><a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of simpleProfilePatterns) {
        const match = html.match(pattern);
        if (match) {
            uploader.name = match[2].replace(/<[^>]*>/g, '').trim();
            uploader.url = `spankbang://profile/${match[1]}`;
            uploader.avatar = extractAvatarFromHtml(html);
            return uploader;
        }
    }

    return uploader;
}

function extractChannelAvatarNearLink(html, shortId, channelName) {
    const patterns = [
        new RegExp(`<img[^>]*(?:data-src|src)="([^"]+)"[^>]*>[\\s\\S]{0,200}href="/${shortId}/channel/${channelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i'),
        new RegExp(`href="/${shortId}/channel/${channelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]{0,200}<img[^>]*(?:data-src|src)="([^"]+)"`, 'i'),
        new RegExp(`class="[^"]*(?:thumb|avatar|pic)[^"]*"[^>]*>[\\s\\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[^>]*>[\\s\\S]*?href="/${shortId}/channel/${channelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i')
    ];
    
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let avatar = match[1];
            if (avatar.startsWith('//')) {
                avatar = 'https:' + avatar;
            } else if (!avatar.startsWith('http')) {
                avatar = 'https://spankbang.com' + avatar;
            }
            return avatar;
        }
    }
    return "";
}

function fetchUploaderAvatarIfNeeded(uploader, html) {
    if (uploader.avatar) return uploader.avatar;
    
    if (uploader.url.includes('pornstar:')) {
        const pornstarSlug = uploader.url.split('pornstar:')[1];
        if (pornstarSlug) {
            return extractPornstarAvatarFromHtml(html, pornstarSlug);
        }
    }
    
    if (uploader.url.includes('channel/')) {
        const parts = uploader.url.split('/');
        const channelId = parts[parts.length - 1];
        if (channelId && channelId.includes(':')) {
            const [shortId, channelName] = channelId.split(':');
            return extractChannelAvatarNearLink(html, shortId, channelName);
        }
    }
    
    return extractAvatarFromHtml(html);
}

function extractUploaderFromSearchResult(block) {
    const uploader = {
        name: "",
        url: "",
        avatar: ""
    };

    const infoPatterns = [
        /<div[^>]*class="[^"]*inf[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*info[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*meta[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ];

    let searchHtml = block;
    for (const infoPattern of infoPatterns) {
        const infoMatch = block.match(infoPattern);
        if (infoMatch && infoMatch[1]) {
            searchHtml = infoMatch[1];
            break;
        }
    }

    const channelWithAvatarPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?([^<>]+)<\/a>/i
    ];

    for (const pattern of channelWithAvatarPatterns) {
        const match = block.match(pattern);
        if (match && (match[4] || match[3])) {
            const name = (match[4] || "").replace(/<[^>]*>/g, '').trim();
            let avatar = match[3] || "";
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (avatar && !avatar.startsWith('http')) avatar = 'https://spankbang.com' + avatar;
            if (name && name.length > 0 && name.length < 100) {
                uploader.name = name;
                uploader.url = `spankbang://channel/${match[1]}:${match[2]}`;
                uploader.avatar = avatar;
                return uploader;
            }
        }
    }

    const channelPatterns = [
        /<a[^>]*class="[^"]*n[^"]*"[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?([^<>]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*title="([^"]+)"/i
    ];

    for (const pattern of channelPatterns) {
        const match = searchHtml.match(pattern) || block.match(pattern);
        if (match && match[3]) {
            const name = match[3].replace(/<[^>]*>/g, '').trim();
            if (name && name.length > 0 && name.length < 100) {
                uploader.name = name;
                uploader.url = `spankbang://channel/${match[1]}:${match[2]}`;
                uploader.avatar = extractChannelAvatarNearLink(block, match[1], match[2]) || extractAvatarFromHtml(block);
                return uploader;
            }
        }
    }

    const pornstarWithAvatarPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?([^<>]+)<\/a>/i
    ];

    for (const pattern of pornstarWithAvatarPatterns) {
        const match = block.match(pattern);
        if (match && (match[4] || match[3])) {
            const name = (match[4] || "").replace(/<[^>]*>/g, '').trim();
            let avatar = match[3] || "";
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (avatar && !avatar.startsWith('http')) avatar = 'https://spankbang.com' + avatar;
            if (name && name.length > 0 && name.length < 100) {
                uploader.name = name;
                uploader.url = `spankbang://profile/pornstar:${match[2]}`;
                uploader.avatar = avatar || extractPornstarAvatarFromHtml(block, match[2]);
                return uploader;
            }
        }
    }

    const pornstarPatterns = [
        /<a[^>]*class="[^"]*n[^"]*"[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?([^<>]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*title="([^"]+)"/i
    ];

    for (const pattern of pornstarPatterns) {
        const match = searchHtml.match(pattern) || block.match(pattern);
        if (match && match[3]) {
            const name = match[3].replace(/<[^>]*>/g, '').trim();
            if (name && name.length > 0 && name.length < 100) {
                uploader.name = name;
                uploader.url = `spankbang://profile/pornstar:${match[2]}`;
                uploader.avatar = extractPornstarAvatarFromHtml(block, match[2]);
                return uploader;
            }
        }
    }

    const profilePatterns = [
        /<a[^>]*class="[^"]*n[^"]*"[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/profile\/([^"]+)"[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?([^<>]+)<\/a>/i,
        /<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/profile\/([^"]+)"[^>]*title="([^"]+)"/i
    ];

    for (const pattern of profilePatterns) {
        const match = searchHtml.match(pattern) || block.match(pattern);
        if (match && match[2]) {
            const name = match[2].replace(/<[^>]*>/g, '').trim();
            if (name && name.length > 0 && name.length < 100) {
                uploader.name = name;
                uploader.url = `spankbang://profile/${match[1]}`;
                uploader.avatar = extractAvatarFromHtml(block);
                return uploader;
            }
        }
    }

    const svgPattern = /<\/use><\/svg>\s*([^<]+)\s*<svg[^>]*class="[^"]*i_(?:svg|angle)/i;
    const svgMatch = block.match(svgPattern);
    if (svgMatch && svgMatch[1]) {
        const name = svgMatch[1].trim();
        if (name && name.length > 0 && name.length < 100) {
            const pornstarHrefMatch = block.match(/href="\/([a-z0-9]+)\/pornstar\/([^"]+)"/i);
            if (pornstarHrefMatch) {
                uploader.name = name;
                uploader.url = `spankbang://profile/pornstar:${pornstarHrefMatch[2]}`;
                return uploader;
            }
            const channelHrefMatch = block.match(/href="\/([a-z0-9]+)\/channel\/([^"]+)"/i);
            if (channelHrefMatch) {
                uploader.name = name;
                uploader.url = `spankbang://channel/${channelHrefMatch[1]}:${channelHrefMatch[2]}`;
                return uploader;
            }
        }
    }

    const userSpanMatch = block.match(/<span[^>]*class="[^"]*(?:user|uploader|author|name|n)[^"]*"[^>]*>([^<]+)<\/span>/i);
    if (userSpanMatch && userSpanMatch[1]) {
        const name = userSpanMatch[1].trim();
        if (name && name.length > 0 && name.length < 100) {
            uploader.name = name;
            
            const nearbyHrefPornstar = block.match(/href="\/([a-z0-9]+)\/pornstar\/([^"]+)"/i);
            if (nearbyHrefPornstar) {
                uploader.url = `spankbang://profile/pornstar:${nearbyHrefPornstar[2]}`;
                return uploader;
            }
            
            const nearbyHrefChannel = block.match(/href="\/([a-z0-9]+)\/channel\/([^"]+)"/i);
            if (nearbyHrefChannel) {
                uploader.url = `spankbang://channel/${nearbyHrefChannel[1]}:${nearbyHrefChannel[2]}`;
                return uploader;
            }
            
            const nearbyHrefProfile = block.match(/href="\/profile\/([^"]+)"/i);
            if (nearbyHrefProfile) {
                uploader.url = `spankbang://profile/${nearbyHrefProfile[1]}`;
                return uploader;
            }
        }
    }

    return uploader;
}

function extractFeaturedPornstars(html) {
    const pornstars = [];
    const seenSlugs = new Set();
    
    const pornstarPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*title="([^"]+)"/gi,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/gi
    ];
    
    for (const pattern of pornstarPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const shortId = match[1];
            const slug = match[2].replace(/\/$/, '');
            const name = (match[4] || match[3] || slug).replace(/<[^>]*>/g, '').trim();
            const avatar = match[3] && match[3].includes('pornstarimg') ? match[3] : "";
            
            if (!seenSlugs.has(slug) && name.length > 0 && name.length < 100) {
                seenSlugs.add(slug);
                pornstars.push({
                    shortId: shortId,
                    slug: slug,
                    name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
                    avatar: avatar,
                    url: `spankbang://profile/pornstar:${slug}`
                });
            }
        }
        if (pornstars.length > 0) break;
    }
    
    return pornstars;
}

function parseVideoPage(html, url) {
    const videoData = {
        id: extractVideoId(url),
        url: url,
        title: "Unknown Title",
        description: "",
        duration: 0,
        views: 0,
        uploadDate: 0,
        thumbnail: "",
        uploader: { name: "", url: "", avatar: "" },
        featuredPornstars: [],
        sources: {},
        rating: 0,
        relatedVideos: [],
        relatedPlaylists: []
    };

    const titleMatch = html.match(/<h1[^>]*title="([^"]+)"/);
    if (titleMatch) {
        videoData.title = cleanVideoTitle(titleMatch[1]);
    } else {
        const altTitleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (altTitleMatch) {
            videoData.title = cleanVideoTitle(altTitleMatch[1].replace(/ - SpankBang$/, '').trim());
        }
    }

    const descPatterns = [
        /<meta\s+name="description"\s+content="([^"]+)"/i,
        /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ];
    for (const pattern of descPatterns) {
        const descMatch = html.match(pattern);
        if (descMatch && descMatch[1]) {
            videoData.description = descMatch[1].replace(/<[^>]*>/g, '').trim();
            break;
        }
    }

    const durationMatch = html.match(/itemprop="duration"\s*content="PT(\d+)M(\d+)?S?"/);
    if (durationMatch) {
        videoData.duration = (parseInt(durationMatch[1]) || 0) * 60 + (parseInt(durationMatch[2]) || 0);
    }

    const viewsMatch = html.match(/"interactionCount"\s*:\s*"?(\d+)"?/);
    if (viewsMatch) {
        videoData.views = parseInt(viewsMatch[1]) || 0;
    }

    const uploadMatch = html.match(/itemprop="uploadDate"\s*content="([^"]+)"/);
    if (uploadMatch) {
        try {
            videoData.uploadDate = Math.floor(new Date(uploadMatch[1]).getTime() / 1000);
        } catch (e) {}
    }

    const thumbMatch = html.match(/itemprop="thumbnailUrl"\s*content="([^"]+)"/);
    if (thumbMatch) {
        videoData.thumbnail = thumbMatch[1];
    }

    const ratingMatch = html.match(/(\d+(?:\.\d+)?)\s*%\s*(?:rating|like)/i);
    if (ratingMatch) {
        videoData.rating = parseFloat(ratingMatch[1]) / 100;
    }

    videoData.uploader = extractUploaderFromVideoToolbar(html);
    
    videoData.featuredPornstars = extractFeaturedPornstars(html);

    const streamRegex = /stream_url_([0-9a-z]+p?)\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(html)) !== null) {
        let quality = streamMatch[1].toLowerCase();
        let streamUrl = streamMatch[2];
        if (streamUrl.includes('\\u002F')) {
            streamUrl = streamUrl.replace(/\\u002F/g, '/');
        }
        if (!quality.endsWith('p') && /^\d+$/.test(quality)) {
            quality = quality + 'p';
        }
        videoData.sources[quality] = streamUrl;
    }

    const m3u8Match = html.match(/['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/);
    if (m3u8Match) {
        videoData.sources['hls'] = m3u8Match[1];
    }

    if (Object.keys(videoData.sources).length === 0) {
        const streamKeyMatch = html.match(/data-streamkey\s*=\s*['"]([\w]+)['"]/);
        if (streamKeyMatch) {
            const streamKey = streamKeyMatch[1];
            try {
                const streamResponse = http.POST(
                    "https://spankbang.com/api/videos/stream",
                    "id=" + streamKey + "&data=0",
                    {
                        "User-Agent": API_HEADERS["User-Agent"],
                        "Accept": "application/json, text/plain, */*",
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Referer": url,
                        "X-Requested-With": "XMLHttpRequest",
                        "Origin": "https://spankbang.com"
                    },
                    false
                );

                if (streamResponse.isOk && streamResponse.body) {
                    const streamData = JSON.parse(streamResponse.body);
                    for (const [quality, streamUrl] of Object.entries(streamData)) {
                        if (streamUrl && typeof streamUrl === 'string' && streamUrl.startsWith('http')) {
                            let qualityKey = quality.toLowerCase();
                            if (!qualityKey.endsWith('p') && /^\d+$/.test(qualityKey)) {
                                qualityKey = qualityKey + 'p';
                            }
                            videoData.sources[qualityKey] = streamUrl;
                        } else if (Array.isArray(streamUrl) && streamUrl.length > 0 && streamUrl[0].startsWith('http')) {
                            let qualityKey = quality.toLowerCase();
                            if (!qualityKey.endsWith('p') && /^\d+$/.test(qualityKey)) {
                                qualityKey = qualityKey + 'p';
                            }
                            videoData.sources[qualityKey] = streamUrl[0];
                        }
                    }
                }
            } catch (e) {
                log("Stream API request failed: " + e.message);
            }
        }
    }

    videoData.relatedVideos = parseRelatedVideos(html);
    videoData.relatedPlaylists = parseRelatedPlaylists(html);

    return videoData;
}

function parseRelatedPlaylists(html) {
    const playlists = [];
    const seenIds = new Set();
    
    const playlistPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?\"[^>]*(?:title="([^"]+)")?/gi,
        /<a[^>]*href="\/playlist\/([^"\/]+)\/?\"[^>]*(?:title="([^"]+)")?/gi
    ];
    
    for (const pattern of playlistPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && playlists.length < 10) {
            let shortId, slug, titleFromMatch;
            
            if (match[0].includes('/playlist/') && !match[0].match(/\/[a-z0-9]+\/playlist\//)) {
                shortId = "";
                slug = match[1].replace(/\/$/, '');
                titleFromMatch = match[2];
            } else {
                shortId = match[1];
                slug = match[2].replace(/\/$/, '');
                titleFromMatch = match[3];
            }
            
            const playlistId = shortId ? `${shortId}:${slug}` : slug;
            
            if (seenIds.has(playlistId)) continue;
            seenIds.add(playlistId);
            
            const name = titleFromMatch ? titleFromMatch.trim() : slug.replace(/[_+-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            
            const thumbPattern = new RegExp(`href="[^"]*playlist/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[\\s\\S]{0,300}(?:data-src|src)="([^"]+)"`, 'i');
            const thumbMatch = html.match(thumbPattern);
            let thumbnail = thumbMatch ? thumbMatch[1] : "";
            if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
            else if (thumbnail && !thumbnail.startsWith('http')) thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
            
            playlists.push({
                id: playlistId,
                name: name,
                thumbnail: thumbnail,
                url: `spankbang://playlist/${playlistId}`,
                videoCount: 0
            });
        }
    }
    
    log("parseRelatedPlaylists found " + playlists.length + " playlists");
    return playlists;
}

function parseRelatedVideos(html) {
    const relatedVideos = [];
    const seenIds = new Set();

    const relatedSectionPatterns = [
        /<section[^>]*id="[^"]*(?:related|similar|recommended|more)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
        /<div[^>]*class="[^"]*(?:related|similar|recommended|more_videos|suggestions)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*)*<(?:section|footer|script)/i,
        /<div[^>]*id="[^"]*(?:related|similar|recommended|more)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*)*<(?:section|footer|script)/i,
        /<ul[^>]*class="[^"]*(?:video-list|videos|thumbs)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi
    ];

    let relatedHtml = html;
    for (const pattern of relatedSectionPatterns) {
        const sectionMatch = html.match(pattern);
        if (sectionMatch && sectionMatch[1]) {
            relatedHtml = sectionMatch[1];
            break;
        }
    }

    const videoItemPatterns = [
        /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi,
        /<li[^>]*class="[^"]*video[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
        /<a[^>]*href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    ];

    for (const videoItemRegex of videoItemPatterns) {
        let match;
        while ((match = videoItemRegex.exec(relatedHtml)) !== null && relatedVideos.length < 30) {
            const block = match[0];

            const linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/);
            if (!linkMatch) continue;

            const videoId = linkMatch[1];
            const videoSlug = linkMatch[2];

            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);

            const thumbPatterns = [
                /(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/,
                /style="[^"]*background[^"]*url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/
            ];

            let thumbnail = `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`;
            for (const thumbPattern of thumbPatterns) {
                const thumbMatch = block.match(thumbPattern);
                if (thumbMatch && thumbMatch[1]) {
                    thumbnail = thumbMatch[1];
                    break;
                }
            }

            const titlePatterns = [
                /title="([^"]+)"/,
                /alt="([^"]+)"/,
                /<span[^>]*class="[^"]*(?:name|title)[^"]*"[^>]*>([^<]+)<\/span>/i
            ];

            let title = "Unknown";
            for (const titlePattern of titlePatterns) {
                const titleMatch = block.match(titlePattern);
                if (titleMatch && titleMatch[1]) {
                    title = cleanVideoTitle(titleMatch[1]);
                    break;
                }
            }

            const durationPatterns = [
                /<span[^>]*class="[^"]*(?:l|length|duration|time)[^"]*"[^>]*>([^<]+)<\/span>/i,
                />(\d+:\d+(?::\d+)?)</
            ];

            let duration = 0;
            for (const durPattern of durationPatterns) {
                const durationMatch = block.match(durPattern);
                if (durationMatch && durationMatch[1]) {
                    duration = parseDuration(durationMatch[1].trim());
                    break;
                }
            }

            const viewsMatch = block.match(/([0-9,.]+[KMB]?)\s*(?:views?|plays?)/i);
            const views = viewsMatch ? parseViewCount(viewsMatch[1]) : 0;

            const uploader = extractUploaderFromSearchResult(block);

            relatedVideos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail,
                duration: duration,
                views: views,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: uploader
            });
        }

        if (relatedVideos.length > 0) break;
    }

    if (relatedVideos.length === 0) {
        const altPattern = /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*title="([^"]+)"/gi;
        let match;
        while ((match = altPattern.exec(html)) !== null && relatedVideos.length < 30) {
            const videoId = match[1];
            const videoSlug = match[2];

            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);

            relatedVideos.push({
                id: videoId,
                title: cleanVideoTitle(match[3]),
                thumbnail: `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`,
                duration: 0,
                views: 0,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: { name: "", url: "", avatar: "" }
            });
        }
    }

    log("parseRelatedVideos found " + relatedVideos.length + " videos");
    return relatedVideos;
}

function createVideoSources(videoData) {
    const videoSources = [];

    const qualityOrder = ['4k', '2160p', '1080p', '720p', '480p', '360p', '320p', '240p'];

    for (const quality of qualityOrder) {
        if (videoData.sources[quality]) {
            const qualityKey = quality.replace('p', '');
            const config = CONFIG.VIDEO_QUALITIES[qualityKey] || CONFIG.VIDEO_QUALITIES[quality] || { width: 854, height: 480 };
            videoSources.push(new VideoUrlSource({
                url: videoData.sources[quality],
                name: quality.toUpperCase(),
                container: "video/mp4",
                width: config.width,
                height: config.height
            }));
        }
    }

    for (const [quality, url] of Object.entries(videoData.sources)) {
        if (quality === 'hls' || quality === 'm3u8') continue;
        const alreadyAdded = qualityOrder.includes(quality);
        if (!alreadyAdded && url && url.startsWith('http')) {
            const qualityKey = quality.replace('p', '');
            const config = CONFIG.VIDEO_QUALITIES[qualityKey] || CONFIG.VIDEO_QUALITIES[quality] || { width: 854, height: 480 };
            videoSources.push(new VideoUrlSource({
                url: url,
                name: quality.toUpperCase(),
                container: "video/mp4",
                width: config.width,
                height: config.height
            }));
        }
    }

    if (videoData.sources.hls || videoData.sources.m3u8) {
        const hlsUrl = videoData.sources.hls || videoData.sources.m3u8;
        videoSources.push(new HLSSource({
            url: hlsUrl,
            name: "HLS (Adaptive)",
            priority: true
        }));
    }

    if (videoSources.length === 0) {
        throw new ScriptException("No video sources available for this video");
    }

    return videoSources;
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
        url: videoData.url || `${CONFIG.EXTERNAL_URL_BASE}/${videoData.id}/video/`,
        isLive: false
    });
}

function createVideoDetails(videoData, url) {
    const videoSources = createVideoSources(videoData);

    let description = videoData.description || videoData.title || "";
    
    if (videoData.featuredPornstars && videoData.featuredPornstars.length > 0) {
        const pornstarLinks = videoData.featuredPornstars.map(p => {
            return `[${p.name}](${p.url})`;
        }).join(', ');
        
        if (description.length > 0) {
            description += "\n\n";
        }
        description += "Featuring: " + pornstarLinks;
    }
    
    if (videoData.relatedPlaylists && videoData.relatedPlaylists.length > 0) {
        const playlistLinks = videoData.relatedPlaylists.map(p => {
            return `[${p.name}](${p.url})`;
        }).join(', ');
        
        if (description.length > 0) {
            description += "\n\n";
        }
        description += "Related Playlists: " + playlistLinks;
    }

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

function cleanVideoTitle(title) {
    if (!title) return "Unknown";
    return title
        .replace(/:\s*Porn\s*$/i, '')
        .replace(/\s*-\s*SpankBang\s*$/i, '')
        .replace(/\s*\|\s*SpankBang\s*$/i, '')
        .trim();
}

function parseSearchResults(html) {
    const videos = [];

    const videoItemRegex = /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;

    let itemMatch;
    while ((itemMatch = videoItemRegex.exec(html)) !== null) {
        const block = itemMatch[0];

        const linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/);
        if (!linkMatch) continue;

        const videoId = linkMatch[1];
        const videoSlug = linkMatch[2];

        const thumbMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/);
        const thumbnail = thumbMatch ? thumbMatch[1] : `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`;

        const titleMatch = block.match(/title="([^"]+)"/);
        let title = titleMatch ? titleMatch[1] : "Unknown";
        title = cleanVideoTitle(title);

        const durationMatch = block.match(/<span[^>]*class="[^"]*(?:l|length|duration)[^"]*"[^>]*>([^<]+)<\/span>/i);
        const durationAltMatch = block.match(/>(\d+:\d+(?::\d+)?)</);
        const finalDuration = durationMatch ? durationMatch[1].trim() : (durationAltMatch ? durationAltMatch[1] : "0:00");

        const viewsMatch = block.match(/<span[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/span>/i);
        const viewsAltMatch = block.match(/>([0-9,.]+[KMB]?)\s*<\/span>/i);
        const viewsStr = viewsMatch ? viewsMatch[1].trim() : (viewsAltMatch ? viewsAltMatch[1] : "0");

        let uploadDate = 0;
        const datePatterns = [
            /<span[^>]*class="[^"]*(?:age|time|date|when|ago)[^"]*"[^>]*>([^<]+)<\/span>/i,
            /<time[^>]*>([^<]+)<\/time>/i,
            /<span[^>]*class="[^"]*t[^"]*"[^>]*>([^<]+)<\/span>/i,
            /(\d+\s*(?:second|minute|hour|day|week|month|year)s?\s*ago)/i,
            /(yesterday|today|just now)/i
        ];
        
        for (const datePattern of datePatterns) {
            const dateMatch = block.match(datePattern);
            if (dateMatch && dateMatch[1]) {
                uploadDate = parseRelativeDate(dateMatch[1].trim());
                if (uploadDate > 0) break;
            }
        }

        const uploader = extractUploaderFromSearchResult(block);

        videos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            duration: parseDuration(finalDuration),
            views: parseViewCount(viewsStr),
            uploadDate: uploadDate,
            url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
            uploader: uploader
        });
    }

    if (videos.length === 0) {
        const altVideoRegex = /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*title="([^"]+)"/gi;
        let altMatch;
        while ((altMatch = altVideoRegex.exec(html)) !== null) {
            const videoId = altMatch[1];
            const videoSlug = altMatch[2];
            let title = cleanVideoTitle(altMatch[3]);

            videos.push({
                id: videoId,
                title: title,
                thumbnail: `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`,
                duration: 0,
                views: 0,
                uploadDate: 0,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: { name: "", url: "", avatar: "" }
            });
        }
    }

    return videos;
}

function parsePornstarsPage(html) {
    const pornstars = [];

    const pornstarPattern = /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<\/a>/gi;
    let match;

    while ((match = pornstarPattern.exec(html)) !== null) {
        const shortId = match[1];
        const pornstarSlug = match[2].replace(/\/$/, '');
        let avatar = match[3];

        if (avatar.startsWith('//')) {
            avatar = `https:${avatar}`;
        } else if (!avatar.startsWith('http')) {
            avatar = `https://spankbang.com${avatar}`;
        }

        let name = pornstarSlug.replace(/\+/g, ' ').replace(/-/g, ' ');
        name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const existingIndex = pornstars.findIndex(p => p.id === `pornstar:${pornstarSlug}`);
        if (existingIndex === -1) {
            let subscribersStr = "";
            let videoCountStr = "";

            const statsPattern = new RegExp(`href="/${shortId}/pornstar/${pornstarSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>[\\s\\S]*?(\\d[\\d,.]*)\\s*[\\s\\S]*?(\\d+)`, 'i');
            const statsMatch = html.match(statsPattern);

            if (statsMatch) {
                subscribersStr = statsMatch[1] || "0";
                videoCountStr = statsMatch[2] || "0";
            }

            pornstars.push({
                id: `pornstar:${pornstarSlug}`,
                shortId: shortId,
                name: name,
                avatar: avatar,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/pornstar/${pornstarSlug}`,
                subscribers: parseViewCount(subscribersStr),
                videoCount: parseInt(videoCountStr) || 0
            });
        }
    }

    if (pornstars.length === 0) {
        const simplePattern = /<a[^>]*href="\/pornstar\/([^"]+)"[^>]*title="([^"]+)"[^>]*>/gi;
        while ((match = simplePattern.exec(html)) !== null) {
            const pornstarSlug = match[1].replace(/\/$/, '');
            const name = match[2].trim();

            const existingIndex = pornstars.findIndex(p => p.id === `pornstar:${pornstarSlug}`);
            if (existingIndex === -1) {
                pornstars.push({
                    id: `pornstar:${pornstarSlug}`,
                    shortId: "",
                    name: name,
                    avatar: "",
                    url: `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${pornstarSlug}`,
                    subscribers: 0,
                    videoCount: 0
                });
            }
        }
    }

    return pornstars;
}

function parsePlaylistsPage(html) {
    const playlists = [];
    
    const playlistBlockPattern = /<div[^>]*class="[^"]*(?:playlist-item|playlist|video-item)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|\s*<div)/gi;
    let blockMatch;
    while ((blockMatch = playlistBlockPattern.exec(html)) !== null) {
        const block = blockMatch[1];
        
        const hrefMatch = block.match(/href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?"/i);
        if (hrefMatch) {
            const shortId = hrefMatch[1];
            const playlistId = `${shortId}:${hrefMatch[2]}`;
            
            const nameMatch = block.match(/title="([^"]+)"/i) || block.match(/<span[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)<\/span>/i);
            const name = nameMatch ? (nameMatch[1] || nameMatch[2]).trim() : hrefMatch[2].replace(/[_-]/g, ' ');
            
            const thumbMatch = block.match(/(?:data-src|src)="([^"]+)"/i);
            let thumbnail = thumbMatch ? thumbMatch[1] : "";
            if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
            else if (thumbnail && !thumbnail.startsWith('http')) thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
            
            const countMatch = block.match(/(\d+)\s*videos?/i);
            const videoCount = countMatch ? parseInt(countMatch[1]) : 0;
            
            if (!playlists.find(p => p.id === playlistId)) {
                playlists.push({
                    id: playlistId,
                    name: name,
                    thumbnail: thumbnail,
                    author: "",
                    videoCount: videoCount,
                    url: `spankbang://playlist/${playlistId}`
                });
            }
        }
    }
    
    const linkPattern = /<a[^>]*href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?\"[^>]*(?:title="([^"]+)")?/gi;
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
        const shortId = match[1];
        const slug = match[2];
        const playlistId = `${shortId}:${slug}`;
        const name = match[3] ? match[3].trim() : slug.replace(/[_-]/g, ' ');
        
        if (!playlists.find(p => p.id === playlistId)) {
            let thumbnail = "";
            const thumbPattern = new RegExp(`href="/${shortId}/playlist/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[\\s\\S]*?(?:data-src|src)="([^"]+)"`, 'i');
            const thumbMatch = html.match(thumbPattern);
            if (thumbMatch && thumbMatch[1]) {
                thumbnail = thumbMatch[1];
                if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
            }
            
            const countPattern = new RegExp(`href="/${shortId}/playlist/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[\\s\\S]*?(\\d+)\\s*videos?`, 'i');
            const countMatch = html.match(countPattern);
            const videoCount = countMatch ? parseInt(countMatch[1]) : 0;
            
            playlists.push({
                id: playlistId,
                name: name,
                thumbnail: thumbnail,
                author: "",
                videoCount: videoCount,
                url: `spankbang://playlist/${playlistId}`
            });
        }
    }
    
    if (playlists.length === 0) {
        const simplePattern = /<a[^>]*href="\/playlist\/([^"]+)"[^>]*>[\s\S]*?(?:<img[^>]*(?:data-src|src)="([^"]+)")?[\s\S]*?([^<>]{3,50})<\/a>/gi;
        while ((match = simplePattern.exec(html)) !== null) {
            const playlistId = match[1].replace(/\/$/, '');
            const thumbnail = match[2] || "";
            const name = match[3] ? match[3].replace(/<[^>]*>/g, '').trim() : playlistId;
            
            if (name.length > 2 && name.length < 100) {
                if (!playlists.find(p => p.id === playlistId)) {
                    playlists.push({
                        id: playlistId,
                        name: name,
                        thumbnail: thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail,
                        author: "",
                        videoCount: 0,
                        url: `spankbang://playlist/${playlistId}`
                    });
                }
            }
        }
    }
    
    return playlists;
}

function parseComments(html, videoId) {
    const comments = [];

    const commentPatterns = [
        /<div[^>]*class="[^"]*comment\s[^"]*"[^>]*data-id="(\d+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
        /<div[^>]*class="[^"]*comment[^"]*"[^>]*(?:data-id="(\d+)")?[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>)?\s*(?:<\/div>)?/gi,
        /<li[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
        /<div[^>]*class="[^"]*cmnt[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    for (const pattern of commentPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const commentId = match[1] || `comment_${comments.length}`;
            const block = match[2] || match[1] || match[0];

            const userPatterns = [
                /<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/,
                /<a[^>]*class="[^"]*(?:username|author|user|name|n)[^"]*"[^>]*>([^<]+)<\/a>/,
                /<span[^>]*class="[^"]*(?:username|author|user|name|n)[^"]*"[^>]*>([^<]+)<\/span>/,
                /<strong[^>]*class="[^"]*(?:name|user)[^"]*"[^>]*>([^<]+)<\/strong>/,
                /<strong[^>]*>([^<]+)<\/strong>/,
                /<b[^>]*>([^<]+)<\/b>/
            ];

            let username = "Anonymous";
            let userProfile = "";
            for (const userPattern of userPatterns) {
                const userMatch = block.match(userPattern);
                if (userMatch) {
                    if (userMatch[2]) {
                        userProfile = `/profile/${userMatch[1]}`;
                        username = userMatch[2].trim();
                    } else if (userMatch[1]) {
                        username = userMatch[1].trim();
                    }
                    if (username && username !== "Anonymous") break;
                }
            }

            const avatarPatterns = [
                /(?:data-src|src)="(https?:\/\/[^"]*avatar[^"]*(?:\.jpg|\.jpeg|\.png|\.gif|\.webp)[^"]*)"/i,
                /(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp)[^"]*)"/,
                /(?:data-src|src)="(\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp)[^"]*)"/
            ];
            
            let avatar = "";
            for (const avatarPattern of avatarPatterns) {
                const avatarMatch = block.match(avatarPattern);
                if (avatarMatch && avatarMatch[1]) {
                    avatar = avatarMatch[1];
                    if (avatar.startsWith('//')) {
                        avatar = 'https:' + avatar;
                    }
                    break;
                }
            }

            const textPatterns = [
                /<div[^>]*class="[^"]*(?:comment-text|text|body|message|cnt|content)[^"]*"[^>]*>([\s\S]*?)<\/div>/,
                /<p[^>]*class="[^"]*(?:comment-text|text|cnt)[^"]*"[^>]*>([\s\S]*?)<\/p>/,
                /<span[^>]*class="[^"]*(?:text|cnt|msg)[^"]*"[^>]*>([\s\S]*?)<\/span>/,
                /<p[^>]*>([\s\S]*?)<\/p>/
            ];

            let text = "";
            for (const textPattern of textPatterns) {
                const textMatch = block.match(textPattern);
                if (textMatch && textMatch[1]) {
                    text = textMatch[1].replace(/<[^>]*>/g, '').trim();
                    if (text.length > 0) break;
                }
            }

            if (!text) {
                const plainTextMatch = block.match(/>([^<]{10,500})</);
                if (plainTextMatch && plainTextMatch[1]) {
                    const candidate = plainTextMatch[1].trim();
                    if (candidate.length > 10 && !candidate.includes('ago') && !candidate.match(/^\d+$/)) {
                        text = candidate;
                    }
                }
            }

            if (!text || text.length < 2) continue;

            const likesPatterns = [
                /(\d+)\s*(?:likes?|thumbs?\s*up|up)/i,
                /class="[^"]*(?:likes?|up)[^"]*"[^>]*>(\d+)/i,
                /data-likes="(\d+)"/i
            ];
            
            let likes = 0;
            for (const likesPattern of likesPatterns) {
                const likesMatch = block.match(likesPattern);
                if (likesMatch && likesMatch[1]) {
                    likes = parseInt(likesMatch[1]) || 0;
                    break;
                }
            }

            const datePatterns = [
                /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i,
                /class="[^"]*(?:time|date|ago)[^"]*"[^>]*>([^<]+)</i
            ];
            
            let timestamp = Math.floor(Date.now() / 1000);
            for (const datePattern of datePatterns) {
                const dateMatch = block.match(datePattern);
                if (dateMatch) {
                    if (dateMatch[2]) {
                        const num = parseInt(dateMatch[1]);
                        const unit = dateMatch[2].toLowerCase();
                        const multipliers = {
                            'second': 1,
                            'minute': 60,
                            'hour': 3600,
                            'day': 86400,
                            'week': 604800,
                            'month': 2592000,
                            'year': 31536000
                        };
                        timestamp -= num * (multipliers[unit] || 0);
                    }
                    break;
                }
            }

            comments.push({
                contextUrl: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/`,
                author: new PlatformAuthorLink(
                    new PlatformID(PLATFORM, username, plugin.config.id),
                    username,
                    userProfile ? `${CONFIG.EXTERNAL_URL_BASE}${userProfile}` : "",
                    avatar
                ),
                message: text,
                rating: new RatingLikes(likes),
                date: timestamp,
                replyCount: 0,
                context: { id: commentId }
            });
        }

        if (comments.length > 0) break;
    }

    return comments;
}

function fetchCommentsFromApi(videoId) {
    const comments = [];
    
    try {
        const commentsApiUrl = `${BASE_URL}/api/video/comments`;
        const response = http.POST(
            commentsApiUrl,
            `id=${videoId}&page=1`,
            {
                "User-Agent": API_HEADERS["User-Agent"],
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": `${BASE_URL}/${videoId}/video/`,
                "X-Requested-With": "XMLHttpRequest",
                "Origin": BASE_URL
            },
            false
        );
        
        if (response.isOk && response.body) {
            try {
                const data = JSON.parse(response.body);
                if (data.html) {
                    return parseComments(data.html, videoId);
                }
                if (Array.isArray(data.comments)) {
                    for (const c of data.comments) {
                        comments.push({
                            contextUrl: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/`,
                            author: new PlatformAuthorLink(
                                new PlatformID(PLATFORM, c.username || c.user || "Anonymous", plugin.config.id),
                                c.username || c.user || "Anonymous",
                                c.profile_url || "",
                                c.avatar || c.thumb || ""
                            ),
                            message: c.text || c.message || c.comment || "",
                            rating: new RatingLikes(parseInt(c.likes) || 0),
                            date: c.timestamp || Math.floor(Date.now() / 1000),
                            replyCount: 0,
                            context: { id: c.id || `comment_${comments.length}` }
                        });
                    }
                }
            } catch (e) {
                log("Failed to parse comments API response: " + e.message);
            }
        }
    } catch (e) {
        log("Comments API request failed: " + e.message);
    }
    
    return comments;
}

function hasValidAuthCookie(cookies) {
    if (!cookies) return false;
    
    if (typeof cookies === 'string') {
        if (cookies.length === 0) return false;
        return cookies.includes('sb_session=');
    }
    
    if (Array.isArray(cookies)) {
        for (const cookie of cookies) {
            if (cookie && typeof cookie === 'object') {
                if (cookie.name === 'sb_session') {
                    if (cookie.value && cookie.value.length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    if (typeof cookies === 'object' && cookies !== null) {
        return cookies.sb_session || cookies['sb_session'];
    }
    
    return false;
}

function cookiesToString(cookies) {
    if (!cookies) return "";
    
    if (typeof cookies === 'string') {
        return cookies;
    }
    
    if (Array.isArray(cookies)) {
        return cookies
            .filter(c => c && c.name && c.value)
            .map(c => `${c.name}=${c.value}`)
            .join('; ');
    }
    
    if (typeof cookies === 'object') {
        return Object.entries(cookies)
            .filter(([k, v]) => v)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
    }
    
    return "";
}

function loadAuthCookies() {
    try {
        if (typeof http.getCookies === 'function') {
            const cookies = http.getCookies(BASE_URL);
            if (hasValidAuthCookie(cookies)) {
                state.authCookies = cookiesToString(cookies);
                log("Loaded auth cookies from http.getCookies");
                return true;
            }
        }
        
        if (typeof bridge !== 'undefined') {
            if (typeof bridge.getCookieString === 'function') {
                const cookieStr = bridge.getCookieString(BASE_URL);
                if (hasValidAuthCookie(cookieStr)) {
                    state.authCookies = cookieStr;
                    log("Loaded auth cookies from bridge.getCookieString");
                    return true;
                }
            }
            
            if (typeof bridge.getAuthCookies === 'function') {
                const authCookies = bridge.getAuthCookies();
                if (hasValidAuthCookie(authCookies)) {
                    state.authCookies = cookiesToString(authCookies);
                    log("Loaded auth cookies from bridge.getAuthCookies");
                    return true;
                }
            }
            
            if (typeof bridge.getCookies === 'function') {
                try {
                    const cookies = bridge.getCookies("spankbang.com");
                    if (hasValidAuthCookie(cookies)) {
                        state.authCookies = cookiesToString(cookies);
                        log("Loaded auth cookies from bridge.getCookies");
                        return true;
                    }
                } catch (e) {
                    log("bridge.getCookies failed: " + e);
                }
            }
        }
        
        log("No valid auth cookies found (looking for 'sb_session')");
    } catch (e) {
        log("Failed to load auth cookies: " + e);
    }
    return false;
}

function validateSession() {
    try {
        const headers = getAuthHeaders();
        const response = http.GET(`${BASE_URL}/users/profile`, headers, false);
        
        if (response.code === 200 && response.body) {
            const isValid = response.body.includes('/users/logout') || 
                           response.body.includes('class="logout"') ||
                           response.body.includes('Edit Account') ||
                           response.body.includes('data-user-id') ||
                           response.body.includes('users/account') ||
                           response.body.includes('logged_in = 1') ||
                           response.body.includes('"isLoggedIn": true') ||
                           response.body.includes('site_user_id') ||
                           response.body.includes('var logged_in = 1');
            
            if (isValid) {
                const usernamePatterns = [
                    /<input[^>]*name="username"[^>]*value="([^"]+)"/i,
                    /class="[^"]*username[^"]*"[^>]*>([^<]+)</i,
                    /data-username="([^"]+)"/i,
                    /<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)</i,
                    /Welcome[,\s]+([^<\n]+)/i
                ];
                
                for (const pattern of usernamePatterns) {
                    const match = response.body.match(pattern);
                    if (match && match[1] && match[1].trim().length > 0) {
                        state.username = match[1].trim();
                        log("Found username: " + state.username);
                        break;
                    }
                }
                
                const userIdMatch = response.body.match(/data-user-id="(\d+)"/i) ||
                                   response.body.match(/user_id['":\s]+(\d+)/i);
                if (userIdMatch && userIdMatch[1]) {
                    state.userId = userIdMatch[1];
                    log("Found userId: " + state.userId);
                }
            }
            
            return isValid;
        }
        
        return response.code !== 302 && response.code !== 301;
    } catch (e) {
        log("Session validation failed: " + e);
        return false;
    }
}

function fetchUserInfo() {
    try {
        const headers = getAuthHeaders();
        const response = http.GET(`${BASE_URL}/users/account`, headers, false);
        
        if (response.code === 200 && response.body) {
            const emailMatch = response.body.match(/<input[^>]*name="email"[^>]*value="([^"]+)"/i) ||
                              response.body.match(/Email address[\s\S]*?<[^>]*>([^<]+@[^<]+)</i);
            if (emailMatch && emailMatch[1]) {
                const email = emailMatch[1].trim();
                if (!state.username || state.username.length === 0) {
                    state.username = email.split('@')[0];
                }
                log("Found email/username: " + email);
            }
            
            const usernameMatch = response.body.match(/<input[^>]*name="username"[^>]*value="([^"]+)"/i);
            if (usernameMatch && usernameMatch[1]) {
                state.username = usernameMatch[1].trim();
                log("Found username from account page: " + state.username);
            }
            
            return true;
        }
    } catch (e) {
        log("Failed to fetch user info: " + e);
    }
    return false;
}

source.enable = function(conf, settings, savedStateStr) {
    config = conf ?? {};
    
    if (!localConfig.pornstarShortIds) {
        localConfig.pornstarShortIds = {};
    }

    if (savedStateStr) {
        try {
            const savedState = JSON.parse(savedStateStr);
            state.sessionCookie = savedState.sessionCookie || "";
            state.isAuthenticated = savedState.isAuthenticated || false;
            state.authCookies = savedState.authCookies || "";
            state.username = savedState.username || "";
            state.userId = savedState.userId || "";
            
            if (savedState.pornstarShortIds) {
                localConfig.pornstarShortIds = savedState.pornstarShortIds;
            }
            
            log("State loaded: authenticated=" + state.isAuthenticated + ", username=" + state.username);
        } catch (e) {
            log("Failed to parse saved state: " + e);
        }
    }
    
    if (typeof bridge !== 'undefined' && bridge.isLoggedIn && bridge.isLoggedIn()) {
        loadAuthCookies();
        state.isAuthenticated = true;
        
        if (!state.username || state.username.length === 0) {
            try {
                fetchUserInfo();
            } catch (e) {
                log("Could not fetch user info on enable: " + e);
            }
        }
    }
};

source.disable = function() {
    state.sessionCookie = "";
    state.isAuthenticated = false;
    state.authCookies = "";
};

source.saveState = function() {
    return JSON.stringify({
        sessionCookie: state.sessionCookie,
        isAuthenticated: state.isAuthenticated,
        authCookies: state.authCookies,
        username: state.username,
        userId: state.userId,
        pornstarShortIds: localConfig.pornstarShortIds
    });
};

source.getLoggedInUser = function() {
    try {
        if (!source.isLoggedIn()) {
            return null;
        }
        
        if (!state.username || state.username.length === 0) {
            fetchUserInfo();
        }
        
        if (state.username && state.username.length > 0) {
            return state.username;
        }
        
        return "Logged In";
    } catch (e) {
        log("getLoggedInUser error: " + e);
        return null;
    }
};

source.isLoggedIn = function() {
    try {
        if (typeof bridge !== 'undefined' && bridge.isLoggedIn && bridge.isLoggedIn()) {
            log("bridge.isLoggedIn() returned true");
            if (!state.authCookies || state.authCookies.length === 0 || !hasValidAuthCookie(state.authCookies)) {
                loadAuthCookies();
            }
            
            if (hasValidAuthCookie(state.authCookies)) {
                if (validateSession()) {
                    state.isAuthenticated = true;
                    log("isLoggedIn: Session validated successfully");
                    return true;
                }
            }
        }
        
        if (!state.authCookies || !hasValidAuthCookie(state.authCookies)) {
            loadAuthCookies();
        }
        
        if (!state.authCookies || !hasValidAuthCookie(state.authCookies)) {
            log("isLoggedIn: No valid auth cookies found");
            return false;
        }
        
        const isValid = validateSession();
        state.isAuthenticated = isValid;
        log("isLoggedIn: Session validation result = " + isValid);
        return isValid;
    } catch (e) {
        log("isLoggedIn check failed: " + e);
        return false;
    }
};

source.login = function(code) {
    try {
        loadAuthCookies();
        state.isAuthenticated = true;
        log("Login triggered - authentication cookies captured");
        
        if (validateSession()) {
            log("Login successful - session validated");
            return true;
        } else {
            log("Login may have issues - session validation uncertain");
            return true;
        }
    } catch (e) {
        log("Login failed: " + e);
        return false;
    }
};

function clearSpankBangCookies() {
    try {
        if (typeof bridge !== 'undefined' && bridge.clearCookies) {
            bridge.clearCookies("spankbang.com");
            bridge.clearCookies("www.spankbang.com");
            log("Cleared cookies via bridge");
            return true;
        }
        if (typeof http !== 'undefined' && http.clearCookies) {
            http.clearCookies("spankbang.com");
            http.clearCookies("www.spankbang.com");
            log("Cleared cookies via http");
            return true;
        }
        log("No cookie clearing API available");
        return false;
    } catch (e) {
        log("clearSpankBangCookies error: " + e);
        return false;
    }
}

source.logout = function() {
    try {
        state.sessionCookie = "";
        state.isAuthenticated = false;
        state.authCookies = "";
        clearSpankBangCookies();
        log("Logged out - cleared all auth state and cookies");
    } catch (e) {
        log("Logout error: " + e);
    }
};

source.prepareLogin = function() {
    try {
        log("prepareLogin called - clearing stale cookies before login");
        state.sessionCookie = "";
        state.isAuthenticated = false;
        state.authCookies = "";
        clearSpankBangCookies();
        return true;
    } catch (e) {
        log("prepareLogin error: " + e);
        return false;
    }
};

source.getUserSubscriptions = function() {
    try {
        if (!source.isLoggedIn()) {
            log("getUserSubscriptions: Not logged in");
            return [];
        }

        const subscriptionsUrl = `${BASE_URL}/users/subscriptions`;
        log("Fetching subscriptions from: " + subscriptionsUrl);
        const html = makeRequest(subscriptionsUrl, null, 'user subscriptions');
        
        const subscriptions = [];
        const seenUrls = new Set();
        
        const channelBlockPattern = /<div[^>]*class="[^"]*(?:channel-item|subscription-item|user-item|item)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|\s*<div)/gi;
        let blockMatch;
        while ((blockMatch = channelBlockPattern.exec(html)) !== null) {
            const block = blockMatch[0];
            
            let channelUrl = null;
            let avatar = null;
            let name = null;
            
            const channelMatch = block.match(/href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?"/i);
            const pornstarMatch = block.match(/href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?"/i);
            const profileMatch = block.match(/href="\/profile\/([^"\/]+)\/?"/i);
            
            if (channelMatch) {
                channelUrl = `spankbang://channel/${channelMatch[1]}:${channelMatch[2]}`;
            } else if (pornstarMatch) {
                channelUrl = `spankbang://profile/pornstar:${pornstarMatch[2]}`;
            } else if (profileMatch) {
                channelUrl = `spankbang://profile/${profileMatch[1]}`;
            }
            
            if (channelUrl && !seenUrls.has(channelUrl)) {
                seenUrls.add(channelUrl);
                subscriptions.push(channelUrl);
            }
        }
        
        if (subscriptions.length === 0) {
            const channelPatterns = [
                /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>/gi,
                /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>/gi,
                /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>/gi
            ];

            for (const pattern of channelPatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    let channelUrl;
                    
                    if (pattern.source.includes('channel')) {
                        channelUrl = `spankbang://channel/${match[1]}:${match[2]}`;
                    } else if (pattern.source.includes('pornstar')) {
                        channelUrl = `spankbang://profile/pornstar:${match[2]}`;
                    } else {
                        channelUrl = `spankbang://profile/${match[1]}`;
                    }

                    if (channelUrl && !seenUrls.has(channelUrl)) {
                        seenUrls.add(channelUrl);
                        subscriptions.push(channelUrl);
                    }
                }
            }
        }

        log("getUserSubscriptions found " + subscriptions.length + " subscriptions from /users/subscriptions");
        return subscriptions;

    } catch (error) {
        log("getUserSubscriptions error: " + error.message);
        return [];
    }
};

source.getSubscriptions = function() {
    return source.getUserSubscriptions();
};

source.getWatchHistory = function() {
    try {
        if (!source.isLoggedIn()) {
            log("getWatchHistory: Not logged in");
            return [];
        }

        const historyUrl = `${BASE_URL}/users/history`;
        log("Fetching watch history from: " + historyUrl);
        const html = makeRequest(historyUrl, null, 'watch history');
        
        let videos = parseSearchResults(html);
        
        if (videos.length === 0) {
            videos = parseHistoryPage(html);
        }
        
        log("getWatchHistory found " + videos.length + " videos");
        return videos.map(v => v.url);

    } catch (error) {
        log("getWatchHistory error: " + error.message);
        return [];
    }
};

function parseHistoryPage(html) {
    const videos = [];
    const seenIds = new Set();
    
    const videoBlockPattern = /<div[^>]*class="[^"]*(?:video-item|history-item|watched-item)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|\s*<div)/gi;
    let blockMatch;
    while ((blockMatch = videoBlockPattern.exec(html)) !== null && videos.length < 200) {
        const block = blockMatch[0];
        
        const linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/);
        if (!linkMatch) continue;

        const videoId = linkMatch[1];
        const videoSlug = linkMatch[2];

        if (seenIds.has(videoId)) continue;
        seenIds.add(videoId);

        const thumbMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/);
        const thumbnail = thumbMatch ? thumbMatch[1] : `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`;

        const titleMatch = block.match(/title="([^"]+)"/);
        let title = titleMatch ? cleanVideoTitle(titleMatch[1]) : videoSlug.replace(/[_+-]/g, ' ');

        videos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            duration: 0,
            views: 0,
            url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
            uploader: { name: "", url: "", avatar: "" }
        });
    }
    
    if (videos.length === 0) {
        const simplePattern = /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*(?:title="([^"]+)")?/gi;
        let match;
        while ((match = simplePattern.exec(html)) !== null && videos.length < 200) {
            const videoId = match[1];
            const videoSlug = match[2];
            
            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            
            let title = match[3] ? cleanVideoTitle(match[3]) : videoSlug.replace(/[_+-]/g, ' ');
            
            videos.push({
                id: videoId,
                title: title,
                thumbnail: `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`,
                duration: 0,
                views: 0,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: { name: "", url: "", avatar: "" }
            });
        }
    }
    
    return videos;
}

source.syncRemoteWatchHistory = function(continuationToken) {
    try {
        if (!source.isLoggedIn()) {
            log("syncRemoteWatchHistory: Not logged in");
            return new SpankBangHistoryPager([], false, { continuationToken: null });
        }

        const page = continuationToken ? parseInt(continuationToken) : 1;
        const historyUrl = page > 1 
            ? `${BASE_URL}/users/history/${page}/`
            : `${BASE_URL}/users/history`;
        
        log("Syncing remote watch history from: " + historyUrl);
        const html = makeRequest(historyUrl, null, 'sync watch history');
        
        let videos = parseSearchResults(html);
        
        if (videos.length === 0) {
            videos = parseHistoryPage(html);
        }
        
        const platformVideos = videos.map(v => createPlatformVideo(v));
        
        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;
        
        log("syncRemoteWatchHistory found " + videos.length + " videos, hasMore: " + hasMore);
        return new SpankBangHistoryPager(platformVideos, hasMore, { continuationToken: nextToken });

    } catch (error) {
        log("syncRemoteWatchHistory error: " + error.message);
        return new SpankBangHistoryPager([], false, { continuationToken: null });
    }
};

source.getUserPlaylists = function() {
    try {
        if (!source.isLoggedIn()) {
            log("getUserPlaylists: Not logged in");
            return [];
        }

        const playlistsUrl = `${BASE_URL}/users/playlists`;
        log("Fetching user playlists from: " + playlistsUrl);
        const html = makeRequest(playlistsUrl, null, 'user playlists');
        
        let playlists = parsePlaylistsPage(html);
        
        if (playlists.length === 0) {
            playlists = parseUserPlaylistsPage(html);
        }
        
        const platformPlaylists = playlists.map(p => new PlatformPlaylist({
            id: new PlatformID(PLATFORM, p.id, plugin.config.id),
            name: p.name,
            thumbnail: p.thumbnail,
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, state.username || "Me", plugin.config.id),
                state.username || "Me",
                "",
                ""
            ),
            videoCount: p.videoCount || 0,
            url: p.url
        }));
        
        log("getUserPlaylists found " + platformPlaylists.length + " playlists");
        return platformPlaylists;

    } catch (error) {
        log("getUserPlaylists error: " + error.message);
        return [];
    }
};

function parseUserPlaylistsPage(html) {
    const playlists = [];
    const seenIds = new Set();
    
    const playlistBlockPattern = /<div[^>]*class="[^"]*(?:playlist|collection)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|\s*<div)/gi;
    let blockMatch;
    while ((blockMatch = playlistBlockPattern.exec(html)) !== null) {
        const block = blockMatch[0];
        
        const hrefMatch = block.match(/href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?"/i);
        if (!hrefMatch) continue;
        
        const shortId = hrefMatch[1];
        const slug = hrefMatch[2];
        const playlistId = `${shortId}:${slug}`;
        
        if (seenIds.has(playlistId)) continue;
        seenIds.add(playlistId);
        
        const nameMatch = block.match(/title="([^"]+)"/i) || 
                          block.match(/<span[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                          block.match(/>([^<]{3,50})</);
        const name = nameMatch ? (nameMatch[1] || "").replace(/<[^>]*>/g, '').trim() : slug.replace(/[_-]/g, ' ');
        
        const thumbMatch = block.match(/(?:data-src|src)="([^"]+)"/i);
        let thumbnail = thumbMatch ? thumbMatch[1] : "";
        if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
        else if (thumbnail && !thumbnail.startsWith('http')) thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
        
        const countMatch = block.match(/(\d+)\s*videos?/i);
        const videoCount = countMatch ? parseInt(countMatch[1]) : 0;
        
        if (name.length > 1) {
            playlists.push({
                id: playlistId,
                name: name,
                thumbnail: thumbnail,
                author: "",
                videoCount: videoCount,
                url: `spankbang://playlist/${playlistId}`
            });
        }
    }
    
    if (playlists.length === 0) {
        const simplePattern = /<a[^>]*href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?\"[^>]*(?:title="([^"]+)")?/gi;
        let match;
        while ((match = simplePattern.exec(html)) !== null) {
            const shortId = match[1];
            const slug = match[2];
            const playlistId = `${shortId}:${slug}`;
            
            if (seenIds.has(playlistId)) continue;
            seenIds.add(playlistId);
            
            const name = match[3] ? match[3].trim() : slug.replace(/[_-]/g, ' ');
            
            playlists.push({
                id: playlistId,
                name: name,
                thumbnail: "",
                author: "",
                videoCount: 0,
                url: `spankbang://playlist/${playlistId}`
            });
        }
    }
    
    return playlists;
}

source.getPlaylists = function() {
    return source.getUserPlaylists();
};

source.getFavorites = function() {
    try {
        if (!source.isLoggedIn()) {
            log("getFavorites: Not logged in");
            return [];
        }

        const likedUrl = `${BASE_URL}/users/liked`;
        const html = makeRequest(likedUrl, null, 'user liked videos');
        
        let videos = parseSearchResults(html);
        
        if (videos.length === 0) {
            videos = parseFavoritesPage(html);
        }
        
        log("getFavorites found " + videos.length + " videos");
        return videos.map(v => v.url);

    } catch (error) {
        log("getFavorites error: " + error.message);
        return [];
    }
};

function parseFavoritesPage(html) {
    const videos = [];
    const seenIds = new Set();
    
    const videoPatterns = [
        /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*(?:title="([^"]+)")?/gi,
        /<a[^>]*class="[^"]*thumb[^"]*"[^>]*href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*>[\s\S]*?(?:title="([^"]+)")?/gi,
        /<div[^>]*class="[^"]*(?:favorite|fav)[^"]*"[^>]*>[\s\S]*?href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/gi
    ];
    
    for (const pattern of videoPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && videos.length < 100) {
            const videoId = match[1];
            const videoSlug = match[2];
            
            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            
            let title = match[3] ? cleanVideoTitle(match[3]) : videoSlug.replace(/[_+-]/g, ' ');
            
            videos.push({
                id: videoId,
                title: title,
                thumbnail: `https://tbi.sb-cd.com/t/${videoId}/1/0/w:300/default.jpg`,
                duration: 0,
                views: 0,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: { name: "", url: "", avatar: "" }
            });
        }
        if (videos.length > 0) break;
    }
    
    return videos;
}

source.getUserPlaylistsSubs = function() {
    try {
        if (!source.isLoggedIn()) {
            log("getUserPlaylistsSubs: Not logged in");
            return [];
        }

        const playlistsSubsUrl = `${BASE_URL}/users/playlists_subs`;
        const html = makeRequest(playlistsSubsUrl, null, 'subscribed playlists');
        
        const playlists = parsePlaylistsPage(html);
        
        const platformPlaylists = playlists.map(p => new PlatformPlaylist({
            id: new PlatformID(PLATFORM, p.id, plugin.config.id),
            name: p.name,
            thumbnail: p.thumbnail,
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, p.author || "Unknown", plugin.config.id),
                p.author || "Unknown",
                "",
                ""
            ),
            videoCount: p.videoCount || 0,
            url: p.url
        }));
        
        log("getUserPlaylistsSubs found " + platformPlaylists.length + " subscribed playlists");
        return platformPlaylists;

    } catch (error) {
        log("getUserPlaylistsSubs error: " + error.message);
        return [];
    }
};

source.getLikedVideos = function() {
    return source.getFavorites();
};

source.getHome = function(continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        const url = `${BASE_URL}/trending_videos/${page}/`;

        const html = makeRequest(url, API_HEADERS, 'home content');
        const videos = parseSearchResults(html);
        const platformVideos = videos.map(v => createPlatformVideo(v));

        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangHomeContentPager(platformVideos, hasMore, { continuationToken: nextToken });

    } catch (error) {
        throw new ScriptException("Failed to get home content: " + error.message);
    }
};

source.searchSuggestions = function(query) {
    try {
        const suggestUrl = `${BASE_URL}/api/search/suggestions?q=${encodeURIComponent(query)}`;
        const response = http.GET(suggestUrl, API_HEADERS, false);

        if (response.isOk && response.body) {
            try {
                const data = JSON.parse(response.body);
                if (Array.isArray(data)) {
                    return data.slice(0, 10);
                }
                if (data.suggestions && Array.isArray(data.suggestions)) {
                    return data.suggestions.slice(0, 10);
                }
            } catch (e) {}
        }
    } catch (e) {}

    return [];
};

source.getSearchCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: ["Trending", "New", "Popular", "Featured"],
        filters: [
            {
                id: "quality",
                name: "Quality",
                isMultiSelect: false,
                filters: [
                    { name: "All", value: "" },
                    { name: "720p", value: "hd" },
                    { name: "1080p", value: "fhd" },
                    { name: "4K", value: "uhd" }
                ]
            },
            {
                id: "duration",
                name: "Duration",
                isMultiSelect: false,
                filters: [
                    { name: "All", value: "" },
                    { name: "10+ min", value: "10" },
                    { name: "20+ min", value: "20" },
                    { name: "40+ min", value: "40" }
                ]
            },
            {
                id: "period",
                name: "Date",
                isMultiSelect: false,
                filters: [
                    { name: "All time", value: "" },
                    { name: "Today", value: "d" },
                    { name: "This week", value: "w" },
                    { name: "This month", value: "m" },
                    { name: "This year", value: "y" }
                ]
            },
            {
                id: "tag",
                name: "Category",
                isMultiSelect: false,
                filters: [
                    { name: "All", value: "" },
                    { name: "Amateur", value: "amateur" },
                    { name: "Anal", value: "anal" },
                    { name: "Asian", value: "asian" },
                    { name: "Babe", value: "babe" },
                    { name: "BBW", value: "bbw" },
                    { name: "Big Ass", value: "big+ass" },
                    { name: "Big Cock", value: "big+cock" },
                    { name: "Big Tits", value: "big+tits" },
                    { name: "Blonde", value: "blonde" },
                    { name: "Blowjob", value: "blowjob" },
                    { name: "Bondage", value: "bondage" },
                    { name: "Brunette", value: "brunette" },
                    { name: "Casting", value: "casting" },
                    { name: "Compilation", value: "compilation" },
                    { name: "Cosplay", value: "cosplay" },
                    { name: "Creampie", value: "creampie" },
                    { name: "Cumshot", value: "cumshot" },
                    { name: "Deepthroat", value: "deepthroat" },
                    { name: "Double Penetration", value: "double+penetration" },
                    { name: "Ebony", value: "ebony" },
                    { name: "Facesitting", value: "facesitting" },
                    { name: "Facial", value: "facial" },
                    { name: "Feet", value: "feet" },
                    { name: "Gangbang", value: "gangbang" },
                    { name: "Gay", value: "gay" },
                    { name: "Hairy", value: "hairy" },
                    { name: "Handjob", value: "handjob" },
                    { name: "Hardcore", value: "hardcore" },
                    { name: "Hentai", value: "hentai" },
                    { name: "Indian", value: "indian" },
                    { name: "Interracial", value: "interracial" },
                    { name: "Japanese", value: "japanese" },
                    { name: "Korean", value: "korean" },
                    { name: "Latina", value: "latina" },
                    { name: "Lesbian", value: "lesbian" },
                    { name: "Massage", value: "massage" },
                    { name: "Masturbation", value: "masturbation" },
                    { name: "Mature", value: "mature" },
                    { name: "MILF", value: "milf" },
                    { name: "Orgy", value: "orgy" },
                    { name: "Outdoor", value: "outdoor" },
                    { name: "Petite", value: "petite" },
                    { name: "POV", value: "pov" },
                    { name: "Public", value: "public" },
                    { name: "Redhead", value: "redhead" },
                    { name: "Rough", value: "rough" },
                    { name: "Small Tits", value: "small+tits" },
                    { name: "Squirt", value: "squirt" },
                    { name: "Stepmom", value: "stepmom" },
                    { name: "Stepsister", value: "stepsister" },
                    { name: "Stockings", value: "stockings" },
                    { name: "Teen", value: "teen" },
                    { name: "Threesome", value: "threesome" },
                    { name: "Trans", value: "trans" },
                    { name: "Vintage", value: "vintage" },
                    { name: "VR", value: "vr" },
                    { name: "Webcam", value: "webcam" }
                ]
            }
        ]
    };
};

source.search = function(query, type, order, filters, continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        let searchQuery = query ? query.trim().replace(/\s+/g, '+') : '';
        
        if (filters && typeof filters === 'object' && filters.tag && filters.tag.length > 0) {
            const tagVal = filters.tag[0];
            if (tagVal && tagVal !== "") {
                if (searchQuery) {
                    searchQuery = `${searchQuery}+${tagVal}`;
                } else {
                    searchQuery = tagVal;
                }
            }
        }
        
        if (!searchQuery) {
            return new SpankBangSearchPager([], false, {
                query: query,
                continuationToken: null
            });
        }

        let searchUrl = `${BASE_URL}/s/${encodeURIComponent(searchQuery)}/${page}/`;

        const params = [];

        if (filters && typeof filters === 'object') {
            if (filters.duration && filters.duration.length > 0) {
                const durationVal = filters.duration[0];
                if (durationVal && durationVal !== "") {
                    params.push(`d=${durationVal}`);
                }
            }
            if (filters.quality && filters.quality.length > 0) {
                const qualityVal = filters.quality[0];
                if (qualityVal && qualityVal !== "") {
                    params.push(`q=${qualityVal}`);
                }
            }
            if (filters.period && filters.period.length > 0) {
                const periodVal = filters.period[0];
                if (periodVal && periodVal !== "") {
                    params.push(`p=${periodVal}`);
                }
            }
        }

        log("Search order value: " + order + " (type: " + typeof order + ")");
        
        const orderStr = String(order);
        log("Search order normalized to string: '" + orderStr + "'");
        
        if (orderStr === "" || orderStr === "0" || orderStr === "null" || orderStr === "undefined" || order === null || order === undefined) {
            log("Order: Relevance (default)");
        } else if (orderStr === "1" || orderStr === "new" || order === "New" || order === Type.Order.Chronological) {
            log("Order: New - adding o=new");
            params.push("o=new");
        } else if (orderStr === "2" || orderStr === "trending" || order === "Trending" || order === Type.Order.Trending) {
            log("Order: Trending - adding o=trending");
            params.push("o=trending");
        } else if (orderStr === "3" || orderStr === "popular" || order === "Popular") {
            log("Order: Popular - adding o=popular");
            params.push("o=popular");
        } else if (orderStr === "4" || orderStr === "views") {
            log("Order: Views - adding o=views");
            params.push("o=views");
        } else if (orderStr === "5" || orderStr === "rating" || order === Type.Order.Rating) {
            log("Order: Rating - adding o=top");
            params.push("o=top");
        } else if (orderStr === "6" || orderStr === "length") {
            log("Order: Length - adding o=length");
            params.push("o=length");
        } else {
            log("Order: Unknown value '" + orderStr + "' - no order param added");
        }

        if (params.length > 0) {
            searchUrl += "?" + params.join("&");
        }

        log("Search URL: " + searchUrl);

        const html = makeRequest(searchUrl, API_HEADERS, 'search');
        const videos = parseSearchResults(html);
        const platformVideos = videos.map(v => createPlatformVideo(v));

        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangSearchPager(platformVideos, hasMore, {
            query: query,
            type: type,
            order: order,
            filters: filters,
            continuationToken: nextToken
        });

    } catch (error) {
        throw new ScriptException("Failed to search: " + error.message);
    }
};

source.searchChannels = function(query, continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        let searchUrl;

        if (!query || query.trim().length === 0) {
            searchUrl = `${BASE_URL}/pornstars`;
            if (page > 1) {
                searchUrl += `/${page}`;
            }
        } else {
            const searchQuery = encodeURIComponent(query.trim());
            searchUrl = `${BASE_URL}/s/${searchQuery}/`;
            if (page > 1) {
                searchUrl += `${page}/`;
            }
        }

        const html = makeRequest(searchUrl, API_HEADERS, 'pornstar search');
        const pornstars = parsePornstarsPage(html);

        const platformChannels = pornstars.map(p => new PlatformChannel({
            id: new PlatformID(PLATFORM, p.id, plugin.config.id),
            name: p.name,
            thumbnail: p.avatar,
            banner: "",
            subscribers: p.subscribers,
            description: `${p.videoCount} videos`,
            url: `spankbang://profile/${p.id}`,
            links: {}
        }));

        const hasMore = pornstars.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangChannelPager(platformChannels, hasMore, {
            query: query,
            continuationToken: nextToken
        });

    } catch (error) {
        log("searchChannels error: " + error.message);
        return new SpankBangChannelPager([], false, { query: query });
    }
};

source.getCreators = function(continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        let url = `${BASE_URL}/pornstars`;
        if (page > 1) {
            url += `/${page}`;
        }

        const html = makeRequest(url, API_HEADERS, 'pornstars');
        const pornstars = parsePornstarsPage(html);

        const platformChannels = pornstars.map(p => new PlatformChannel({
            id: new PlatformID(PLATFORM, p.id, plugin.config.id),
            name: p.name,
            thumbnail: p.avatar,
            banner: "",
            subscribers: p.subscribers,
            description: `${p.videoCount} videos`,
            url: `spankbang://profile/${p.id}`,
            links: {}
        }));

        const hasMore = pornstars.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangCreatorPager(platformChannels, hasMore, {
            continuationToken: nextToken
        });

    } catch (error) {
        log("getCreators error: " + error.message);
        return new SpankBangCreatorPager([], false, { continuationToken: null });
    }
};

source.isChannelUrl = function(url) {
    if (!url || typeof url !== 'string') return false;

    if (REGEX_PATTERNS.urls.channelInternal.test(url)) return true;
    if (REGEX_PATTERNS.urls.profileInternal.test(url)) return true;

    if (REGEX_PATTERNS.urls.relativeProfile.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativeChannel.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativePornstar.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativePornstarSimple.test(url)) return true;

    if (REGEX_PATTERNS.urls.channelProfile.test(url)) return true;
    if (REGEX_PATTERNS.urls.channelOfficial.test(url)) return true;
    if (REGEX_PATTERNS.urls.pornstar.test(url)) return true;
    if (REGEX_PATTERNS.urls.pornstarSimple.test(url)) return true;

    return false;
};

source.getChannel = function(url) {
    try {
        const result = extractChannelId(url);
        let profileUrl;
        let internalUrl;
        let resolvedShortId = result.shortId;
        
        const normalizedId = result.id.toLowerCase().replace(/\s+/g, '+');

        if (result.type === 'pornstar') {
            if (!resolvedShortId) {
                resolvedShortId = resolvePornstarShortId(normalizedId);
                log("Resolved pornstar shortId for " + normalizedId + ": " + resolvedShortId);
            }
            
            if (resolvedShortId) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${resolvedShortId}/pornstar/${normalizedId}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${normalizedId}`;
            }
            internalUrl = `spankbang://profile/pornstar:${normalizedId}`;
        } else if (result.type === 'channel') {
            const [shortId, channelName] = result.id.split(':');
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}`;
            internalUrl = `spankbang://channel/${result.id}`;
        } else {
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}`;
            internalUrl = `spankbang://profile/${result.id}`;
        }

        log("Fetching channel from: " + profileUrl);
        const html = makeRequest(profileUrl, API_HEADERS, 'channel');

        const namePatterns = [
            /<h1[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/h1>/i,
            /<h1[^>]*>([^<]+)<\/h1>/,
            /<title>([^<]+?)(?:\s*-\s*SpankBang)?<\/title>/
        ];

        let name = result.id.replace(/\+/g, ' ');
        for (const pattern of namePatterns) {
            const nameMatch = html.match(pattern);
            if (nameMatch && nameMatch[1]) {
                name = nameMatch[1].trim();
                break;
            }
        }

        let avatar = "";
        const avatarPatterns = [
            /src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i,
            /data-src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i,
            /src="(https?:\/\/[^"]*pornstarimg[^"]+)"/i,
            /"(\/\/[^"]*pornstarimg[^"]+)"/i,
            /src="(https?:\/\/spankbang\.com\/avatar\/[^"]+)"/i,
            /src="(\/\/spankbang\.com\/avatar\/[^"]+)"/i,
            /<img[^>]*src="(\/avatar\/[^"]+)"/i,
            /class="[^"]*avatar[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*profile-pic[^"]*"[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*image[^"]*"[^>]*src="([^"]+)"/i,
            /<div[^>]*class="[^"]*(?:pic|photo|thumb)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i
        ];

        for (const pattern of avatarPatterns) {
            const avatarMatch = html.match(pattern);
            if (avatarMatch && avatarMatch[1]) {
                avatar = avatarMatch[1];
                if (avatar.startsWith('//')) {
                    avatar = `https:${avatar}`;
                } else if (!avatar.startsWith('http')) {
                    avatar = `${CONFIG.EXTERNAL_URL_BASE}${avatar}`;
                }
                if (avatar.includes('pornstarimg') || avatar.includes('avatar')) {
                    break;
                }
            }
        }

        if (!avatar && result.type === 'pornstar' && resolvedShortId) {
            const shortIdNum = resolvedShortId.charCodeAt(0) * 256 + (resolvedShortId.charCodeAt(1) || 0);
            avatar = `https://spankbang.com/pornstarimg/f/${shortIdNum}-250.jpg`;
        }

        const bannerPatterns = [
            /class="[^"]*cover[^"]*"[^>]*style="[^"]*url\(['"]?([^'")\s]+)['"]?\)/,
            /class="[^"]*banner[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i,
            /class="[^"]*profile[_-]?header[^"]*"[^>]*style="[^"]*background[^:]*:[^;]*url\(['"]?([^'")\s]+)['"]?\)/i,
            /style="[^"]*background-image:\s*url\(['"]?([^'")\s]+)['"]?\)[^"]*"[^>]*class="[^"]*(?:cover|header|banner)[^"]*"/i,
            /<div[^>]*class="[^"]*(?:header|top|hero)[^"]*"[^>]*>[^<]*<img[^>]*src="([^"]+)"/i
        ];

        let banner = "";
        for (const pattern of bannerPatterns) {
            const bannerMatch = html.match(pattern);
            if (bannerMatch && bannerMatch[1]) {
                let bannerUrl = bannerMatch[1];
                if (bannerUrl.startsWith('//')) {
                    bannerUrl = `https:${bannerUrl}`;
                } else if (!bannerUrl.startsWith('http')) {
                    bannerUrl = `${CONFIG.EXTERNAL_URL_BASE}${bannerUrl}`;
                }
                banner = bannerUrl;
                break;
            }
        }

        if (!banner && avatar && result.type === 'pornstar') {
            banner = avatar;
        }

        const subscriberPatterns = [
            />([0-9,]+)\s*<\/em>/i,
            /<em[^>]*>([0-9,]+)<\/em>/i,
            /(\d+(?:[,.\d]*)?[KMB]?)\s*(?:subscribers?|followers?|views?)/i,
            /class="[^"]*subscribers[^"]*"[^>]*>([^<]+)</i
        ];

        let subscribers = 0;
        for (const pattern of subscriberPatterns) {
            const subMatch = html.match(pattern);
            if (subMatch && subMatch[1]) {
                const subStr = subMatch[1].replace(/<[^>]*>/g, '').trim();
                subscribers = parseViewCount(subStr);
                if (subscribers > 0) break;
            }
        }

        const videoCountMatch = html.match(/(\d+)\s*videos?/i);
        const videoCount = videoCountMatch ? parseInt(videoCountMatch[1]) : 0;

        const descPatterns = [
            /<div[^>]*class="[^"]*(?:bio|about|description)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<p[^>]*class="[^"]*(?:bio|about|description)[^"]*"[^>]*>([\s\S]*?)<\/p>/i
        ];

        let description = videoCount > 0 ? `${videoCount} videos` : "";
        for (const pattern of descPatterns) {
            const descMatch = html.match(pattern);
            if (descMatch && descMatch[1]) {
                const descText = descMatch[1].replace(/<[^>]*>/g, '').trim();
                if (descText) {
                    description = descText;
                }
                break;
            }
        }

        const channelThumbnail = banner || avatar;
        
        return new PlatformChannel({
            id: new PlatformID(PLATFORM, result.type === 'pornstar' ? `pornstar:${result.id}` : result.id, plugin.config.id),
            name: name,
            thumbnail: channelThumbnail,
            banner: banner,
            subscribers: subscribers,
            description: description,
            url: internalUrl,
            links: {}
        });

    } catch (error) {
        throw new ScriptException("Failed to get channel: " + error.message);
    }
};

source.getChannelCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.getSearchChannelContentsCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.getChannelContents = function(url, type, order, filters, continuationToken) {
    try {
        const result = extractChannelId(url);
        const page = continuationToken ? parseInt(continuationToken) : 1;

        let profileUrl;
        if (result.type === 'pornstar') {
            let resolvedShortId = result.shortId;
            if (!resolvedShortId) {
                resolvedShortId = resolvePornstarShortId(result.id);
            }
            
            if (resolvedShortId) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${resolvedShortId}/pornstar/${result.id}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${result.id}`;
            }
            
            if (page > 1) {
                profileUrl += `/${page}`;
            }
        } else if (result.type === 'channel') {
            const [shortId, channelName] = result.id.split(':');
            if (page > 1) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}/${page}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}`;
            }
        } else {
            if (page > 1) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}/videos/${page}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}/videos`;
            }
        }

        if (order === Type.Order.Views) {
            profileUrl += (profileUrl.includes('?') ? '&' : '?') + 'o=4';
        } else if (order === Type.Order.Rating) {
            profileUrl += (profileUrl.includes('?') ? '&' : '?') + 'o=5';
        }

        const html = makeRequest(profileUrl, API_HEADERS, 'channel contents');
        const videos = parseSearchResults(html);
        const platformVideos = videos.map(v => createPlatformVideo(v));

        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangChannelContentPager(platformVideos, hasMore, {
            url: url,
            type: type,
            order: order,
            filters: filters,
            continuationToken: nextToken
        });

    } catch (error) {
        throw new ScriptException("Failed to get channel contents: " + error.message);
    }
};

source.getChannelVideos = function(url, continuationToken) {
    return source.getChannelContents(url, Type.Feed.Videos, Type.Order.Chronological, [], continuationToken);
};

source.isContentDetailsUrl = function(url) {
    if (!url || typeof url !== 'string') return false;

    return REGEX_PATTERNS.urls.videoStandard.test(url) ||
           REGEX_PATTERNS.urls.videoAlternative.test(url) ||
           REGEX_PATTERNS.urls.videoShort.test(url);
};

source.getContentDetails = function(url) {
    try {
        const html = makeRequest(url, API_HEADERS, 'video details');
        const videoData = parseVideoPage(html, url);
        return createVideoDetails(videoData, url);

    } catch (error) {
        throw new ScriptException("Failed to get video details: " + error.message);
    }
};

source.getContentRecommendations = function(url) {
    try {
        const html = makeRequest(url, API_HEADERS, 'recommendations');
        const videoData = parseVideoPage(html, url);

        if (videoData.relatedVideos && videoData.relatedVideos.length > 0) {
            const platformVideos = videoData.relatedVideos.map(v => createPlatformVideo(v));
            return new SpankBangSearchPager(platformVideos, false, { url: url });
        }

        return new SpankBangSearchPager([], false, { url: url });

    } catch (error) {
        log("getContentRecommendations error: " + error.message);
        return new SpankBangSearchPager([], false, { url: url });
    }
};

source.getComments = function(url) {
    try {
        const videoId = extractVideoId(url);
        let comments = [];
        
        comments = fetchCommentsFromApi(videoId);
        
        if (comments.length === 0) {
            try {
                const commentsUrl = `${BASE_URL}/${videoId}/comments/`;
                const html = makeRequestNoThrow(commentsUrl, API_HEADERS, 'comments');
                if (html.isOk && html.body) {
                    comments = parseComments(html.body, videoId);
                }
            } catch (e) {
                log("Comments page request failed: " + e.message);
            }
        }
        
        if (comments.length === 0) {
            try {
                const videoPageHtml = makeRequest(url, API_HEADERS, 'video page for comments');
                const commentsSection = videoPageHtml.match(/<div[^>]*id="[^"]*comments[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/i);
                if (commentsSection && commentsSection[1]) {
                    comments = parseComments(commentsSection[1], videoId);
                } else {
                    comments = parseComments(videoPageHtml, videoId);
                }
            } catch (e) {
                log("Video page comments extraction failed: " + e.message);
            }
        }

        log("getComments found " + comments.length + " comments for video " + videoId);
        const platformComments = comments.map(c => new Comment(c));

        return new SpankBangCommentPager(platformComments, comments.length >= 20, { url: url, videoId: videoId, page: 1 });

    } catch (error) {
        log("getComments error: " + error.message);
        return new SpankBangCommentPager([], false, { url: url });
    }
};

source.getSubComments = function(comment) {
    return new SpankBangCommentPager([], false, {});
};

source.isPlaylistUrl = function(url) {
    if (!url || typeof url !== 'string') return false;

    return REGEX_PATTERNS.urls.playlistInternal.test(url) ||
           REGEX_PATTERNS.urls.categoryInternal.test(url);
};

source.searchPlaylists = function(query, type, order, filters, continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        let searchUrl;

        if (!query || query.trim().length === 0) {
            searchUrl = `${BASE_URL}/playlists/`;
            if (page > 1) {
                searchUrl += `${page}/`;
            }
        } else {
            const searchQuery = encodeURIComponent(query.trim().replace(/\s+/g, '+'));
            if (page > 1) {
                searchUrl = `${BASE_URL}/s/${searchQuery}/${page}/?t=playlist`;
            } else {
                searchUrl = `${BASE_URL}/s/${searchQuery}/?t=playlist`;
            }
        }
        
        log("Playlist search URL: " + searchUrl);

        const html = makeRequest(searchUrl, API_HEADERS, 'playlist search');
        const playlists = parsePlaylistsPage(html);

        const platformPlaylists = playlists.map(p => new PlatformPlaylist({
            id: new PlatformID(PLATFORM, p.id, plugin.config.id),
            name: p.name,
            thumbnail: p.thumbnail,
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, p.author || "Unknown", plugin.config.id),
                p.author || "Unknown",
                "",
                ""
            ),
            videoCount: p.videoCount || 0,
            url: p.url
        }));

        const hasMore = playlists.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangPlaylistPager(platformPlaylists, hasMore, {
            query: query,
            continuationToken: nextToken
        });

    } catch (error) {
        log("searchPlaylists error: " + error.message);
        return new SpankBangPlaylistPager([], false, { query: query });
    }
};

source.getPlaylist = function(url) {
    try {
        const categoryMatch = url.match(REGEX_PATTERNS.urls.categoryInternal);
        const playlistMatch = url.match(REGEX_PATTERNS.urls.playlistInternal);
        
        let playlistUrl;
        let playlistId;
        let playlistName;

        if (categoryMatch) {
            const category = categoryMatch[1];
            playlistUrl = `${BASE_URL}/${category}/`;
            playlistId = category;
            playlistName = category.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        } else if (playlistMatch) {
            const id = playlistMatch[1];
            if (id.includes(':')) {
                const [shortId, slug] = id.split(':');
                playlistUrl = `${BASE_URL}/${shortId}/playlist/${slug}/`;
                playlistId = id;
                playlistName = slug.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            } else {
                playlistUrl = `${BASE_URL}/playlist/${id}/`;
                playlistId = id;
                playlistName = id.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            }
        } else {
            throw new ScriptException("Invalid playlist URL format");
        }

        log("Fetching playlist from: " + playlistUrl);
        const html = makeRequest(playlistUrl, API_HEADERS, 'playlist');
        
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+?)(?:\s*-\s*SpankBang)?<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            playlistName = titleMatch[1].trim();
        }
        
        const videos = parseSearchResults(html);
        const platformVideos = videos.map(v => createPlatformVideo(v));

        return new PlatformPlaylistDetails({
            id: new PlatformID(PLATFORM, playlistId, plugin.config.id),
            name: playlistName,
            thumbnail: platformVideos.length > 0 ? platformVideos[0].thumbnails : new Thumbnails([]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, "spankbang", plugin.config.id),
                "SpankBang",
                CONFIG.EXTERNAL_URL_BASE,
                ""
            ),
            datetime: 0,
            url: url,
            videoCount: platformVideos.length,
            contents: new SpankBangSearchPager(platformVideos, false, { query: playlistId })
        });

    } catch (error) {
        throw new ScriptException("Failed to get playlist: " + error.message);
    }
};

class SpankBangHomeContentPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getHome(this.context.continuationToken);
    }
}

class SpankBangSearchPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.search(
            this.context.query,
            this.context.type,
            this.context.order,
            this.context.filters,
            this.context.continuationToken
        );
    }
}

class SpankBangChannelPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.searchChannels(this.context.query, this.context.continuationToken);
    }
}

class SpankBangCreatorPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getCreators(this.context.continuationToken);
    }
}

class SpankBangChannelContentPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getChannelContents(
            this.context.url,
            this.context.type,
            this.context.order,
            this.context.filters,
            this.context.continuationToken
        );
    }
}

class SpankBangPlaylistPager extends PlaylistPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return new SpankBangPlaylistPager([], false, this.context);
    }
}

class SpankBangCommentPager extends CommentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return new SpankBangCommentPager([], false, this.context);
    }
}

class SpankBangHistoryPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.syncRemoteWatchHistory(this.context.continuationToken);
    }
}

log("SpankBang plugin loaded - v31");

const CHANNEL_HANDLE = "@DaNangCommunityRadio";
const CHANNEL_ID = "UCD5FT28shfTGuiUIuPw3OXw";
const FALLBACK_VIDEO_ID = "75LBuMC3vFA";
const FALLBACK_TITLE = "DNCR On The Air";
const DEFAULT_DESC =
  "Latest transmission from Da Nang Community Radio — an independent audiovisual radio platform spotlighting DJs, selectors, and live electronic sessions from central Vietnam.";

export async function onRequestGet() {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30, s-maxage=30",
  };

  let liveStream = null;

  // 1. Check if the channel is currently broadcasting live
  try {
    const liveRes = await fetch(`https://www.youtube.com/${CHANNEL_HANDLE}/live`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
        cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+999;",
      },
      redirect: "follow",
    });

    const html = await liveRes.text();
    const isLive = /"isLiveNow"\s*:\s*true/.test(html);
    const canonicalMatch = html.match(
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/
    );

    if (isLive && canonicalMatch) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const rawTitle = titleMatch
        ? titleMatch[1].replace(/\s*-\s*YouTube$/, "").trim()
        : "DNCR Live";

      liveStream = {
        videoId: canonicalMatch[1],
        title: decodeHtmlEntities(rawTitle),
      };
    }
  } catch (_) {
    // Proceed to RSS feed even if live check fails
  }

  // 2. Fetch the last 4 full-length uploads (excluding Shorts) from YouTube RSS
  const archive = [];
  try {
    const rssRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`,
      { cf: { cacheTtl: 30 } }
    );

    if (rssRes.ok) {
      const xml = await rssRes.text();
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

      for (const match of entries) {
        if (archive.length >= 4) break;
        const entry = match[1];

        // Skip YouTube Shorts
        if (entry.includes("/shorts/")) continue;

        const idMatch = entry.match(/<yt:videoId>([a-zA-Z0-9_-]{11})<\/yt:videoId>/);
        const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
        const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
        const descMatch = entry.match(/<media:description>([\s\S]*?)<\/media:description>/);

        if (idMatch) {
          archive.push({
            videoId: idMatch[1],
            title: titleMatch ? decodeHtmlEntities(titleMatch[1]) : FALLBACK_TITLE,
            published: publishedMatch ? publishedMatch[1] : null,
            description: formatDescription(descMatch ? decodeHtmlEntities(descMatch[1]) : ""),
          });
        }
      }
    }
  } catch (_) {
    // Fall through with whatever was collected
  }

  const latest = archive[0] || {
    videoId: FALLBACK_VIDEO_ID,
    title: FALLBACK_TITLE,
    published: null,
    description: DEFAULT_DESC,
  };

  if (liveStream) {
    return new Response(
      JSON.stringify({
        live: true,
        videoId: liveStream.videoId,
        title: liveStream.title,
        published: null,
        description: "Live broadcast from Da Nang Community Radio in central Vietnam.",
        archive,
      }),
      { headers }
    );
  }

  return new Response(
    JSON.stringify({
      live: false,
      videoId: latest.videoId,
      title: latest.title,
      published: latest.published,
      description: latest.description,
      archive,
    }),
    { headers }
  );
}

function formatDescription(raw) {
  const firstBlock = raw
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, " ")
    .trim();

  if (!firstBlock) return DEFAULT_DESC;
  if (firstBlock.length <= 220) return firstBlock;
  return firstBlock.slice(0, 217).replace(/\s+\S*$/, "") + "...";
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
const CHANNEL_HANDLE = "@DaNangCommunityRadio";
const FALLBACK_VIDEO_ID = "75LBuMC3vFA";
const FALLBACK_TITLE = "DNCR On The Air";

export async function onRequestGet() {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30, s-maxage=30",
  };

  try {
    const liveRes = await fetch(`https://www.youtube.com/${CHANNEL_HANDLE}/live`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    const html = await liveRes.text();

    // Check if the channel currently has an active livestream
    const isLive =
      /"isLiveNow"\s*:\s*true/.test(html) ||
      /"isLive"\s*:\s*true/.test(html);

    const canonicalMatch = html.match(
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/
    );
    const liveVideoId = canonicalMatch ? canonicalMatch[1] : null;

    if (isLive && liveVideoId) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const rawTitle = titleMatch ? titleMatch[1].replace(/\s*-\s*YouTube$/, "").trim() : "DNCR Live";

      return new Response(
        JSON.stringify({
          live: true,
          videoId: liveVideoId,
          title: decodeHtmlEntities(rawTitle),
        }),
        { headers }
      );
    }

    // Not live: fetch the latest upload from YouTube's public RSS feed
    const channelIdMatch = html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
    if (channelIdMatch) {
      const rssRes = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdMatch[1]}`
      );
      if (rssRes.ok) {
        const xml = await rssRes.text();
        const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
        if (entryMatch) {
          const entry = entryMatch[1];
          const idMatch = entry.match(/<yt:videoId>([a-zA-Z0-9_-]{11})<\/yt:videoId>/);
          const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
          const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);

          if (idMatch) {
            return new Response(
              JSON.stringify({
                live: false,
                videoId: idMatch[1],
                title: titleMatch ? decodeHtmlEntities(titleMatch[1]) : FALLBACK_TITLE,
                published: publishedMatch ? publishedMatch[1] : null,
              }),
              { headers }
            );
          }
        }
      }
    }
  } catch (_) {
    // Fall through to default response
  }

  return new Response(
    JSON.stringify({
      live: false,
      videoId: FALLBACK_VIDEO_ID,
      title: FALLBACK_TITLE,
    }),
    { headers }
  );
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "liveauctioneers.com",
  // Add more auction platform hosts as needed
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 },
    );
  }

  // Validate URL and host
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const isAllowed = ALLOWED_HOSTS.some((host) =>
    parsedUrl.hostname.endsWith(host),
  );
  if (!isAllowed) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  // Fetch image
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AuctionProxy/1.0)",
      Referer: parsedUrl.origin,
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Upstream error: ${response.status}` },
      { status: 502 },
    );
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const imageBuffer = await response.arrayBuffer();

  return new NextResponse(imageBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}

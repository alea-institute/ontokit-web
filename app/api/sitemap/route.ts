import { NextRequest, NextResponse } from "next/server";
import {
  addSitemapEntry,
  generateSitemap,
  removeSitemapEntry,
} from "@/lib/sitemap";

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;

interface SitemapAction {
  secret: string;
  action: "add" | "remove" | "regenerate";
  url?: string;
  lastmod?: string;
}

export async function POST(request: NextRequest) {
  const body: SitemapAction = await request.json();

  if (!REVALIDATION_SECRET || body.secret !== REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  switch (body.action) {
    case "add":
      if (!body.url) {
        return NextResponse.json(
          { error: "url is required for add action" },
          { status: 400 }
        );
      }
      await addSitemapEntry(body.url, body.lastmod);
      return NextResponse.json({ ok: true, action: "add", url: body.url });

    case "remove":
      if (!body.url) {
        return NextResponse.json(
          { error: "url is required for remove action" },
          { status: 400 }
        );
      }
      await removeSitemapEntry(body.url);
      return NextResponse.json({ ok: true, action: "remove", url: body.url });

    case "regenerate":
      await generateSitemap();
      return NextResponse.json({ ok: true, action: "regenerate" });

    default:
      return NextResponse.json(
        { error: "Invalid action. Use add, remove, or regenerate." },
        { status: 400 }
      );
  }
}

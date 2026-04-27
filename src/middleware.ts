import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;

  // Public paths
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/merchant/login") ||
    path.startsWith("/api/payment/webhook") ||
    path.startsWith("/_next") ||
    path.startsWith("/icons") ||
    path.startsWith("/manifest") ||
    path === "/offline";

  if (!user && !isPublic) {
    const target = path.startsWith("/merchant") ? "/merchant/login" : "/login";
    const url = req.nextUrl.clone();
    url.pathname = target;
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Merchant gating: require role = 'merchant' on /merchant routes
  if (user && path.startsWith("/merchant") && !path.startsWith("/merchant/login")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || (profile.role !== "merchant" && profile.role !== "admin")) {
      const url = req.nextUrl.clone();
      url.pathname = "/merchant/login";
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-.*).*)"],
};

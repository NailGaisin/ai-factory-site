import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPath =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname === "/api/ai/analyze-lead";

  if (!protectedPath) {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");

  if (!auth || !auth.startsWith("Basic ")) {
    return new NextResponse("Требуется авторизация", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="AI FACTORY CRM"',
      },
    });
  }

  try {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
    const separator = decoded.indexOf(":");

    if (separator === -1) {
      throw new Error("Invalid credentials");
    }

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    if (
      username !== process.env.ADMIN_LOGIN ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return new NextResponse("Неверный логин или пароль", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="AI FACTORY CRM"',
        },
      });
    }

    return NextResponse.next();
  } catch {
    return new NextResponse("Неверные данные авторизации", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="AI FACTORY CRM"',
      },
    });
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/ai/analyze-lead",
  ],
};

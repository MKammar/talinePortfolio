const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function jsonResponse(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Origin": origin
    }
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  const productionOrigin = Deno.env.get("PORTFOLIO_ORIGIN") || "";
  const previewOrigin = /^https:\/\/[a-z0-9-]+(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);
  const localOrigin = /^http:\/\/localhost(?::\d+)?$/i.test(origin);
  const allowedOrigin = origin === productionOrigin || previewOrigin || localOrigin;

  if (request.method === "OPTIONS") {
    if (!allowedOrigin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin }
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, allowedOrigin ? origin : productionOrigin);
  }
  if (!allowedOrigin) {
    return jsonResponse({ error: "This website is not allowed to publish portfolio changes." }, 403, productionOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const githubToken = Deno.env.get("GITHUB_TOKEN");
  const repository = Deno.env.get("GITHUB_REPOSITORY");
  const branch = Deno.env.get("GITHUB_BRANCH");
  if (!supabaseUrl || !anonKey || !githubToken || !repository || !branch) {
    return jsonResponse({ error: "The secure publisher is not configured yet. Ask the site owner to finish the GitHub setup." }, 500, origin);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Please sign in again before publishing." }, 401, origin);
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization }
    });
    if (!authResponse.ok) {
      return jsonResponse({ error: "Your session is invalid or expired. Sign in again." }, 401, origin);
    }
    const authUser = await authResponse.json();
    if (!authUser.id) return jsonResponse({ error: "Could not verify your account." }, 401, origin);

    const adminResponse = await fetch(
      `${supabaseUrl}/rest/v1/portfolio_admins?select=user_id&user_id=eq.${encodeURIComponent(authUser.id)}`,
      { headers: { apikey: anonKey, Authorization: authorization } }
    );
    if (!adminResponse.ok) {
      return jsonResponse({ error: "Could not verify portfolio admin access. Check the Supabase setup." }, 403, origin);
    }
    const admins = await adminResponse.json();
    if (!Array.isArray(admins) || admins.length === 0) {
      return jsonResponse({ error: "This account is not authorized to publish the portfolio." }, 403, origin);
    }

    const body = await request.json();
    if (!body.content || typeof body.content !== "object" || Array.isArray(body.content)) {
      return jsonResponse({ error: "Portfolio content must be a JSON object." }, 400, origin);
    }
    const serialized = `${JSON.stringify(body.content, null, 2)}\n`;
    if (new TextEncoder().encode(serialized).length > 1_000_000) {
      return jsonResponse({ error: "Portfolio content is too large to commit (maximum 1 MB)." }, 413, origin);
    }

    const githubHeaders = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };
    const filePath = "dist/portfolio-content.json";
    const apiUrl = `https://api.github.com/repos/${repository}/contents/${filePath}`;
    const currentFile = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders });
    let sha: string | undefined;
    if (currentFile.ok) {
      const existing = await currentFile.json();
      sha = existing.sha;
    } else if (currentFile.status !== 404) {
      const detail = await currentFile.text();
      console.error("GitHub content lookup failed:", currentFile.status, detail);
      return jsonResponse({ error: "GitHub could not read the portfolio file. Check the repository, branch, and token permissions." }, 502, origin);
    }

    const bytes = new TextEncoder().encode(serialized);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const commitResponse = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...githubHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Update portfolio content",
        content: btoa(binary),
        branch,
        ...(sha ? { sha } : {})
      })
    });
    if (!commitResponse.ok) {
      const detail = await commitResponse.text();
      console.error("GitHub content commit failed:", commitResponse.status, detail);
      return jsonResponse({ error: "GitHub rejected the publish. Check that the token can write repository contents and that the branch exists." }, 502, origin);
    }

    const result = await commitResponse.json();
    return jsonResponse({
      message: "Portfolio changes were committed to GitHub. Vercel will publish them after its deployment finishes.",
      commitUrl: result.commit?.html_url,
      commitSha: result.commit?.sha
    }, 200, origin);
  } catch (error) {
    console.error("Portfolio publish failed:", error);
    return jsonResponse({ error: "Publishing failed unexpectedly. No GitHub commit was confirmed." }, 500, origin);
  }
});

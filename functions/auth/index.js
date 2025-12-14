// Cloudflare Pages Function to initiate GitHub OAuth
// This starts the OAuth flow when user clicks "Login with GitHub"

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const provider = url.searchParams.get('provider');

  if (provider !== 'github') {
    return new Response('Only GitHub provider is supported', { status: 400 });
  }

  const clientId = env.OAUTH_CLIENT_ID;
  const redirectUri = `${url.origin}/auth/callback`;

  // Redirect to GitHub OAuth
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`;

  return Response.redirect(githubAuthUrl, 302);
}

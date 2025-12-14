// SvelteKit route to initiate GitHub OAuth
// This starts the OAuth flow when user clicks "Login with GitHub"

import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function GET({ url }) {
  const provider = url.searchParams.get('provider');

  if (provider !== 'github') {
    return new Response('Only GitHub provider is supported', { status: 400 });
  }

  const clientId = env.OAUTH_CLIENT_ID;
  const redirectUri = `${url.origin}/auth/callback`;

  // Redirect to GitHub OAuth
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`;

  throw redirect(302, githubAuthUrl);
}

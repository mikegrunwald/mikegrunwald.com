// Cloudflare Pages Function for GitHub OAuth callback
// This handles the OAuth flow for Decap CMS

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Get the authorization code from GitHub
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
      code: code,
    }),
  });

  const data = await tokenResponse.json();

  if (data.error) {
    return new Response(`OAuth error: ${data.error_description}`, { status: 400 });
  }

  // Return the token to the CMS
  const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
  <title>Authorizing...</title>
</head>
<body>
  <script>
    (function() {
      function receiveMessage(e) {
        console.log("receiveMessage %o", e);
        window.opener.postMessage(
          'authorization:github:success:${JSON.stringify({
            token: data.access_token,
            provider: 'github'
          })}',
          e.origin
        );
        window.removeEventListener("message", receiveMessage, false);
      }
      window.addEventListener("message", receiveMessage, false);
      console.log("Sending message: %o", "github");
      window.opener.postMessage("authorizing:github", "*");
    })();
  </script>
</body>
</html>
  `;

  return new Response(htmlResponse, {
    headers: { 'Content-Type': 'text/html' },
  });
}

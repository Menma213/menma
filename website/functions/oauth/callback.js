// Handle /oauth/callback - this will be the comment xd
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (!code) {
        return new Response('No code provided', { status: 400 });
    }

    try {
        // Exchange code for token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: env.DISCORD_CLIENT_ID,
                client_secret: env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: `${url.origin}/oauth/callback`,
            }),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            return new Response(JSON.stringify(tokenData), { status: 500 });
        }

        // Get User Data
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        if (!userResponse.ok) {
            return new Response(JSON.stringify(userData), { status: 500 });
        }

        // Redirect to Hub with Data
        const redirectUrl = new URL('/hub.html', request.url);
        redirectUrl.searchParams.set('discord_id', userData.id);
        redirectUrl.searchParams.set('username', userData.username);
        redirectUrl.searchParams.set('avatar', userData.avatar);

        return new Response(null, {
            status: 302,
            headers: { 'Location': redirectUrl.toString() },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.toString() }), { status: 500 });
    }
}

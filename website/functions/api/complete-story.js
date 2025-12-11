// Handle /api/complete-story - this will be the comment xd
export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const data = await request.json();
        const userId = data.userId;

        if (!userId) {
            return new Response(
                JSON.stringify({ success: false, error: 'User ID required' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // In production, you would save to KV or D1 database
        // For now, we'll just log it and return success
        console.log('Story completion data:', {
            userId: userId,
            storyId: data.storyId,
            jutsuChosen: data.jutsuChosen,
            timestamp: new Date().toISOString()
        });

        // Simulated save to completedstory.json (would be KV in production)
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Story completion recorded',
                userId: userId
            }),
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: error.toString() }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

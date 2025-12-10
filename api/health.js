// Simple health check endpoint for monitoring

export default function handler(req, res) {
    return res.status(200).json({
        status: 'ok',
        message: 'Currency converter API is healthy.',
        timestamp: new Date().toISOString()
    });
}



import jwt from 'jsonwebtoken';

// This function generates the JWT token required by Z.ai
function generateToken(apiKey) {
    const [id, secret] = apiKey.split('.');
    const payload = {
        api_key: id,
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // Token expires in 1 hour
        timestamp: Date.now(),
    };
    return jwt.sign(payload, secret, { algorithm: 'HS256', header: { alg: 'HS256', sign_type: 'SIGN' } });
}

export default async function handler(req, res) {
    const apiKey = process.env.Z_AI_KEY;
    if (!apiKey) {
        return res.status(500).json({ message: 'API key is not configured.' });
    }

    try {
        // Step 1: Generate the JWT token
        const token = generateToken(apiKey);

        const apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
        const requestBody = {
            model: "glm-4.5-flash",
            messages: [{ role: "user", content: "Hello, what is your name? Respond in one short sentence." }]
        };

        // Step 2: Call the Z.ai API with the correct JWT token
        const zApiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Use "Bearer" with the generated token
            },
            body: JSON.stringify(requestBody )
        });

        const data = await zApiResponse.json();

        if (!zApiResponse.ok) {
            return res.status(zApiResponse.status).json(data);
        }

        // Step 3: Send the successful response back to the frontend
        res.status(200).json(data);

    } catch (error) {
        // This will now catch the real error if the response is not JSON
        res.status(500).json({ message: 'An internal server error occurred.', details: error.message });
    }
}

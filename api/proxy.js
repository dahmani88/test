// This is our Serverless Function backend (api/proxy.js)
export default async function handler(req, res) {
    // --- Configuration (SAFE ON THE BACKEND) ---
    const apiKey = process.env.Z_AI_KEY; // We will set this on Vercel, not in the code
    const apiUrl = 'https://api.z.ai/v1/chat/completions';
    
    const requestBody = {
        model: "glm-4.5-flash",
        messages: [
            {
                role: "user",
                content: "Hello, what is your name? Respond in one short sentence."
            }
        ]
    };

    try {
        // Step 2: Our backend calls the Z.ai API
        const zApiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody )
        });

        const data = await zApiResponse.json();

        // If Z.ai returns an error, we pass it to our frontend
        if (!zApiResponse.ok) {
            res.status(zApiResponse.status).json(data);
            return;
        }

        // Step 3: Our backend sends the successful response back to our frontend
        res.status(200).json(data);

    } catch (error) {
        res.status(500).json({ message: 'An internal server error occurred.', details: error.message });
    }
}

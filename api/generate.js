// No longer need 'jsonwebtoken' as Manus uses a simpler API key
// const jwt = require('jsonwebtoken'); 

export default async function handler(req, res) {
    // Set CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Get the Manus API key from environment variables
        const manusApiKey = process.env.MANUS_API_KEY;
        if (!manusApiKey) {
            return res.status(500).json({ 
                error: 'MANUS_API_KEY environment variable is not configured.' 
            });
        }

        // 2. Extract product data from the request body
        const { 
            productName, 
            features, 
            audience, 
            keywords, 
            tone, 
            language 
        } = req.body;

        // Validate that all required fields are present
        if (!productName || !features || !audience || !tone || !language) {
            return res.status(400).json({ 
                error: 'Missing required fields: productName, features, audience, tone, and language are all required.' 
            });
        }

        // 3. Define the task to be delegated to Manus
        // This is a structured object, not a long prompt string.
        const taskToDelegate = {
            task_name: "Generate E-commerce Product Description",
            input_data: {
                productName: productName,
                productFeatures: features,
                targetAudience: audience,
                seoKeywords: keywords, // Can be an empty string if not provided
                toneOfVoice: tone,
                outputLanguage: language
            },
            // Specify the desired output format for consistency
            output_format: "A single string containing 3 distinct versions, each separated by '---'."
        };

        // 4. Call the Manus Task Delegation API
        const manusTaskEndpoint = 'https://api.manus.ai/v1/tasks/delegate';
        
        const manusResponse = await fetch(manusTaskEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Manus uses a standard Bearer token authentication
                'Authorization': `Bearer ${manusApiKey}`
            },
            body: JSON.stringify(taskToDelegate )
        });

        // 5. Handle the response from Manus
        const resultData = await manusResponse.json();

        if (!manusResponse.ok) {
            // If Manus API returns an error, forward it to the frontend
            const errorMessage = resultData.error?.message || `Manus API Error: ${manusResponse.status}`;
            return res.status(manusResponse.status).json({ error: errorMessage });
        }

        // 6. Send the successful result back to the frontend
        // The result from Manus is expected in resultData.output
        if (!resultData.output) {
             return res.status(500).json({ error: 'Invalid response format from Manus API.' });
        }
        
        return res.status(200).json({ 
            descriptions: resultData.output 
            // You can add other data from the Manus response if needed, e.g., usage stats
            // usage: resultData.usage || null 
        });

    } catch (error) {
        // Catch any unexpected network or parsing errors
        console.error('Error in generate API (Manus):', error);
        return res.status(500).json({ 
            error: 'An unexpected server error occurred: ' + error.message 
        });
    }
}

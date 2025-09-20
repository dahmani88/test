export default async function handler(req, res) {
    // Standard CORS and method checks
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Get the Manus API key from environment variables
        const manusApiKey = process.env.MANUS_API_KEY;
        if (!manusApiKey) {
            return res.status(500).json({ error: 'MANUS_API_KEY environment variable is not configured.' });
        }

        // 2. Define the task to be delegated to Manus using the request body
        const taskToDelegate = {
            task_name: "Generate E-commerce Product Description",
            input_data: req.body,
            output_format: "A single string containing 3 distinct versions, each separated by '---'."
        };

        // 3. Call the corrected Manus Task Delegation API endpoint
        const manusTaskEndpoint = 'https://api.manus.ai/v1/delegate';
        
        const manusResponse = await fetch(manusTaskEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${manusApiKey}`
            },
            body: JSON.stringify(taskToDelegate )
        });

        // 4. Handle the response from Manus
        const resultData = await manusResponse.json();

        if (!manusResponse.ok) {
            const errorMessage = resultData.error?.message || `Manus API Error: ${manusResponse.status}`;
            return res.status(manusResponse.status).json({ error: errorMessage });
        }

        // 5. Send the successful result back to the frontend
        if (!resultData.output) {
             return res.status(500).json({ error: 'Invalid response format from Manus API.' });
        }
        
        return res.status(200).json({ descriptions: resultData.output });

    } catch (error) {
        console.error('Error in generate API (Manus):', error);
        return res.status(500).json({ error: 'An unexpected server error occurred: ' + error.message });
    }
}

export default async function handler(req, res) {
    // Standard CORS and method checks
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // --- ADVANCED DIAGNOSTICS ---
    let diagnostics = {};

    // Test 1: Check basic network connectivity from Vercel's server
    try {
        await fetch('https://www.google.com' );
        diagnostics.google_connectivity = 'Success';
    } catch (e) {
        diagnostics.google_connectivity = `Failed: ${e.message}`;
    }

    // Test 2: Check DNS resolution for api.manus.ai
    const manusApiUrl = 'https://api.manus.ai/v1/delegate';
    try {
        const url = new URL(manusApiUrl );
        diagnostics.manus_hostname_resolution = `Attempting to resolve: ${url.hostname}`;
    } catch (e) {
        diagnostics.manus_hostname_resolution = `URL parsing failed: ${e.message}`;
    }

    // --- MAIN LOGIC ---
    try {
        const manusApiKey = process.env.MANUS_API_KEY;
        if (!manusApiKey) {
            return res.status(500).json({ 
                error: 'MANUS_API_KEY environment variable is not configured.',
                diagnostics: diagnostics 
            });
        }

        const taskToDelegate = {
            task_name: "Generate E-commerce Product Description",
            input_data: req.body,
            output_format: "A single string containing 3 distinct versions, each separated by '---'."
        };
        
        // Main API call to Manus
        const manusResponse = await fetch(manusApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${manusApiKey}`
            },
            body: JSON.stringify(taskToDelegate)
        });

        diagnostics.manus_response_status = manusResponse.status;
        diagnostics.manus_response_status_text = manusResponse.statusText;

        // This is the critical part. We will read the response as TEXT first.
        const responseText = await manusResponse.text();
        diagnostics.manus_raw_response_body = responseText;

        if (!manusResponse.ok) {
            return res.status(500).json({ 
                error: `Manus API returned a non-OK status.`,
                diagnostics: diagnostics
            });
        }

        // Only try to parse as JSON if the response was OK
        const resultData = JSON.parse(responseText);

        return res.status(200).json({ 
            descriptions: resultData.output,
            diagnostics: diagnostics 
        });

    } catch (error) {
        // Catch any unexpected errors during the process
        return res.status(500).json({ 
            error: 'An unexpected server error occurred in the main logic.',
            error_details: error.message,
            diagnostics: diagnostics
        });
    }
}

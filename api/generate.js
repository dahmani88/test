const jwt = require('jsonwebtoken');

function generateToken(apiKey) {
    try {
        const [id, secret] = apiKey.split('.');
        
        const payload = {
            iss: id,
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
            iat: Math.floor(Date.now() / 1000)
        };
        
        const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
        return token;
    } catch (error) {
        throw new Error('Invalid API key format');
    }
}

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Check if API key exists
        const apiKey = process.env.Z_AI_KEY;
        if (!apiKey) {
            return res.status(500).json({ 
                error: 'Z_AI_KEY environment variable is not configured' 
            });
        }

        // Extract data from request body
        const { 
            productName, 
            features, 
            audience, 
            keywords, 
            tone, 
            language 
        } = req.body;

        // Validate required fields
        if (!productName || !features || !audience || !keywords || !tone || !language) {
            return res.status(400).json({ 
                error: 'All fields are required' 
            });
        }

        // Generate JWT token
        let token;
        try {
            token = generateToken(apiKey);
        } catch (error) {
            return res.status(500).json({ 
                error: 'Failed to generate authentication token: ' + error.message 
            });
        }

        // Construct the master AI prompt
        const prompt = `Act as a world-class e-commerce copywriter and SEO expert. Your task is to write 3 compelling and persuasive product descriptions. The entire output, including titles and all text, MUST be in the following language: ${language}.

**Product Information:**
* Product Name: ${productName}
* Key Features: ${features}
* Target Audience: ${audience}
* SEO Keywords: ${keywords}

**Instructions:**
1. For each of the 3 versions, write a short, catchy title.
2. Write an introductory paragraph that grabs the reader's attention.
3. Use bullet points to turn the key features into customer benefits.
4. Naturally weave the SEO keywords into the description.
5. Write a concluding paragraph that creates a sense of urgency or desire.
6. The tone of voice MUST be: ${tone}.
7. Each version must be clearly separated by "---".`;

        // Call the Z.ai API
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'glm-4.5-flash',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        // Check if the API call was successful
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.error?.message || `Z.ai API error: ${response.status} ${response.statusText}`;
            
            return res.status(500).json({ 
                error: `Failed to generate descriptions: ${errorMessage}` 
            });
        }

        // Parse the response from Z.ai
        const data = await response.json();
        
        // Extract the generated content
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            return res.status(500).json({ 
                error: 'Invalid response format from Z.ai API'
            });
        }

        const generatedContent = data.choices[0].message.content;

        // Send the generated descriptions back to the frontend
        return res.status(200).json({ 
            descriptions: generatedContent,
            usage: data.usage || null
        });

    } catch (error) {
        console.error('Error in generate API:', error);
        
        // Handle specific error types
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.status(500).json({ 
                error: 'Unable to connect to Z.ai API. Please check your internet connection.' 
            });
        }
        
        if (error.name === 'SyntaxError') {
            return res.status(500).json({ 
                error: 'Invalid response from Z.ai API' 
            });
        }

        return res.status(500).json({ 
            error: 'An unexpected error occurred: ' + error.message 
        });
    }
}
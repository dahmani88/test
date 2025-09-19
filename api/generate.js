const jwt = require('jsonwebtoken');

function generateToken(apiKey) {
    try {
        const [id, secret] = apiKey.split('.');
        
        if (!id || !secret) {
            throw new Error('Invalid API key format - missing id or secret');
        }
        
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: id,
            exp: now + 1800, // 30 minutes expiration (shorter than 1 hour)
            iat: now,
            sub: id
        };
        
        // Use the secret part directly as the signing key
        const token = jwt.sign(payload, secret, { 
            algorithm: 'HS256',
            header: {
                alg: 'HS256',
                sign_type: 'SIGN'
            }
        });
        
        return token;
    } catch (error) {
        throw new Error('Invalid API key format: ' + error.message);
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

        // Try different authentication methods
        const authMethods = [
            // Method 1: JWT Bearer token with api_key in payload
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: {
                    model: 'glm-4.5-flash',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2000,
                    api_key: apiKey
                }
            },
            // Method 2: Direct API key in header
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: {
                    model: 'glm-4.5-flash',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2000
                }
            },
            // Method 3: API key in payload only
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                body: {
                    model: 'glm-4.5-flash',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2000,
                    api_key: apiKey
                }
            }
        ];

        let response;
        let lastError;

        // Try each authentication method
        for (const method of authMethods) {
            try {
                response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                    method: 'POST',
                    headers: method.headers,
                    body: JSON.stringify(method.body)
                });

                if (response.ok) {
                    break; // Success! Exit the loop
                }
                
                // Store the error for potential debugging
                const errorText = await response.text();
                lastError = `${response.status}: ${errorText}`;
                
            } catch (error) {
                lastError = error.message;
                continue; // Try next method
            }
        }

        // Check if any method worked
        if (!response || !response.ok) {
            const errorData = await response?.json().catch(() => null);
            const errorMessage = errorData?.error?.message || lastError || `Z.ai API error: ${response?.status} ${response?.statusText}`;
            
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
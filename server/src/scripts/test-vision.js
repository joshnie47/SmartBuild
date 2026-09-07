const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.GROQ_API_KEY;

async function run() {
  const prompt = `You are an expert forensic AI image authenticity detection engine. Analyze this construction/architectural image to determine whether it is an authentic real-world photograph taken with an optical camera on a construction/job site, or an AI-generated/synthetic image (e.g. Midjourney, DALL-E, Stable Diffusion, Flux, Photorealistic 3D render).

Examine closely:
1. Texture realism: Real concrete, brick, drywall, wood grain variance vs synthetic smoothing/hyper-perfection.
2. Lighting & shadows: Physically accurate illumination and shadow geometry vs synthetic soft diffusion / non-physical global illumination.
3. Optical physics: Natural camera sensor grain, chromatic aberration, optical depth-of-field vs AI diffusion model artifacts, warped geometry, or unnatural edge blending.

Return ONLY a valid JSON object matching:
{
  "aiConfidence": <number 0.00 to 1.00 indicating probability of being AI-generated>,
  "authenticityScore": <number 0.00 to 1.00 indicating probability of being real authentic photo>,
  "analysisReason": "<detailed reason>",
  "detectedFeatures": ["<feature 1>", "<feature 2>"]
}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'You are an AI image forensics detector for construction and architectural portfolio photos. Analyze the provided image to determine if it is an authentic real-world camera photograph taken on a construction site/property or an AI-generated image (e.g. Midjourney, Stable Diffusion, DALL-E, 3D synthetic render).\n\nRespond ONLY with a JSON object in this exact format (no markdown fences, no other text):\n{"aiConfidence": <number from 0.00 to 1.00 indicating probability of AI generation>, "authenticityScore": <number from 0.00 to 1.00 indicating probability of authentic real photo>, "analysisReason": "<concise reason explaining visual evidence>", "detectedFeatures": ["<visual marker 1>", "<visual marker 2>"]}',
            },
            {
              type: 'image_url',
              image_url: {
                url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
              },
            },
          ],
        },
      ],
      temperature: 0.0,
      max_tokens: 300,
    }),
  });

  const data = await res.json();
  console.log('Full data:', JSON.stringify(data, null, 2));
  if (data.choices?.[0]?.message?.content) {
    const raw = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    console.log('Cleaned:', raw);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed JSON:', parsed);
    }
  }
}

run().catch(console.error);

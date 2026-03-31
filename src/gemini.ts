import { GoogleGenAI } from "@google/genai";
import { Message, Character } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getChatResponse(
  character: Character,
  history: Message[],
  userInput: string
) {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      })),
      { role: "user", parts: [{ text: userInput }] }
    ],
    config: {
      systemInstruction: `You are ${character.name}. 
      
      [PERSONALITY]
      ${character.personality}
      
      ${character.appearance ? `[APPEARANCE]\n${character.appearance}` : ''}
      ${character.speechStyle ? `[SPEECH STYLE]\n${character.speechStyle}` : ''}
      ${character.scenario ? `[SCENARIO]\n${character.scenario}` : ''}
      ${character.biography ? `[BIOGRAPHY]\n${character.biography}` : ''}
      
      ${character.responseLength === 'short' ? 'Keep your responses very brief and concise (1-2 sentences).' : 
        character.responseLength === 'long' ? 'Provide detailed, descriptive, and long responses.' : 
        'Provide moderately detailed responses.'}
      
      ${character.strictness === 'strict' ? 'Strictly adhere to your defined personality and background. Do not break character under any circumstances.' : 
        character.strictness === 'flexible' ? 'You have some flexibility in your personality. You can adapt to the conversation while maintaining your core identity.' : 
        'Maintain a balanced adherence to your personality.'}
      
      ${character.tone === 'formal' ? 'Maintain a professional, formal, and polite tone.' :
        character.tone === 'casual' ? 'Use a relaxed, informal, and conversational tone.' :
        character.tone === 'humorous' ? 'Be witty, funny, and use humor in your responses.' :
        character.tone === 'dramatic' ? 'Be expressive, intense, and use dramatic language.' :
        'Maintain a natural tone suitable for the character.'}
      
      Stay in character at all times. Use natural, conversational language. 
      Respond to the user's input based on your character's traits, appearance, and current scenario.`,
      temperature: character.creativity === 'low' ? 0.4 : character.creativity === 'high' ? 1.2 : 0.9,
      topP: 0.95,
      topK: 64,
    }
  });

  const response = await model;
  return response.text || "I'm sorry, I couldn't think of a response.";
}

export async function generateCharacterAvatar(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A high-quality, professional avatar for a character. 
            Character Details: ${prompt}. 
            Style: Cinematic, detailed, artistic, 4k.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating avatar:", error);
    return null;
  }
}

export async function generateStory(character: Character, scenario: string) {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [{ 
          text: `Write a short story about ${character.name}. 
          
          [CHARACTER PROFILE]
          Name: ${character.name}
          Personality: ${character.personality}
          ${character.appearance ? `Appearance: ${character.appearance}` : ''}
          ${character.biography ? `Biography: ${character.biography}` : ''}
          
          [SCENARIO]
          ${scenario}
          
          The story should be engaging, maintain the character's personality, and be approximately 500-800 words long. 
          Format the response as a JSON object with 'title' and 'content' fields. 
          The 'content' field should be in Markdown format.` 
        }]
      }
    ],
    config: {
      responseMimeType: "application/json",
    }
  });

  const response = await model;
  try {
    return JSON.parse(response.text || '{"title": "Untitled Story", "content": "Failed to generate story."}');
  } catch (e) {
    console.error("Error parsing story JSON:", e);
    return { title: "Untitled Story", content: response.text || "Failed to generate story." };
  }
}

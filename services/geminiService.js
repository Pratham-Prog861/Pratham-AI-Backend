import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

// Initialize the Google Generative AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generates a response using the Gemini Pro model
 * @param {string} prompt - The user's input prompt
 * @returns {Promise<string>} - The generated response
 */
async function generateResponse(prompt) {
  try {
    // Get the Gemini Pro model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;

    return formatResponse(response.text());
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

/**
 * Generates a chat response using the Gemini Pro model
 * @param {Array} chatHistory - Array of message objects with role and content
 * @returns {Promise<string>} - The generated chat response
 */
async function generateChatResponse(chatHistory) {
  try {
    if (!chatHistory || chatHistory.length === 0) {
      throw new Error('Chat history is empty');
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash', // Update model name
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    // Convert chat history to the format expected by Gemini
    const history = chatHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Start chat with history
    const chat = model.startChat({
      history: history.slice(0, -1) // exclude the last message
    });

    // Get the last user message
    const lastMessage = chatHistory[chatHistory.length - 1];

    // Generate response
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to generate response from Gemini');
  }
}

function formatResponse(text) {
  return text
    .replace(/#+\s*/g, '')  // Remove headings
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
    .replace(/\*(.*?)\*/g, '$1')      // Remove italics
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')  // Remove code blocks
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')   // Remove links but keep the text
    .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines
    .trim();
}

export { generateResponse, generateChatResponse };
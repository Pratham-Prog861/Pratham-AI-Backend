import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

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

// Initialize the Google Generative AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use a valid model name
const MODEL_NAME = 'gemini-2.0-flash'; 

/**
 * Generates a response using the Gemini Pro model
 * @param {string} prompt - The user's input prompt
 * @returns {Promise<string>} - The generated response
 */
async function generateResponse(prompt) {
  try {
    // Get the Gemini Pro model
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

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
      model: MODEL_NAME, // Update model name
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    // Convert chat history to the format expected by Gemini
    const history = chatHistory.slice(0, -1).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const lastMessage = chatHistory[chatHistory.length - 1];
    const lastUserMessage = lastMessage.content;
    
    try {
      let result;
      if (history.length > 0) {
        const chat = model.startChat({
          history: history,
        });
        result = await chat.sendMessage(lastUserMessage);
      } else {
        result = await model.generateContent(lastUserMessage);
      }
      
      const response = await result.response;
      return formatResponse(response.text());
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error('Failed to generate response from Gemini');
    }
  } catch (error) {
    console.error('Error in chat generation:', error);
    throw error;
  }
}

export { generateResponse, generateChatResponse };
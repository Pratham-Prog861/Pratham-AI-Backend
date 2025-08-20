import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { generateChatResponse } from "./services/geminiService.js";
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Data storage directory
const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

// Helper function to get user data file path
const getUserDataPath = (username) => path.join(DATA_DIR, `${username}.json`);

// Helper function to read user data
const getUserData = (username) => {
    const filePath = getUserDataPath(username);
    const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : { username, chats: [] };
    return data;
};

// Helper function to save user data
const saveUserData = (username, data) => {
    const filePath = getUserDataPath(username);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// API Routes

// Login/Get user data
app.post("/api/login", async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: "Username is required" });
    }

    const userData = getUserData(username);
    res.json(userData);
});

// Get all chats for a user
app.get("/api/chats/:username", (req, res) => {
    const { username } = req.params;
    const userData = getUserData(username);
    res.json(userData.chats);
});

// Create a new chat
app.post("/api/chats/:username", async (req, res) => {
    try {
        const { username } = req.params;
        const userData = getUserData(username);

        if (!userData) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const newChat = {
            id: Date.now().toString(),
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString()
        };

        userData.chats.unshift(newChat);
        saveUserData(username, userData);

        res.json(newChat);
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({
            message: 'Failed to create chat'
        });
    }
});

// Send a message in a chat
app.post("/api/chats/:username/:chatId/messages", async (req, res) => {
    const { username, chatId } = req.params;
    const { content } = req.body;

    try {
        // Input validation
        if (!content?.trim()) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        // Get user data
        const userData = getUserData(username);
        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        const chat = userData.chats.find(c => c.id === chatId);

        // Update chat title if this is the first message
        if (chat.messages.length === 0) {
            // Create a short title from the first message
            chat.title = content.length > 30
                ? content.substring(0, 30) + '...'
                : content;
        }

        const userMessage = {
            id: Date.now().toString(),
            content: content.trim(),
            sender: 'user',
            timestamp: new Date().toISOString()
        };

        // Add user message to chat
        chat.messages.push(userMessage);

        // Generate AI response
        const aiResponseContent = await generateChatResponse([...chat.messages]);

        // Create AI message
        const aiMessage = {
            id: (Date.now() + 1).toString(),
            content: aiResponseContent,
            sender: 'ai',
            timestamp: new Date().toISOString()
        };

        // Add AI message to chat
        chat.messages.push(aiMessage);

        // Save updated chat with new title and messages
        saveUserData(username, userData);

        // Send both messages back to client
        res.json({
            userMessage,
            aiResponse: aiMessage,
            chatTitle: chat.title // Send back updated title
        });
    } catch (error) {
        console.error('Message handling error:', error);
        res.status(500).json({
            message: 'Failed to process message',
            error: error.message
        });
    }
});

// Delete a chat
app.delete("/api/chats/:username/:chatId", (req, res) => {
    const { username, chatId } = req.params;
    const userData = getUserData(username);

    userData.chats = userData.chats.filter(chat => chat.id !== chatId);
    saveUserData(username, userData);

    res.json({ success: true });
});

// Delete all chats
app.delete("/api/chats/:username", (req, res) => {
    const { username } = req.params;
    const userData = getUserData(username);

    userData.chats = [];
    saveUserData(username, userData);

    res.json({ success: true });
});

// Modify AI response with actions
app.post("/api/chats/:username/:chatId/actions", async (req, res) => {
    const { username, chatId } = req.params;
    const { messageId, action } = req.body;

    try {
        if (!messageId || !action) {
            return res.status(400).json({ error: "messageId and action are required" });
        }

        const userData = getUserData(username);
        const chat = userData.chats.find(c => c.id === chatId);

        if (!chat) {
            return res.status(404).json({ error: "Chat not found" });
        }

        const message = chat.messages.find(m => m.id === messageId && m.sender === "ai");

        if (!message) {
            return res.status(404).json({ error: "AI message not found" });
        }

        let prompt = '';
        if (action === "concise") {
            prompt = `Make this response more concise while keeping the main points:\n\n${message.content}`;
        } else if (action === "expand") {
            prompt = `Expand on this response with more details and examples:\n\n${message.content}`;
        } else {
            return res.status(400).json({ error: "Invalid action. Use 'concise' or 'expand'." });
        }

        // Generate new content using Gemini
        const newContent = await generateChatResponse([{
            sender: 'user',
            content: prompt
        }]);

        // Update the message content
        message.content = newContent;
        message.timestamp = new Date().toISOString(); // Update timestamp

        // Save the updated data
        saveUserData(username, userData);

        // Return the updated message
        res.json({ message });

    } catch (error) {
        console.error('Error in actions endpoint:', error);
        res.status(500).json({
            error: "Failed to process action",
            details: error.message
        });
    }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

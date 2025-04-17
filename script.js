document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messageList = document.getElementById('message-list');
    const newChatButton = document.getElementById('new-chat-btn');
    const chatHistoryList = document.getElementById('chat-history-list');

    // --- Configuration ---
    const WEBHOOK_URL = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';
    const LOCAL_STORAGE_KEY = 'chatHistory'; // Key for storing history

    // --- State ---
    let chatHistory = {}; // { chatId: { id: '...', title: '...', messages: [...], createdAt: ..., lastUpdated: ... }, ... }
    let currentChatId = null; // Stores the ID of the currently active chat
    let nextChatId = 1; // Simple counter for new chat IDs

    // --- Initialization ---
    loadChatHistory(); // Load history from localStorage
    if (Object.keys(chatHistory).length === 0) {
        startNewChat(); // Start with a new chat if history is empty
    } else {
        // Load the most recent chat based on lastUpdated timestamp
        const sortedChatIds = Object.keys(chatHistory).sort((a, b) => {
             const timeA = chatHistory[a]?.lastUpdated || 0;
             const timeB = chatHistory[b]?.lastUpdated || 0;
             return timeB - timeA; // Descending order (newest first)
         });
        loadChat(sortedChatIds[0]); // Load the most recently updated chat
    }
    // Note: updateHistoryListUI is called implicitly via other functions that modify history

    setupInputAutosize(); // Enable auto-resizing for the textarea

    // --- Event Listeners ---
    sendButton.addEventListener('click', handleSendMessage); // Send on button click
    messageInput.addEventListener('keydown', (e) => {
        // Send on Enter key press (if Shift is not held)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent newline in textarea
            handleSendMessage();
        }
    });
    newChatButton.addEventListener('click', startNewChat); // Start a new chat session
    chatHistoryList.addEventListener('click', (e) => {
        // Load a chat session when a history item is clicked
        if (e.target && e.target.tagName === 'LI') {
            const chatId = e.target.dataset.chatId;
            if (chatId && chatId !== currentChatId) {
                loadChat(chatId);
            }
        }
    });

    // --- Core Functions ---

    /**
     * Handles sending the user's message:
     * 1. Displays the message in the UI.
     * 2. Saves the message to history.
     * 3. Clears the input and shows a typing indicator.
     * 4. Sends the message to the webhook.
     * 5. Handles the webhook response.
     */
    function handleSendMessage() {
        const messageText = messageInput.value.trim();
        // Don't send empty messages or if no chat is active
        if (!messageText || !currentChatId) return;

        // 1. Display User Message
        addMessageToUI(messageText, 'user');

        // 2. Save User Message to History
        saveMessageToHistory(currentChatId, {
            sender: 'user',
            content: messageText,
            type: 'text',
            timestamp: Date.now()
        });

        // 3. Clear Input & Show Typing Indicator
        messageInput.value = '';
        messageInput.style.height = 'auto'; // Reset textarea height
        addTypingIndicator();

        // 4. Send to Webhook
        fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add any other headers your webhook might require (e.g., Authorization)
            },
            // Send 'chatInput' and 'sessionId' as expected by the webhook
            // Use the frontend's currentChatId as the sessionId for backend tracking
            body: JSON.stringify({
                chatInput: messageText,    // User's message text
                sessionId: currentChatId   // ID of the current chat session
            })
        })
        .then(response => {
            // Handle HTTP errors (e.g., 4xx, 5xx)
            if (!response.ok) {
                // Try to get more error details from the response body
                return response.text().then(text => {
                     throw new Error(`HTTP error ${response.status}: ${text || response.statusText}`);
                });
            }
            // Parse the JSON response body
            return response.json();
        })
        .then(data => {
            // Successfully received response from webhook
            removeTypingIndicator();

            // --- Process Webhook Response ---
            // Check various possible structures for the response data
            let responseData = null;
            if (data && (data.type || data.content || data.config)) {
                // Standard expected format: { type: '...', content: '...', config: {...} }
                responseData = data;
            } else if (data && data.output && typeof data.output === 'object' && (data.output.type || data.output.content || data.output.config)) {
                 // Fallback: Check if standard format is nested under 'output'
                 responseData = data.output;
            } else if (data && data.output && typeof data.output === 'string') {
                 // Fallback: Simple text response under 'output': { output: "text" }
                 responseData = { type: 'text', content: data.output };
            } else if (typeof data === 'string') {
                 // Fallback: Response is just a plain string
                 responseData = { type: 'text', content: data };
            }

            // If we successfully extracted response data with content or chart config
            if (responseData && (responseData.content || responseData.config)) {
                 const botMessage = {
                    sender: 'bot',
                    content: responseData.content || null, // Text content (can be null for chart-only)
                    type: responseData.type || 'text',     // 'text' or 'chart'
                    config: responseData.config || null,   // Chart.js config object
                    timestamp: Date.now()
                 };
                 // Add the bot message to the UI
                 addMessageToUI(botMessage.content, 'bot', botMessage.type, botMessage.config);
                 // Save the bot message to history
                 saveMessageToHistory(currentChatId, botMessage);

                 // Update chat title if it's the first proper exchange in a new chat
                 const currentChat = chatHistory[currentChatId];
                 // Check if title is still the default and it's the first bot response
                 if (currentChat && currentChat.messages.length <= 2 && currentChat.title === `Chat ${currentChatId}`) {
                    updateChatTitle(currentChatId, messageText); // Use user's first message for title
                 }
            } else {
                 // Handle cases where the response format is not recognized
                 console.error("Invalid or unexpected response format from webhook:", data);
                 const errorMessage = "Sorry, I received an unexpected response format.";
                 addMessageToUI(errorMessage, 'bot');
                 saveMessageToHistory(currentChatId, { sender: 'bot', content: errorMessage, type:'text', timestamp: Date.now() });
            }
        })
        .catch(error => {
            // Handle network errors or errors during fetch/processing
            removeTypingIndicator();
            console.error('Error fetching or processing webhook response:', error);
            const errorMessage = `Sorry, an error occurred: ${error.message}`;
            addMessageToUI(errorMessage, 'bot');
             saveMessageToHistory(currentChatId, { sender: 'bot', content: errorMessage, type:'text', timestamp: Date.now() });
        });
    }

    /**
     * Adds a message bubble to the chat interface (UI only).
     * @param {string | null} content - The text content of the message.
     * @param {'user' | 'bot'} sender - Who sent the message.
     * @param {'text' | 'chart'} type - The type of message content.
     * @param {object | null} chartConfig - The Chart.js configuration object if type is 'chart'.
     */
    function addMessageToUI(content, sender, type = 'text', chartConfig = null) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender); // Add 'message' and 'user'/'bot' classes

        if (type === 'text') {
            // Handle simple text messages
            if (content) {
                 messageElement.textContent = content;
             } else {
                 // Display placeholder if text content is unexpectedly empty/null
                 messageElement.textContent = sender === 'bot' ? "[Empty message received]" : "[Empty user message]";
                 console.warn("Attempted to add empty text message:", {sender, content});
             }

        } else if (type === 'chart' && chartConfig) {
            // Handle chart messages
            const chartContainer = document.createElement('div');
            chartContainer.classList.add('chart-container');
            const canvas = document.createElement('canvas');
            // Give canvas a unique ID for potential debugging
            canvas.id = `chart-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            chartContainer.appendChild(canvas);

            // Add optional text content *before* the chart, if provided
            if (content) {
                 const textElement = document.createElement('p');
                 textElement.textContent = content;
                 messageElement.appendChild(textElement);
            }

             messageElement.appendChild(chartContainer); // Add chart container (potentially after text)

            // Render the chart using Chart.js
            // Use setTimeout to ensure the canvas element is fully added to the DOM
            setTimeout(() => {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    try {
                        // Create the new Chart instance
                        new Chart(ctx, chartConfig);
                    } catch (error) {
                        // Handle errors during chart instantiation
                        console.error(`Error rendering chart on ${canvas.id}:`, error, "Config was:", chartConfig);
                        const errorElement = document.createElement('p');
                        errorElement.textContent = "[Error displaying chart]";
                        errorElement.style.color = 'red';
                        chartContainer.innerHTML = ''; // Clear the container
                        chartContainer.appendChild(errorElement); // Show error in UI
                    }
                } else {
                    // Handle case where canvas context couldn't be obtained
                    console.error(`Could not get 2D context for canvas ${canvas.id}`);
                     const errorElement = document.createElement('p');
                     errorElement.textContent = "[Error initializing chart canvas]";
                     errorElement.style.color = 'red';
                     chartContainer.innerHTML = '';
                     chartContainer.appendChild(errorElement);
                }
            }, 0); // End of setTimeout

        } else {
            // Handle unsupported types or missing data
             messageElement.textContent = content || `[Unsupported message type: ${type}]`;
             console.warn("Unhandled message type or missing data:", {sender, type, content, chartConfig});
        }

        messageList.appendChild(messageElement); // Add the message element to the list
        scrollToBottom(); // Scroll down to show the new message
    }

    /**
     * Adds a temporary "..." typing indicator to the chat UI.
     */
    function addTypingIndicator() {
        removeTypingIndicator(); // Ensure only one indicator exists
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message', 'bot', 'typing-indicator');
        typingIndicator.setAttribute('id', 'typingIndicator'); // ID for easy removal
        typingIndicator.textContent = '...'; // Indicator text
        messageList.appendChild(typingIndicator);
        scrollToBottom();
    }

    /**
     * Removes the typing indicator from the chat UI.
     */
    function removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // --- Chat History Management ---

    /**
     * Saves the entire chat history object to localStorage.
     */
    function saveChatHistory() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(chatHistory));
            updateHistoryListUI(); // Update sidebar UI after saving
        } catch (e) {
            console.error("Failed to save chat history to localStorage:", e);
            // Consider notifying the user if storage fails (e.g., quota exceeded)
        }
    }

    /**
     * Loads chat history from localStorage into the `chatHistory` object.
     */
    function loadChatHistory() {
        const savedHistory = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedHistory) {
            try {
                chatHistory = JSON.parse(savedHistory);
                // Optional: Ensure messages within each chat are sorted by timestamp
                Object.values(chatHistory).forEach(chat => {
                    if (chat && Array.isArray(chat.messages)) {
                         chat.messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    } else {
                         // Handle potential data corruption if needed
                         console.warn("Invalid chat structure found in history:", chat);
                    }
                });

                // Calculate the next chat ID based on the highest existing numeric ID
                const maxId = Object.keys(chatHistory)
                                .map(id => parseInt(id, 10)) // Convert keys to numbers
                                .filter(id => !isNaN(id))    // Ignore non-numeric keys
                                .reduce((max, id) => Math.max(max, id), 0); // Find max ID
                nextChatId = maxId + 1;

            } catch (e) {
                // Handle errors parsing stored JSON (e.g., corrupted data)
                console.error("Failed to parse chat history from localStorage:", e);
                chatHistory = {}; // Reset history
                nextChatId = 1;
                localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
            }
        } else {
            // No history found in localStorage
            chatHistory = {};
            nextChatId = 1;
        }
    }

    /**
     * Adds a single message object to the history of a specific chat session.
     * @param {string} chatId - The ID of the chat session.
     * @param {object} messageData - The message object to save.
     */
    function saveMessageToHistory(chatId, messageData) {
        if (chatHistory[chatId]) {
            // Ensure the message has a timestamp for ordering
            if (!messageData.timestamp) {
                messageData.timestamp = Date.now();
            }
            chatHistory[chatId].messages.push(messageData);
            // Update the chat's last updated time
            chatHistory[chatId].lastUpdated = messageData.timestamp;
            saveChatHistory(); // Persist changes to localStorage
        } else {
            // Should not happen in normal operation if chat exists
            console.warn("Attempted to save message to non-existent chat ID:", chatId);
        }
    }

     /**
      * Updates the title of a chat session, typically based on the first user message.
      * @param {string} chatId - The ID of the chat to update.
      * @param {string} firstUserMessage - The text of the user's first message.
      */
     function updateChatTitle(chatId, firstUserMessage) {
        if (chatHistory[chatId]) {
            // Create a short title, trim whitespace, avoid empty titles
            const potentialTitle = firstUserMessage.trim().substring(0, 35); // Max 35 chars
            // Use the generated title, or fallback to default if message was empty
            chatHistory[chatId].title = potentialTitle.length > 0
                ? potentialTitle + (firstUserMessage.trim().length > 35 ? '...' : '') // Add ellipsis if truncated
                : `Chat ${chatId}`; // Fallback title
            saveChatHistory(); // Save changes (will also update UI list)
        }
    }

    /**
     * Creates a new chat session, saves it, and loads it into the UI.
     */
    function startNewChat() {
        currentChatId = nextChatId.toString(); // Assign the next available ID
        nextChatId++; // Increment the counter for the future

        const now = Date.now();
        // Create the new chat entry in our history object
        chatHistory[currentChatId] = {
            id: currentChatId,
            title: `Chat ${currentChatId}`, // Default title, updated after first exchange
            messages: [],                   // Start with empty messages array
            createdAt: now,                 // Record creation time
            lastUpdated: now                // Initialize last updated time
        };

        // Optional: Add an initial bot message to the new chat
        const initialBotMessage = {
            sender: 'bot',
            content: 'New chat started. How can I assist you?',
            type: 'text',
            timestamp: now + 1 // Ensure timestamp is distinct
        };
        chatHistory[currentChatId].messages.push(initialBotMessage);
        chatHistory[currentChatId].lastUpdated = initialBotMessage.timestamp;

        saveChatHistory(); // Save the newly created chat session
        loadChat(currentChatId); // Load the new chat into the main view
        messageInput.focus(); // Automatically focus the input field
    }

    /**
     * Loads the messages of a specific chat session into the main chat UI.
     * @param {string} chatId - The ID of the chat to load.
     */
    function loadChat(chatId) {
        // Check if the requested chat exists in our history
        if (!chatHistory[chatId]) {
            console.error("Attempted to load non-existent chat:", chatId);
            // Fallback: try loading the most recent valid chat or start anew
             const sortedIds = Object.keys(chatHistory).sort((a, b) => (chatHistory[b]?.lastUpdated || 0) - (chatHistory[a]?.lastUpdated || 0));
             if (sortedIds.length > 0) {
                 loadChat(sortedIds[0]); // Load most recent valid chat
             } else {
                 startNewChat(); // Or start fresh if no valid chats exist
             }
            return; // Stop execution for the original invalid chatId
        }

        // Set the current chat ID
        currentChatId = chatId;
        messageList.innerHTML = ''; // Clear the existing messages from the UI

        const chat = chatHistory[chatId];
        // Add messages from the loaded chat's history to the UI
        if (chat && Array.isArray(chat.messages)) {
             chat.messages.forEach(msg => {
                addMessageToUI(msg.content, msg.sender, msg.type, msg.config);
            });
        }

        updateHistoryListUI(); // Update the sidebar to highlight the active chat
        scrollToBottom(); // Ensure the view is scrolled to the latest message
        // Optional: Focus input? Maybe not needed when clicking history.
        // messageInput.focus();
    }

    /**
     * Updates the list of recent chats displayed in the sidebar UI.
     */
    function updateHistoryListUI() {
        chatHistoryList.innerHTML = ''; // Clear the current list in the UI

        // Get chat IDs and sort them by last updated time (newest first)
        const sortedChatIds = Object.keys(chatHistory).sort((a, b) => {
            const timeA = chatHistory[a]?.lastUpdated || chatHistory[a]?.createdAt || 0;
            const timeB = chatHistory[b]?.lastUpdated || chatHistory[b]?.createdAt || 0;
            return timeB - timeA; // Descending order
        });

        // Create list items for each chat
        sortedChatIds.forEach(chatId => {
            const chat = chatHistory[chatId];
            if (!chat) return; // Skip if chat data is somehow invalid

            const listItem = document.createElement('li');
            listItem.textContent = chat.title || `Chat ${chatId}`; // Display title or default
            listItem.dataset.chatId = chatId; // Store chat ID for click events
            listItem.title = chat.title || `Chat ${chatId}`; // Set tooltip for full title view

            // Highlight the currently active chat
            if (chatId === currentChatId) {
                listItem.classList.add('active');
            }
            chatHistoryList.appendChild(listItem); // Add the item to the sidebar list
        });
    }

    // --- Utility Functions ---

    /**
     * Sets up the message input textarea to automatically resize with content.
     */
    function setupInputAutosize() {
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto'; // Reset height to recalculate scrollHeight
            // Set height based on content, up to a maximum limit
            const maxHeight = 120; // Max height in pixels (adjust as needed)
            const scrollHeight = messageInput.scrollHeight;
            messageInput.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        });
     }

     /**
      * Scrolls the message list container to the bottom.
      */
     function scrollToBottom() {
        // Use smooth scrolling for a nicer effect
        messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
        // Fallback for older browsers (or if smooth scrolling is not desired):
        // messageList.scrollTop = messageList.scrollHeight;
    }

}); // End of DOMContentLoaded listener

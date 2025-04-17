document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesContainer = document.getElementById('messagesContainer');
    const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';

    // --- Local Storage Chat History ---

    // Function to save the chat history to Local Storage
    function saveChatHistory(history) {
        localStorage.setItem('chatHistory', JSON.stringify(history));
    }

    // Function to load the chat history from Local Storage
    function loadChatHistory() {
        const storedHistory = localStorage.getItem('chatHistory');
        return storedHistory ? JSON.parse(storedHistory) : [];
    }

    // Initialize chat history from Local Storage
    let chatHistory = loadChatHistory();

    // --- End Local Storage Chat History ---

    function createMessageElement(content, sender = 'bot') {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', sender);

        const avatar = document.createElement('div');
        avatar.classList.add('avatar', sender);
        messageEl.appendChild(avatar);

        if (sender === 'bot') {
            messageEl.innerHTML += marked.parse(content); // Append content after avatar
        } else {
            messageEl.innerHTML += content; // Append content after avatar
        }

        const timestamp = document.createElement('div');
        timestamp.classList.add('timestamp');
        timestamp.textContent = new Date().toLocaleTimeString();

        messageEl.appendChild(timestamp);
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // --- Save message to chat history ---
        const message = { sender: sender, content: content, timestamp: new Date().toLocaleTimeString() };
        chatHistory.push(message);
        saveChatHistory(chatHistory);
        // --- End Save message to chat history ---

        return messageEl;
    }

    function showLoading() {
        const loadingEl = document.createElement('div');
        loadingEl.classList.add('message', 'bot', 'loading');
        loadingEl.setAttribute('id', 'loadingMessage');

        const avatar = document.createElement('div');
        avatar.classList.add('avatar', 'bot');
        loadingEl.appendChild(avatar);

        loadingEl.innerHTML += 'Thinking...';
        messagesContainer.appendChild(loadingEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function hideLoading() {
        const loadingEl = document.getElementById('loadingMessage');
        if (loadingEl) loadingEl.remove();
    }

    function createChartMessageWithOverlay(thumbnailSrc, fullChartSrc, chartDescription = '') {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', 'bot');

        const avatar = document.createElement('div');
        avatar.classList.add('avatar', 'bot');
        messageEl.appendChild(avatar);

        const thumbnail = document.createElement('img');
        thumbnail.src = thumbnailSrc;
        thumbnail.classList.add('chart-thumbnail');
        messageEl.appendChild(thumbnail);

        const overlay = document.createElement('div');
        overlay.classList.add('chart-overlay');
        const fullChart = document.createElement('img');
        fullChart.src = fullChartSrc;
        overlay.appendChild(fullChart);
        const closeButton = document.createElement('span');
        closeButton.classList.add('chart-close-button');
        closeButton.textContent = 'x';
        overlay.appendChild(closeButton);

        if (chartDescription) {
            const description = document.createElement('p');
            description.textContent = chartDescription;
            overlay.appendChild(description);
        }

        messageEl.appendChild(overlay);

        thumbnail.addEventListener('click', () => {
            overlay.style.display = 'flex'; // Use flex for centering
        });

        closeButton.addEventListener('click', () => {
            overlay.style.display = 'none';
        });

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) { // Close only if clicking outside the chart
                overlay.style.display = 'none';
            }
        });

        // --- Save message to chat history ---
        const message = {
            sender: 'bot',
            content: `<img src="${thumbnailSrc}" alt="Chart Thumbnail">`, // Store thumbnail URL
            timestamp: new Date().toLocaleTimeString()
        };
        chatHistory.push(message);
        saveChatHistory(chatHistory);
        // --- End Save message to chat history ---

        return messageEl;
    }

    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (!message) return;

        // Add user message
        createMessageElement(message, 'user');
        messageInput.value = '';

        // Show loading animation
        showLoading();

        // Send message to webhook
        fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chatInput: message,
                sessionId: sessionId
            }),
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            if (data.output) {
                // Check if the output is a chart
                if (data.output.chartThumbnail && data.output.chartFull) {
                    const chartMessage = createChartMessageWithOverlay(
                        data.output.chartThumbnail,
                        data.output.chartFull,
                        data.output.chartDescription // Optional
                    );
                    messagesContainer.appendChild(chartMessage);
                } else {
                    createMessageElement(data.output, 'bot'); // Normal text message
                }
            } else {
                createMessageElement('No response received.', 'bot');
            }
        })
        .catch(err => {
            console.error('Error:', err);
            hideLoading();
            createMessageElement('Something went wrong.', 'bot');
        });
    });

    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });

    // --- Display saved chat history on page load ---
    chatHistory.forEach(message => {
        createMessageElement(message.content, message.sender);
    });
    // --- End Display saved chat history on page load ---
});

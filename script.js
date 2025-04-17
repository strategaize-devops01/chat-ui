document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesContainer = document.getElementById('messagesContainer');
    const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';

    // Generate or retrieve a persistent session ID
    const sessionId = localStorage.getItem('chatSessionId') || (() => {
        const newId = crypto.randomUUID?.() || Date.now().toString();
        localStorage.setItem('chatSessionId', newId);
        return newId;
    })();

    // Load and save chat history
    const loadChatHistory = () => JSON.parse(localStorage.getItem('chatHistory') || '[]');
    const saveChatHistory = (history) => localStorage.setItem('chatHistory', JSON.stringify(history));
    let chatHistory = loadChatHistory();

    // Utility to scroll to the bottom
    const scrollToBottom = () => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    function createMessageElement(content, sender = 'bot') {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', sender);

        const avatar = document.createElement('div');
        avatar.classList.add('avatar', sender);
        messageEl.appendChild(avatar);

        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('content');
        contentWrapper.innerHTML = sender === 'bot' ? marked.parse(content) : content;
        messageEl.appendChild(contentWrapper);

        const timestamp = document.createElement('div');
        timestamp.classList.add('timestamp');
        timestamp.textContent = new Date().toLocaleTimeString();
        messageEl.appendChild(timestamp);

        messagesContainer.appendChild(messageEl);
        scrollToBottom();

        chatHistory.push({ sender, content, timestamp: new Date().toLocaleTimeString() });
        saveChatHistory(chatHistory);
    }

    function showLoading() {
        const loading = document.createElement('div');
        loading.classList.add('message', 'bot', 'loading');
        loading.setAttribute('id', 'loadingMessage');

        const avatar = document.createElement('div');
        avatar.classList.add('avatar', 'bot');
        loading.appendChild(avatar);

        const dots = document.createElement('div');
        dots.textContent = 'Thinking...';
        loading.appendChild(dots);

        messagesContainer.appendChild(loading);
        scrollToBottom();
    }

    function hideLoading() {
        const loadingEl = document.getElementById('loadingMessage');
        if (loadingEl) loadingEl.remove();
    }

    function createChartMessageWithOverlay(thumbnailSrc, fullSrc, description = '') {
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

        const fullImg = document.createElement('img');
        fullImg.src = fullSrc;
        overlay.appendChild(fullImg);

        if (description) {
            const desc = document.createElement('p');
            desc.textContent = description;
            overlay.appendChild(desc);
        }

        const closeBtn = document.createElement('span');
        closeBtn.classList.add('chart-close-button');
        closeBtn.textContent = '×';
        overlay.appendChild(closeBtn);

        closeBtn.addEventListener('click', () => overlay.style.display = 'none');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });

        thumbnail.addEventListener('click', () => {
            overlay.style.display = 'flex';
        });

        messageEl.appendChild(overlay);
        messagesContainer.appendChild(messageEl);
        scrollToBottom();

        chatHistory.push({
            sender: 'bot',
            content: `<img src="${thumbnailSrc}" />`,
            timestamp: new Date().toLocaleTimeString()
        });
        saveChatHistory(chatHistory);
    }

    function sendMessage(message) {
        createMessageElement(message, 'user');
        showLoading();

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatInput: message, sessionId })
        })
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (!data || !data.output) {
                createMessageElement('No response received.', 'bot');
                return;
            }

            // Check if it's a chart object with images
            if (typeof data.output === 'object' && data.output.chartThumbnail) {
                createChartMessageWithOverlay(
                    data.output.chartThumbnail,
                    data.output.chartFull,
                    data.output.chartDescription || ''
                );
            } else {
                createMessageElement(data.output, 'bot');
            }
        })
        .catch(err => {
            hideLoading();
            console.error(err);
            createMessageElement('Something went wrong.', 'bot');
        });
    }

    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (!message) return;
        messageInput.value = '';
        sendMessage(message);
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendButton.click();
    });

    // Load chat history on page load
    chatHistory.forEach(m => createMessageElement(m.content, m.sender));
});

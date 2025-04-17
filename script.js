document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesContainer = document.getElementById('messagesContainer');
    const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';

    const sessionId = localStorage.getItem('chatSessionId') || (() => {
        const newId = crypto.randomUUID?.() || Date.now().toString();
        localStorage.setItem('chatSessionId', newId);
        return newId;
    })();

    const loadChatHistory = () => JSON.parse(localStorage.getItem('chatHistory') || '[]');
    const saveChatHistory = (history) => localStorage.setItem('chatHistory', JSON.stringify(history));
    let chatHistory = loadChatHistory();

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

    // If it's ONLY a chart with no description, apply cleaner layout
    const isChartOnly = !description?.trim();
    if (isChartOnly) {
        messageEl.classList.add('chart-only');
    }

    // Avatar
    const avatar = document.createElement('div');
    avatar.classList.add('avatar', 'bot');
    if (!isChartOnly) messageEl.appendChild(avatar); // Hide avatar for chart-only

    // Thumbnail image
    const thumbnail = document.createElement('img');
    thumbnail.src = thumbnailSrc;
    thumbnail.classList.add('chart-thumbnail');
    messageEl.appendChild(thumbnail);

    // Chart overlay (click to zoom)
    const overlay = document.createElement('div');
    overlay.classList.add('chart-overlay');

    const fullImg = document.createElement('img');
    fullImg.src = fullSrc;
    overlay.appendChild(fullImg);

    // Optional description
    if (!isChartOnly && description) {
        const desc = document.createElement('p');
        desc.textContent = description;
        overlay.appendChild(desc);
    }

    // Close button
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

    // Save to history
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

    chatHistory.forEach(m => createMessageElement(m.content, m.sender));
});

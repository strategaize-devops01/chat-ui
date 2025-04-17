document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesContainer = document.getElementById('messagesContainer');
    const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';
    let sessionId = localStorage.getItem('chatSessionId') || generateSessionId();

    localStorage.setItem('chatSessionId', sessionId);

    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (!message) return;

        appendMessage('user', message);
        messageInput.value = '';
        showLoading();

        fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatInput: message, sessionId }),
        })
        .then(res => res.json())
        .then(data => {
            removeLoading();
            appendMessage('bot', data.output || 'No response');
        })
        .catch(() => {
            removeLoading();
            appendMessage('bot', '❌ Error getting response.');
        });
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendButton.click();
    });

    function generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }

    function appendMessage(sender, text) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-bubble ${sender}`;
        wrapper.innerHTML = `
            <div class="message-text">${text}</div>
            <div class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        messagesContainer.appendChild(wrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function showLoading() {
        const loader = document.createElement('div');
        loader.className = 'message-bubble bot loading';
        loader.id = 'loadingBubble';
        loader.innerHTML = `
            <div class="dot-flashing"></div>
        `;
        messagesContainer.appendChild(loader);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function removeLoading() {
        const loader = document.getElementById('loadingBubble');
        if (loader) loader.remove();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const chatContainer = document.querySelector('.chat-container');
    const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';

    // Session ID persistence
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('sessionId', sessionId);
    }

    const addMessageBubble = (text, sender = 'user') => {
        const bubble = document.createElement('div');
        bubble.classList.add('chat-bubble', sender);
        bubble.innerText = text;
        chatContainer.insertBefore(bubble, document.querySelector('.input-area'));
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    const showLoading = () => {
        const loader = document.createElement('div');
        loader.classList.add('chat-bubble', 'bot', 'loading');
        loader.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        chatContainer.insertBefore(loader, document.querySelector('.input-area'));
        return loader;
    };

    const removeLoading = (loader) => {
        if (loader && loader.parentNode) {
            loader.parentNode.removeChild(loader);
        }
    };

    const sendMessage = () => {
        const message = messageInput.value.trim();
        if (!message) return;

        addMessageBubble(message, 'user');
        messageInput.value = '';

        const loader = showLoading();

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatInput: message,
                sessionId: sessionId
            })
        })
        .then(response => response.json())
        .then(data => {
            removeLoading(loader);
            const reply = data.message || data.response || JSON.stringify(data);
            addMessageBubble(reply, 'bot');
        })
        .catch(error => {
            removeLoading(loader);
            console.error('Error:', error);
            addMessageBubble('Error sending message.', 'bot');
        });
    };

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', event => {
        if (event.key === 'Enter') sendMessage();
    });
});

document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const chatLog = document.getElementById('chatLog');
  const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';

  function appendMessage(text, sender) {
    const msg = document.createElement('div');
    msg.classList.add('message', sender);
    msg.innerHTML = text;
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function setLoading() {
    appendMessage('Thinking...', 'bot');
    return chatLog.lastChild;
  }

  sendButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (!message) return;

    appendMessage(message, 'user');
    const loadingEl = setLoading();
    messageInput.value = '';

    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    })
    .then(response => response.text())
    .then(data => {
      chatLog.removeChild(loadingEl);
      if (data.startsWith('https://quickchart.io/chart')) {
        appendMessage(`<img src="${data}" alt="Chart" style="max-width: 100%;">`, 'bot');
      } else {
        appendMessage(data, 'bot');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      chatLog.removeChild(loadingEl);
      appendMessage('Oops! Something went wrong.', 'bot');
    });
  });

  messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      sendButton.click();
    }
  });
});

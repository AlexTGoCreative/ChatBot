const [chatHistory, setChatHistory] = useState([
  {
    hideInChat: true,
    role: "model",
    text: companyInfo,
  },
]); App.jsx line 10


generateBotResponse([...chatHistory, { role: "user", text: `Using the details provided above, please address this query: ${userMessage}` }]);

ChatForm.jsx
const API_URL = 'http://localhost:5000';

export const api = {
  login: async (credentials) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }
    
    return response.json();
  },

  register: async (userData) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }
    
    return response.json();
  },

  // Helper function to get headers with auth token
  getHeaders: () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  },

  // Chat history endpoints
  getChatHistory: async () => {
    const response = await fetch(`${API_URL}/chat-history`, {
      method: 'GET',
      headers: api.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch chat history');
    }

    return response.json();
  },

  saveChatHistory: async (historyData) => {
    const response = await fetch(`${API_URL}/chat-history`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify(historyData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save chat history');
    }

    return response.json();
  },

  deleteChatHistory: async () => {
    const response = await fetch(`${API_URL}/chat-history`, {
      method: 'DELETE',
      headers: api.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete chat history');
    }

    return response.json();
  },
}; 
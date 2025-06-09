import axios from 'axios';

const API_URL = import.meta.env.VITE_API2_URL;

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

export const api = {
  login: async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, credentials, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  },

  register: async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, userData, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  },

  getChatHistory: async () => {
    try {
      const response = await axios.get(`${API_URL}/chat-history`, {
        headers: getHeaders()
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch chat history');
    }
  },

  saveChatHistory: async (historyData) => {
    try {
      const chatId = historyData.chatId;
      let response;
      
      if (chatId) {
        response = await axios.put(`${API_URL}/chat-history/${chatId}`, historyData, {
          headers: getHeaders()
        });
      } else {
        response = await axios.post(`${API_URL}/chat-history`, historyData, {
          headers: getHeaders()
        });
      }
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to save chat history');
    }
  },

  deleteChatHistory: async () => {
    try {
      const response = await axios.delete(`${API_URL}/chat-history`, {
        headers: getHeaders()
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to delete chat history');
    }
  },

  getScanHistory: async () => {
    try {
      const response = await axios.get(`${API_URL}/scan-history`, {
        headers: getHeaders()
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch scan history');
    }
  },

  saveScanHistory: async (scanData) => {
    try {
      const response = await axios.post(`${API_URL}/scan-history`, scanData, {
        headers: getHeaders()
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to save scan history');
    }
  },

  deleteScanHistory: async () => {
    try {
      const response = await axios.delete(`${API_URL}/scan-history`, {
        headers: getHeaders()
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to clear scan history');
    }
  },

  getScanData: async (dataId) => {
    try {
      const response = await axios.get(`${API_URL}/scan/${dataId}`, {
        headers: getHeaders()
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch scan data');
    }
  },

  getSandboxData: async (sha1) => {
    try {
      const response = await axios.get(`${API_URL}/sandbox/${sha1}`, {
        headers: getHeaders()
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch sandbox data');
    }
  },

  getUrlScanData: async (encodedUrl) => {
    try {
      const response = await axios.get(`${API_URL}/scan-url-direct?encodedUrl=${encodedUrl}`, {
        headers: getHeaders()
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch URL scan data');
    }
  }
}; 
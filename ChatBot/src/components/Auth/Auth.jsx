import { useState, useEffect } from 'react';
import Login from './Login';
import Register from './Register';

const Auth = ({ onAuthSuccess }) => {
  const [view, setView] = useState('login');
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      onAuthSuccess({ token, user: JSON.parse(user) });
    }
  }, [onAuthSuccess]);

  const handleAuth = (data) => {
    if (data.view) {
      setView(data.view);
    } else {
      onAuthSuccess(data);
    }
  };

  return view === 'login' ? (
    <Login onLogin={handleAuth} />
  ) : (
    <Register onRegister={handleAuth} />
  );
};

export default Auth; 
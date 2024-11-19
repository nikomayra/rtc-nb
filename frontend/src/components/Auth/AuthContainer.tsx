import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export const AuthContainer = () => {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <div className='auth-container'>
      <div className='auth-toggle'>
        <button
          onClick={() => setShowLogin(true)}
          className={showLogin ? 'active' : ''}
        >
          Login
        </button>
        <button
          onClick={() => setShowLogin(false)}
          className={!showLogin ? 'active' : ''}
        >
          Register
        </button>
      </div>
      {showLogin ? <LoginForm /> : <RegisterForm />}
    </div>
  );
};

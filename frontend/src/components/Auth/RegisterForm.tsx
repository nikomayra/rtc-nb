import React, { useState } from 'react';
import { useAuthContext } from '../../hooks/useAuthContext';

export const RegisterForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const {
    actions: { register },
  } = useAuthContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await register(username, password);
  };

  return (
    <form className='auth-form' onSubmit={handleSubmit}>
      <h2>Register</h2>
      <input
        type='text'
        placeholder='Username'
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type='password'
        placeholder='Password'
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type='submit'>Register</button>
    </form>
  );
};

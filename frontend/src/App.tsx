import { useState } from 'react';
import axios from 'axios';
import './App.css';

const BASE_URL: string = '/api';

function App() {
  const [username, setUsername] = useState<string>('username');
  const [password, setPassword] = useState<string>('password');

  const axiosClass = new Axios();

  const registerUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const resData = await axiosClass.register(username, password);
    console.log(`Server Response: ${resData}`);
  };

  return (
    <>
      <form onSubmit={registerUser}>
        <input
          defaultValue={username}
          onChange={(e) => setUsername(e.target.value)}
        ></input>
        <input
          defaultValue={password}
          onChange={(e) => setPassword(e.target.value)}
          type='password'
        ></input>
        <button>Submit</button>
      </form>
    </>
  );
}

class Axios {
  async register(username: string, password: string) {
    console.log('Registering user...');
    const data = {
      username: username,
      password: password,
    };
    const res = await axios.post(`${BASE_URL}/register`, data);
    return res.data;
  }
}

export default App;

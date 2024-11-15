import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import './App.css';
import { z } from 'zod';

const BASE_URL: string = '/api';

// Define the schema once
const ChannelSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.string(),
  users: z.array(z.string()),
  admins: z.array(z.string()),
});

// Type is automatically inferred from the schema
type Channel = z.infer<typeof ChannelSchema>;

interface Message {
  id: string;
  username: string;
  content: { text: string };
  timestamp: string;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: number;
  };
}

function App() {
  // Auth states
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [token, setToken] = useState<string>('');

  // UI states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentChannel, setCurrentChannel] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [channels, setChannels] = useState<Channel[]>([]);

  // Channel creation states
  const [newChannelName, setNewChannelName] = useState<string>('');
  const [newChannelDesc, setNewChannelDesc] = useState<string>('');
  const [showCreateChannel, setShowCreateChannel] = useState<boolean>(false);

  const axiosClass = useMemo(() => new Axios(), []);

  useEffect(() => {
    if (token && currentChannel) {
      const connectWs = async () => {
        const ws = await axiosClass.connectWebSocket(token);
        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          setMessages((prev) => [...prev, message]);
        };
      };
      connectWs();
    }
  }, [token, currentChannel, axiosClass]);

  useEffect(() => {
    if (token) {
      const fetchChannels = async () => {
        try {
          const response = await axiosClass.getChannels(token);
          if (response.success && response.data) {
            setChannels(response.data);
          } else {
            console.error('Failed to fetch channels:', response.error?.message);
          }
        } catch (error) {
          console.error('Failed to fetch channels:', error);
        }
      };
      fetchChannels();
    }
  }, [token, axiosClass]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axiosClass.register(username, password);
      if (response.success && response.data) {
        setToken(response.data.token);
        setIsLoggedIn(true);
      } else {
        console.error('Registration failed:', response.error?.message);
      }
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axiosClass.login(username, password);
      if (response.success && response.data) {
        setToken(response.data.token);
        setIsLoggedIn(true);
      } else {
        console.error('Login failed:', response.error?.message);
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axiosClass.createChannel(
        newChannelName,
        newChannelDesc,
        token
      );

      if (response.success && response.data) {
        const channel = ChannelSchema.parse(response.data);

        setShowCreateChannel(false);
        setNewChannelName('');
        setNewChannelDesc('');
        setChannels((prevChannels) => [...prevChannels, channel]);
      } else {
        console.error('Channel creation failed:', response.error?.message);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Invalid channel data:', error.errors);
      } else {
        console.error(
          'Channel creation failed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  };

  const handleJoinChannel = async (channelName: string) => {
    try {
      const response = await axiosClass.joinChannel(channelName, token);
      if (response.success) {
        setCurrentChannel(channelName);
      } else {
        console.error('Failed to join channel:', response.error?.message);
      }
    } catch (error) {
      console.error('Failed to join channel:', error);
    }
  };

  const isUserAdmin = (channel: Channel, username: string): boolean => {
    return channel.admins.includes(username);
  };

  if (!isLoggedIn) {
    return (
      <div className='auth-container'>
        <form onSubmit={handleRegister} className='auth-form'>
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
        <form onSubmit={handleLogin} className='auth-form'>
          <h2>Login</h2>
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
          <button type='submit'>Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className='app-container'>
      <div className='channels-container'>
        {channels.map((channel) => (
          <button
            key={channel.name}
            onClick={() => handleJoinChannel(channel.name)}
            className={
              isUserAdmin(channel, username) ? 'admin-channel' : 'channel'
            }
          >
            {channel.name}
            {isUserAdmin(channel, username) && (
              <span className='admin-badge'>Admin</span>
            )}
          </button>
        ))}
        {showCreateChannel && (
          <form onSubmit={handleCreateChannel} className='create-channel-form'>
            <h2>Create Channel</h2>
            <input
              type='text'
              placeholder='Channel Name'
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
            />
            <input
              type='text'
              placeholder='Description'
              value={newChannelDesc}
              onChange={(e) => setNewChannelDesc(e.target.value)}
            />
            <button type='submit'>Create Channel</button>
          </form>
        )}
        <button onClick={() => setShowCreateChannel(true)}>
          Create Channel
        </button>
      </div>
      <div className='messages-container'>
        {messages.map((message) => (
          <div key={message.id} className='message'>
            <span className='username'>{message.username}:</span>
            <span className='content'>{message.content.text}</span>
            <span className='timestamp'>{message.timestamp}</span>
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            axiosClass.sendMessage(currentChannel, newMessage, token);
            setNewMessage('');
          }}
          className='send-message-form'
        >
          <input
            type='text'
            placeholder='Type your message...'
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type='submit'>Send</button>
        </form>
      </div>
    </div>
  );
}

class Axios {
  async register(
    username: string,
    password: string
  ): Promise<APIResponse<{ token: string; username: string }>> {
    const data = {
      username: username,
      password: password,
    };
    const res = await axios.post(`${BASE_URL}/register`, data);
    return res.data;
  }

  async login(
    username: string,
    password: string
  ): Promise<APIResponse<{ token: string; username: string }>> {
    const data = {
      username: username,
      password: password,
    };
    const res = await axios.post(`${BASE_URL}/login`, data);
    return res.data;
  }

  async createChannel(
    channelName: string,
    description: string,
    token: string
  ): Promise<APIResponse<Channel>> {
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    const data = {
      channelName: channelName,
      channelDescription: description,
    };
    const res = await axios.post(`${BASE_URL}/createchannel`, data, {
      headers,
    });
    return res.data;
  }

  async joinChannel(
    channelName: string,
    token: string
  ): Promise<APIResponse<void>> {
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    const data = {
      channelName: channelName,
      channelPassword: null,
    };
    const res = await axios.post(`${BASE_URL}/joinchannel`, data, { headers });
    return res.data;
  }

  async connectWebSocket(token: string): Promise<WebSocket> {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${BASE_URL}/ws`;

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ token }));
    };

    return ws;
  }

  async sendMessage(channelName: string, text: string, token: string) {
    const ws = await this.connectWebSocket(token);
    const message = {
      channelName: channelName,
      type: 0, // MessageTypeText
      text: text,
    };
    ws.send(JSON.stringify(message));
  }

  async getChannels(token: string): Promise<APIResponse<Channel[]>> {
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    const res = await axios.get(`${BASE_URL}/channels`, { headers });
    return res.data;
  }
}

export default App;

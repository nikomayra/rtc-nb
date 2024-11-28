import { Channel, IncomingMessage } from './interfaces';

// State interface
export interface ChatState {
  channels: Channel[];
  currentChannel: string | null;
  messages: Record<string, IncomingMessage[]>;
  isConnected: boolean;
}

// Action types - using discriminated union
export type ChatAction =
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_CHANNELS'; payload: Channel[] }
  | { type: 'ADD_CHANNEL'; payload: Channel }
  | { type: 'SET_CURRENT_CHANNEL'; payload: string | null }
  | { type: 'DELETE_CHANNEL'; payload: string } // channelName
  | { type: 'ADD_MESSAGE'; payload: IncomingMessage }
  | { type: 'INITIALIZE_CHANNEL_MESSAGES'; payload: { channelName: string } };

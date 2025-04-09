import { createContext, Dispatch, SetStateAction } from "react";
import { ChannelMember, IncomingMessage } from "../types/interfaces";

export interface EnhancedChannelMember extends ChannelMember {
  isOnline: boolean;
}

export interface ChannelContext {
  state: {
    messages: IncomingMessage[];
    members: EnhancedChannelMember[];
  };
  actions: {
    setMessages: Dispatch<SetStateAction<IncomingMessage[]>>;
    setMembers: Dispatch<SetStateAction<EnhancedChannelMember[]>>;
    updateMemberOnlineStatus: (username: string, isOnline: boolean) => void;
    uploadFile: (file: File) => Promise<{ imagePath: string; thumbnailPath: string } | null>;
  };
}

export const ChannelContext = createContext<ChannelContext | null>(null);

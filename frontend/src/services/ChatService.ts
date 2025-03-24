import { chatApi } from "../api/chatApi";
import { IncomingMessage, Channel } from "../types/interfaces";

export class ChatService {
  private static instance: ChatService;
  private cachedChannels: Channel[] | null = null;
  private channelMessagesCache: Record<string, IncomingMessage[]> = {};

  private constructor() {}

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  // Channel operations
  public async fetchChannels(token: string, forceRefresh = false): Promise<Channel[]> {
    if (this.cachedChannels && !forceRefresh) {
      return this.cachedChannels;
    }

    const channels = await chatApi.fetchChannels(token);
    this.cachedChannels = channels;
    return channels;
  }

  public async createChannel(
    channelName: string,
    token: string,
    description?: string,
    password?: string
  ): Promise<void> {
    await chatApi.createChannel(channelName, token, description, password);
    this.cachedChannels = null; // Invalidate cache
  }

  public async deleteChannel(channelName: string, token: string): Promise<void> {
    await chatApi.deleteChannel(channelName, token);
    this.cachedChannels = null; // Invalidate cache
  }

  public async joinChannel(
    channelName: string,
    token: string,
    password?: string
  ): Promise<{ onlineUsers: string[]; isFirstJoin: boolean }> {
    return await chatApi.joinChannel(channelName, token, password);
  }

  public async leaveChannel(channelName: string, token: string): Promise<void> {
    await chatApi.leaveChannel(channelName, token);
  }

  // Member operations
  public async updateMemberRole(channelName: string, username: string, token: string, isAdmin: boolean): Promise<void> {
    await chatApi.updateMemberRole(channelName, username, token, isAdmin);
    this.cachedChannels = null; // Invalidate cache
  }

  // Message operations
  public async fetchMessages(channelName: string, token: string, forceRefresh = false): Promise<IncomingMessage[]> {
    if (this.channelMessagesCache[channelName] && !forceRefresh) {
      return this.channelMessagesCache[channelName];
    }

    const messages = await chatApi.fetchMessages(channelName, token);
    this.channelMessagesCache[channelName] = messages;
    return messages;
  }

  // File operations
  public async uploadFile(formData: FormData, token: string): Promise<{ imagePath: string; thumbnailPath: string }> {
    return chatApi.uploadFile(formData, token);
  }

  // Cache management
  public clearChannelCache(): void {
    this.cachedChannels = null;
  }

  public clearMessageCache(channelName?: string): void {
    if (channelName) {
      delete this.channelMessagesCache[channelName];
    } else {
      this.channelMessagesCache = {};
    }
  }

  public clearAllCaches(): void {
    this.cachedChannels = null;
    this.channelMessagesCache = {};
  }
}

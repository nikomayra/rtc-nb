import { useCallback, useState, useEffect, useRef } from "react";
import { useAuthContext } from "./useAuthContext";
import { useContext } from "react";
import { WebSocketContext } from "../contexts/webSocketContext";
import { useNotification } from "./useNotification";
import { ChatService } from "../services/ChatService";
import { WebSocketService } from "../services/WebsocketService";
import {
  Channel,
  IncomingMessage,
  OutgoingMessage,
  MessageType,
  ChannelUpdateAction,
  MemberUpdateAction,
} from "../types/interfaces";

// Debug flag - set to true to enable performance logging
const DEBUG_PERFORMANCE = false;

// Cooldown time in milliseconds
const RATE_LIMIT_COOLDOWN = 60000; // 1 minute to match backend

export function useChat() {
  const {
    state: { token, username },
  } = useAuthContext();

  // Get the websocket context
  const wsContext = useContext(WebSocketContext);
  if (!wsContext) {
    throw new Error("useChat must be used within a WebSocketProvider");
  }

  const { showError, showSuccess, showWarning } = useNotification();

  // Create ChatService instance
  const chatService = useRef(ChatService.getInstance());

  // State
  const [currentChannel, setCurrentChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, IncomingMessage[]>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, Error | null>>({});
  const [onlineUsers, setOnlineUsers] = useState<Record<string, Set<string>>>({});

  // Refs for tracking state
  const rateLimitedUntilRef = useRef<number>(0);
  const channelsFetchedRef = useRef(false);
  const messagesFetchedRef = useRef<Record<string, boolean>>({});

  // Simple global rate limit check
  const isRateLimited = useCallback((): boolean => {
    return Date.now() < rateLimitedUntilRef.current;
  }, []);

  // Mark as rate limited
  const markRateLimited = useCallback(() => {
    rateLimitedUntilRef.current = Date.now() + RATE_LIMIT_COOLDOWN;
    console.log(`Rate limited, cooling down for ${RATE_LIMIT_COOLDOWN}ms`);
  }, []);

  // API wrapper to handle loading states, errors and rate limiting
  const executeApiCall = useCallback(
    async <T>(apiOperation: string, apiCall: () => Promise<T>, onSuccess?: (result: T) => void): Promise<T | null> => {
      if (isRateLimited()) {
        console.log(`Rate limited, skipping ${apiOperation}`);
        showWarning("Too many requests. Please wait a moment before trying again.");
        return null;
      }

      // Add a small timeout before showing loading state to prevent flicker
      const loadingTimerId = setTimeout(() => {
        setIsLoading(true);
      }, 150); // Short delay before showing loading state

      setErrors((prev) => ({ ...prev, [apiOperation]: null }));

      // Track performance if debug enabled
      const startTime = DEBUG_PERFORMANCE ? performance.now() : 0;

      try {
        const result = await apiCall();

        // Log performance metrics if debug enabled
        if (DEBUG_PERFORMANCE) {
          const endTime = performance.now();
          console.log(`[PERF] ${apiOperation} took ${Math.round(endTime - startTime)}ms`);
        }

        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        console.error(`Error in ${apiOperation}:`, error);

        if (
          error &&
          typeof error === "object" &&
          "response" in error &&
          error.response &&
          typeof error.response === "object" &&
          "status" in error.response
        ) {
          if (error.response.status === 429) {
            markRateLimited();
            showWarning("Too many requests. Please wait a moment before trying again.");
          } else {
            // Extract error message from response if available
            const errorMessage =
              (error.response &&
              "data" in error.response &&
              typeof error.response.data === "object" &&
              error.response.data
                ? (error.response.data as { message?: string; error?: string }).message ||
                  (error.response.data as { message?: string; error?: string }).error
                : null) || `Failed to ${apiOperation.replace(/([A-Z])/g, " $1").toLowerCase()}. Please try again.`;
            console.error(errorMessage);
            showError(`Failed to ${apiOperation.replace(/([A-Z])/g, " $1").toLowerCase()}. Please try again.`);
          }
        } else {
          // Generic error message based on the operation
          showError(`Failed to ${apiOperation.replace(/([A-Z])/g, " $1").toLowerCase()}. Please try again.`);
        }

        const errorObj = error instanceof Error ? error : new Error(String(error));
        setErrors((prev) => ({ ...prev, [apiOperation]: errorObj }));
        return null;
      } finally {
        clearTimeout(loadingTimerId); // Clear the timeout
        setIsLoading(false);
      }
    },
    [isRateLimited, markRateLimited, showError, showWarning]
  );

  // Action functions
  const fetchMessages = useCallback(
    async (channelName: string) => {
      if (!token) return [];

      // Check if we already fetched messages for this channel
      if (messagesFetchedRef.current[channelName]) {
        console.log(`Already fetched messages for ${channelName}, using cached data`);
        return messages[channelName] || [];
      }

      const result = await executeApiCall(
        "fetchMessages",
        () => chatService.current.fetchMessages(channelName, token),
        (fetchedMessages) => {
          setMessages((prev) => ({
            ...prev,
            [channelName]: fetchedMessages,
          }));
          messagesFetchedRef.current[channelName] = true;
        }
      );

      return result || messages[channelName] || [];
    },
    [token, executeApiCall, messages]
  );

  const fetchChannels = useCallback(async () => {
    if (!token) return null;

    // If we already fetched channels, return the cached data
    if (channelsFetchedRef.current) {
      console.log("Using cached channels data");
      return channels;
    }

    const result = await executeApiCall(
      "fetchChannels",
      () => chatService.current.fetchChannels(token),
      (fetchedChannels) => {
        setChannels(fetchedChannels);
        channelsFetchedRef.current = true;
      }
    );

    return result || null;
  }, [token, executeApiCall, channels]);

  // Handle user status updates
  const handleUserStatus = useCallback((message: IncomingMessage) => {
    if (!message.content.userStatus) return;

    const { channelName } = message;
    const { username, action } = message.content.userStatus;

    console.log(`🟢 User status update: ${username} is ${action} in ${channelName}`);

    setOnlineUsers((prev) => {
      const channelUsers = new Set(prev[channelName] || []);

      if (action === "online") {
        channelUsers.add(username);
      } else if (action === "offline") {
        channelUsers.delete(username);
      }

      // Create a new Set to ensure state update
      const newChannelUsers = new Set(channelUsers);

      // Log the current online users for this channel
      console.log(`Online users in ${channelName}:`, Array.from(newChannelUsers));

      return {
        ...prev,
        [channelName]: newChannelUsers,
      };
    });

    // Also add as a chat message
    setMessages((prev) => {
      const channelMessages = [...(prev[channelName] || [])];
      if (!channelMessages.some((m) => m.id === message.id)) {
        channelMessages.push(message);
      }
      return {
        ...prev,
        [channelName]: channelMessages,
      };
    });
  }, []);

  // WebSocket message handling
  const handleMessage = useCallback(
    (message: IncomingMessage) => {
      console.log(`handleMessage received: ${MessageType[message.type]} message from ${message.username}`);

      // Skip sketch messages - they're handled by sketch hook
      if (message.type === MessageType.Sketch) {
        return;
      }

      // Handle user status messages
      if (message.type === MessageType.UserStatus) {
        handleUserStatus(message);
        return;
      }

      setMessages((prev) => {
        // Check if we've already processed this message
        if (prev[message.channelName]?.some((m) => m.id === message.id)) {
          console.log(`Duplicate message ${message.id}, skipping`);
          return prev;
        }

        console.log(`Adding message to channel ${message.channelName}`);
        return {
          ...prev,
          [message.channelName]: [...(prev[message.channelName] || []), message],
        };
      });
    },
    [handleUserStatus]
  );

  const handleChannelUpdate = useCallback(
    (message: IncomingMessage) => {
      if (message.type !== MessageType.ChannelUpdate || !message.content.channelUpdate) return;

      const update = message.content.channelUpdate;
      const actionType = update.action.toLowerCase();

      if (actionType === ChannelUpdateAction.Created.toLowerCase()) {
        setChannels((prev) => {
          // Check if channel with this name already exists
          const exists = prev.some((c) => c.name.toLowerCase() === update.channel.name.toLowerCase());
          if (exists) {
            // Replace the existing channel with the updated one
            return prev.map((c) => (c.name.toLowerCase() === update.channel.name.toLowerCase() ? update.channel : c));
          } else {
            // Add the new channel
            return [...prev, update.channel];
          }
        });
      } else if (actionType === ChannelUpdateAction.Deleted.toLowerCase()) {
        setChannels((prev) => prev.filter((c) => c.name !== update.channel.name));

        if (currentChannel === update.channel.name) {
          setCurrentChannel(null);
          sessionStorage.removeItem("currentChannel");

          // Clear message fetch status for this channel
          if (messagesFetchedRef.current[update.channel.name]) {
            delete messagesFetchedRef.current[update.channel.name];
          }
        }

        // Clear any messages for this channel
        setMessages((prev) => {
          const newMessages = { ...prev };
          delete newMessages[update.channel.name];
          return newMessages;
        });
      }
    },
    [currentChannel]
  );

  const handleMemberUpdate = useCallback(
    (message: IncomingMessage) => {
      if (!message.content.memberUpdate) return;

      const update = message.content.memberUpdate;

      setChannels((prev) => {
        return prev.map((channel) => {
          if (channel.name === message.channelName) {
            // Make a clean copy of members
            const currentMembers = { ...channel.members };

            // We'll use a consistent lowercase key for member lookup
            const memberLookupKey = update.username.toLowerCase();

            // Find the actual key in the members object (which might have different casing)
            const actualMemberKey = Object.keys(currentMembers).find((key) => key.toLowerCase() === memberLookupKey);

            switch (update.action) {
              case MemberUpdateAction.Added:
                // Always use the username as provided for the key to maintain consistency
                currentMembers[update.username] = {
                  username: update.username,
                  isAdmin: update.isAdmin,
                  joinedAt: new Date().toISOString(),
                };
                break;

              case MemberUpdateAction.RoleChanged:
                if (actualMemberKey) {
                  // Update the member's admin status
                  currentMembers[actualMemberKey].isAdmin = update.isAdmin;
                }
                break;
            }

            return {
              ...channel,
              members: currentMembers,
            };
          }
          return channel;
        });
      });

      // Update the messages state
      handleMessage(message);
    },
    [handleMessage]
  );

  const createChannel = useCallback(
    async (channelName: string, description?: string, password?: string) => {
      if (!token) return false;

      const success = await executeApiCall(
        "createChannel",
        () => chatService.current.createChannel(channelName, token, description, password).then(() => true),
        async () => {
          showSuccess(`Channel "${channelName}" created successfully`);

          // Refresh channels to get the new one
          channelsFetchedRef.current = false;
          const updatedChannels = await chatService.current.fetchChannels(token, true);
          setChannels(updatedChannels);

          // Find the new channel
          const newChannel = updatedChannels.find((c) => c.name.toLowerCase() === channelName.toLowerCase());

          if (newChannel) {
            // Broadcast to other clients
            wsContext.actions.send({
              type: MessageType.ChannelUpdate,
              channelName,
              content: {
                channelUpdate: {
                  action: ChannelUpdateAction.Created,
                  channel: newChannel,
                },
              },
            });
          }
        }
      );

      return Boolean(success);
    },
    [token, executeApiCall, showSuccess, wsContext.actions]
  );

  const deleteChannel = useCallback(
    async (channelName: string) => {
      if (!token) return false;

      const targetChannel = channels.find((c) => c.name === channelName);
      if (!targetChannel) return false;

      const success = await executeApiCall(
        "deleteChannel",
        () => chatService.current.deleteChannel(channelName, token).then(() => true),
        () => {
          // If we're in the deleted channel, reset current channel
          if (currentChannel === channelName) {
            setCurrentChannel(null);
            sessionStorage.removeItem("currentChannel");
            wsContext.actions.disconnectChannel();
          }

          // Filter out the deleted channel
          setChannels((prev) => prev.filter((c) => c.name !== channelName));

          // Broadcast to other clients
          wsContext.actions.send({
            type: MessageType.ChannelUpdate,
            channelName: channelName,
            content: {
              channelUpdate: {
                action: ChannelUpdateAction.Deleted,
                channel: targetChannel,
              },
            },
          });

          showSuccess(`Channel "${channelName}" deleted successfully`);
        }
      );

      return Boolean(success);
    },
    [token, channels, executeApiCall, currentChannel, wsContext.actions, showSuccess]
  );

  const leaveChannel = useCallback(
    async (channelName: string) => {
      if (!token || channelName !== currentChannel) return false;

      // Send offline status before leaving
      if (wsContext.state.channelConnected) {
        wsContext.actions.send({
          type: MessageType.UserStatus,
          channelName,
          content: {
            userStatus: {
              action: "offline",
              username: username!,
            },
          },
        });
      }

      const success = await executeApiCall(
        "leaveChannel",
        () => chatService.current.leaveChannel(channelName, token).then(() => true),
        () => {
          setCurrentChannel(null);
          sessionStorage.removeItem("currentChannel");

          wsContext.actions.disconnectChannel();

          // Clear message fetch status
          if (messagesFetchedRef.current[channelName]) {
            delete messagesFetchedRef.current[channelName];
          }
        }
      );

      return Boolean(success);
    },
    [token, currentChannel, wsContext.state.channelConnected, wsContext.actions, executeApiCall, username]
  );

  const joinChannel = useCallback(
    async (channelName: string, password?: string) => {
      if (!token) return false;
      if (channelName === currentChannel) return true;

      // Track connection state in sessionStorage
      const wasConnected = sessionStorage.getItem("wasConnectedToChannel") === channelName;

      // Leave current channel if any
      if (currentChannel) {
        const success = await leaveChannel(currentChannel);
        if (!success) return false;
      }

      const success = await executeApiCall(
        "joinChannel",
        () =>
          chatService.current.joinChannel(channelName, token, password).then((response) => {
            // Initialize onlineUsers for this channel with server data plus current user
            setOnlineUsers((prev) => ({
              ...prev,
              [channelName]: new Set([username!, ...response.onlineUsers]),
            }));
            return { success: true, isFirstJoin: response.isFirstJoin };
          }),
        () => {
          setCurrentChannel(channelName);
          sessionStorage.setItem("currentChannel", channelName);

          // Reset message fetch status for this channel
          messagesFetchedRef.current[channelName] = false;
        }
      );

      if (success?.success) {
        // Store the isFirstJoin flag
        const isFirstJoin = success.isFirstJoin;

        // Establish WebSocket connection to the channel
        wsContext.actions.connectChannel(token, channelName);

        // Wait for WebSocket connection to be established
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = 200;

        // Get direct access to the WebSocketService
        const wsService = WebSocketService.getInstance();

        while (attempts < maxAttempts) {
          // Check both the context state AND the direct service state
          if (wsContext.state.channelConnected || wsService.isChannelConnected) {
            // If either shows we're connected, we're good
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, checkInterval));
          attempts++;
        }

        // When we get here, either:
        // 1. We've connected (wsContext.state.channelConnected or wsService.isChannelConnected is true)
        // 2. We've timed out (reached maxAttempts)

        if (wsContext.state.channelConnected || wsService.isChannelConnected) {
          // Only send online status if this is a new session connection, not a refresh
          if (!wasConnected) {
            wsContext.actions.send({
              type: MessageType.UserStatus,
              channelName,
              content: {
                userStatus: {
                  action: "online",
                  username: username!,
                },
              },
            });

            // Mark that we've connected to this channel in this session
            sessionStorage.setItem("wasConnectedToChannel", channelName);
          }

          // Only send the MemberUpdate message if this is the user's first join
          if (isFirstJoin) {
            wsContext.actions.send({
              type: MessageType.MemberUpdate,
              channelName,
              content: {
                memberUpdate: {
                  action: MemberUpdateAction.Added,
                  username: username!,
                  isAdmin: false,
                },
              },
            });
          }

          return true;
        }

        // We timed out and couldn't detect a connection
        console.error("WebSocket connection not established after maximum attempts");
        showError("Failed to join channel. Please try again.");
        return false;
      }

      return Boolean(success);
    },
    [token, currentChannel, executeApiCall, leaveChannel, username, wsContext.actions, wsContext.state, showError]
  );

  const updateMemberRole = useCallback(
    async (channelName: string, memberUsername: string, isAdmin: boolean) => {
      if (!token) return false;

      const success = await executeApiCall(
        "updateMemberRole",
        () => chatService.current.updateMemberRole(channelName, memberUsername, token, isAdmin).then(() => true),
        () => {
          // Broadcast to other clients
          wsContext.actions.send({
            type: MessageType.MemberUpdate,
            channelName,
            content: {
              memberUpdate: {
                action: MemberUpdateAction.RoleChanged,
                username: memberUsername,
                isAdmin,
              },
            },
          });
        }
      );

      return Boolean(success);
    },
    [token, wsContext.actions, executeApiCall]
  );

  const uploadFile = useCallback(
    async (channelName: string, file: File, messageText: string = "") => {
      if (!token || !channelName) return false;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("channelName", channelName);

      console.log("Form data:", formData);
      console.log("file:", file);

      const uploadResult = await executeApiCall(
        "uploadFile",
        () => chatService.current.uploadFile(formData, token),
        (result) => {
          // Send message with file attachment
          const outgoingMessage: OutgoingMessage = {
            type: MessageType.Image,
            channelName,
            content: {
              text: messageText,
              fileUrl: result.imagePath,
              thumbnailUrl: result.thumbnailPath,
            },
          };

          wsContext.actions.send(outgoingMessage);
        }
      );

      return Boolean(uploadResult);
    },
    [token, wsContext.actions, executeApiCall]
  );

  const sendMessage = useCallback(
    (message: OutgoingMessage) => {
      wsContext.actions.send(message);
    },
    [wsContext.actions]
  );

  // Setup WebSocket message handlers
  useEffect(() => {
    if (DEBUG_PERFORMANCE) {
      console.log("🔄 [useChat] Message handlers effect triggered with deps:", {
        handleMessage: handleMessage.toString().slice(0, 50) + "...",
        handleChannelUpdate: handleChannelUpdate.toString().slice(0, 50) + "...",
        handleMemberUpdate: handleMemberUpdate.toString().slice(0, 50) + "...",
        wsActions: Object.keys(wsContext.actions),
      });
    }

    const handlers = {
      onChatMessage: handleMessage,
      onChannelUpdate: handleChannelUpdate,
      onMemberUpdate: handleMemberUpdate,
    };

    wsContext.actions.setMessageHandlers(handlers);
    if (DEBUG_PERFORMANCE) console.log("Handlers registered:", handlers);

    return () => {
      if (DEBUG_PERFORMANCE) console.log("🧹 [useChat] Cleaning up message handlers");
      wsContext.actions.setMessageHandlers({});
    };
  }, [handleMessage, handleChannelUpdate, handleMemberUpdate, wsContext.actions]);

  // STEP 1: Connect to system socket when token is available
  useEffect(() => {
    if (token && !wsContext.state.systemConnected) {
      wsContext.actions.connectSystem(token);
    }
  }, [token, wsContext.state.systemConnected, wsContext.actions]);

  // STEP 2: Fetch channels after system connection is established
  useEffect(() => {
    if (!token || !wsContext.state.systemConnected) return;

    if (channels.length === 0 && !channelsFetchedRef.current) {
      fetchChannels().catch((error) => {
        console.error("Error fetching channels:", error);
        showError("Failed to fetch channels. Please try again.");
      });
    }
  }, [token, wsContext.state.systemConnected, fetchChannels, channels.length, showError]);

  // STEP 3: Restore saved channel if available
  useEffect(() => {
    if (!token || !wsContext.state.systemConnected || channels.length === 0) return;
    if (currentChannel) return; // Skip if already in a channel

    const storedChannel = sessionStorage.getItem("currentChannel");
    if (storedChannel && channels.some((c) => c.name === storedChannel)) {
      joinChannel(storedChannel).catch((error) => {
        console.error(`Error joining saved channel ${storedChannel}:`, error);
        showError("Failed to rejoin channel. Please try again.");
        sessionStorage.removeItem("currentChannel");
      });
    }
  }, [token, wsContext.state.systemConnected, channels, currentChannel, joinChannel, showError]);

  // STEP 4: Fetch messages when connected to a channel
  useEffect(() => {
    if (!token || !currentChannel || !wsContext.state.channelConnected) return;

    if (!messagesFetchedRef.current[currentChannel]) {
      fetchMessages(currentChannel).catch((error) => {
        console.error(`Error fetching messages for ${currentChannel}:`, error);
        showError("Failed to fetch messages. Please try again.");
      });
    }
  }, [token, currentChannel, wsContext.state.channelConnected, fetchMessages, showError]);

  // Update useEffect for WebSocket disconnection
  useEffect(() => {
    return () => {
      // Clean up WebSocket connection on component unmount
      if (wsContext.state.channelConnected) {
        const channelName = currentChannel;
        if (channelName) {
          wsContext.actions.send({
            type: MessageType.UserStatus,
            channelName,
            content: {
              userStatus: {
                action: "offline",
                username: username!,
              },
            },
          });
        }
        wsContext.actions.disconnectChannel();
      }
      // Don't clear the sessionStorage here - we want it to persist on refresh
    };
  }, [currentChannel, username, wsContext]);

  return {
    state: {
      messages,
      channels,
      currentChannel,
      isLoading,
      errors,
      connectionState: {
        systemConnected: wsContext.state.systemConnected,
        channelConnected: wsContext.state.channelConnected,
      },
      onlineUsers,
    },
    actions: {
      sendMessage,
      joinChannel,
      createChannel,
      deleteChannel,
      leaveChannel,
      fetchChannels,
      updateMemberRole,
      uploadFile,
    },
  };
}

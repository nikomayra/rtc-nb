import { useContext } from "react";
import { ChannelContext } from "../contexts/channelContext";

export const useChannelContext = () => {
  const channelContext = useContext(ChannelContext);

  if (!channelContext) {
    throw new Error("useChannel must be used within a ChannelProvider");
  }

  return channelContext;
};

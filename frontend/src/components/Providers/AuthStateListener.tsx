import { useEffect, useContext, useRef } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { WebSocketContext } from "../../contexts/webSocketContext";

/**
 * This component listens to authentication state changes and performs
 * cleanup actions when the user logs out.
 */
export const AuthStateListener: React.FC = () => {
  const { state } = useAuthContext();
  const wsContext = useContext(WebSocketContext);
  const prevLoggedInState = useRef(state.isLoggedIn);

  useEffect(() => {
    // Check if the user has just logged out
    if (prevLoggedInState.current && !state.isLoggedIn) {
      console.log("User logged out, disconnecting all WebSockets");
      wsContext?.actions.disconnectAll();
    }

    // Update previous state
    prevLoggedInState.current = state.isLoggedIn;
  }, [state.isLoggedIn, wsContext]);

  // This component doesn't render anything
  return null;
};

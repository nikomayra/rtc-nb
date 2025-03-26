import { useCallback, useContext } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { WebSocketContext } from "../../contexts/webSocketContext";

const LogOut = () => {
  const authContext = useAuthContext();
  const wsContext = useContext(WebSocketContext);

  const handleLogout = useCallback(async () => {
    if (wsContext) {
      console.log("Disconnecting all WebSockets before logout");
      wsContext.actions.disconnectAll();
    }
    await authContext.actions.logout();
  }, [authContext.actions, wsContext]);

  return (
    <div className="flex items-center justify-between p-2 mb-4 border-b border-primary/20">
      <span className="text-text-light font-medium truncate pr-2">{authContext.state.username}</span>
      <button onClick={handleLogout} className="text-sm text-text-light/70 hover:text-primary transition-colors">
        Logout
      </button>
    </div>
  );
};

export default LogOut;

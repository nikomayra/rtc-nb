import { useCallback, useContext } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { WebSocketContext } from "../../contexts/webSocketContext";

const LogOut = () => {
  const authContext = useAuthContext();
  const wsContext = useContext(WebSocketContext);

  // Check if wsContext is available before accessing state
  const systemConnected = wsContext ? wsContext.state.systemConnected : false;

  const handleLogout = useCallback(async () => {
    if (wsContext) {
      console.log("Disconnecting all WebSockets before logout");
      wsContext.actions.disconnectAll();
    }
    await authContext.actions.logout();
  }, [authContext.actions, wsContext]);

  return (
    <div className="flex items-center justify-between p-2 mb-4 border-b border-primary/20">
      <div className="flex items-center min-w-0">
        {" "}
        {/* Wrapper to keep dot and name together */}
        <div
          className={`flex-none w-2.5 h-2.5 rounded-full mr-2 ${systemConnected ? "bg-success" : "bg-gray-500"}`}
          title={systemConnected ? "System Connected" : "System Disconnected"}
        />
        <span className="text-text-light font-medium truncate">{authContext.state.username}</span>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-text-light/70 hover:text-primary transition-colors flex-none"
      >
        {" "}
        {/* Added flex-none */}
        Logout
      </button>
    </div>
  );
};

export default LogOut;

import { useCallback, useContext } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { WebSocketContext } from "../../contexts/webSocketContext";
import { useNotification } from "../../hooks/useNotification";

const LogOut = () => {
  const authContext = useAuthContext();
  const wsContext = useContext(WebSocketContext);
  const { showError } = useNotification();

  // Check if wsContext is available before accessing state
  const systemConnected = wsContext ? wsContext.state.systemConnected : false;

  const handleLogout = useCallback(async () => {
    // Disconnect WebSocket first
    if (wsContext) {
      console.log("Disconnecting channel and system WebSockets before logout");
      // Check if connected before attempting disconnect to avoid unnecessary logs/errors
      if (wsContext.state.channelConnected) {
        wsContext.actions.disconnectChannel();
      }
      if (wsContext.state.systemConnected) {
        wsContext.actions.disconnectSystem();
      }
    }
    // Attempt logout via auth context
    try {
      await authContext.actions.logout();
      // On success, the UI should react based on isLoggedIn state change.
    } catch (error) {
      // Provider no longer shows error, component does.
      const message = error instanceof Error ? error.message : "Logout failed unexpectedly";
      showError(message);
      console.error("[LogOut] Logout failed:", error);
    }
  }, [authContext.actions, wsContext, showError]);

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

import { useNotification } from "../hooks/useNotification";

export const NotificationTest = () => {
  const { showSuccess, showError, showInfo, showWarning } = useNotification();

  return (
    <div className="fixed top-4 right-4 z-50 p-4 bg-surface-light rounded-lg border border-primary/20 shadow-lg backdrop-blur-sm max-w-xs">
      <h2 className="text-lg font-semibold text-text-light mb-3">Test Notifications</h2>

      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={() => showSuccess("Operation completed successfully!")}
          className="w-full px-3 py-1.5 bg-green-500/10 text-green-400 rounded-md hover:bg-green-500/20 transition-colors text-sm"
        >
          Success
        </button>

        <button
          onClick={() => showError("An error occurred while processing your request.")}
          className="w-full px-3 py-1.5 bg-red-500/10 text-red-400 rounded-md hover:bg-red-500/20 transition-colors text-sm"
        >
          Error
        </button>

        <button
          onClick={() => showInfo("This is an informational message for your reference.")}
          className="w-full px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-md hover:bg-blue-500/20 transition-colors text-sm"
        >
          Info
        </button>

        <button
          onClick={() => showWarning("Please be aware of this important warning.")}
          className="w-full px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-md hover:bg-yellow-500/20 transition-colors text-sm"
        >
          Warning
        </button>

        <button
          onClick={() =>
            showInfo(
              "This is a very long notification message that should test the maximum width capabilities of our notification component and show how it handles text wrapping for extended content."
            )
          }
          className="w-full px-3 py-1.5 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors text-sm"
        >
          Long Message
        </button>
      </div>
    </div>
  );
};

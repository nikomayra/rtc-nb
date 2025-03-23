import { useState, useCallback, useEffect, useRef } from "react";
import { NotificationContext } from "../contexts/notificationContext";
import { useContext } from "react";

interface ApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook for making API calls with standardized loading, error handling, and caching
 */
export function useApi<T, Args extends unknown[]>(
  apiFunction: (...args: Args) => Promise<T>,
  defaultErrorMessage = "An error occurred while fetching data"
) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  // For storing the latest controller to cancel previous requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // For notification support
  const notificationContext = useContext(NotificationContext);

  // Function to display error notification
  const notifyError = useCallback(
    (message: string) => {
      if (!notificationContext) {
        console.error(message);
        return;
      }
      notificationContext.actions.addNotification({
        type: "error",
        message,
        duration: 5000,
      });
    },
    [notificationContext]
  );

  // Execute the API call
  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create a new AbortController
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Reset error and set loading
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Call the API function with the provided args
        const data = await apiFunction(...args);

        // Only update state if this is the most recent request
        if (abortControllerRef.current === controller) {
          setState({ data, isLoading: false, error: null });
        }

        return data;
      } catch (error) {
        // Only update state if this is the most recent request
        if (abortControllerRef.current === controller) {
          const errorMessage = error instanceof Error ? error.message : defaultErrorMessage;

          setState({ data: null, isLoading: false, error: errorMessage });
          notifyError(errorMessage);
        }
        return null;
      }
    },
    [apiFunction, defaultErrorMessage, notifyError]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    execute,
    // Reset the state
    reset: useCallback(() => {
      setState({ data: null, isLoading: false, error: null });
    }, []),
  };
}

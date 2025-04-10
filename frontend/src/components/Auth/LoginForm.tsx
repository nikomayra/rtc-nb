import React, { useState } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useNotification } from "../../hooks/useNotification";

export const LoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const {
    actions: { login },
  } = useAuthContext();
  const { showError } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input before submission
    if (!username.trim() || !password.trim()) {
      return; // Prevent form submission with empty fields
    }

    try {
      await login(username, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed unexpectedly";
      showError(message);
      console.error("[LoginForm] Login failed:", error);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <h3 className="font-bold text-text-light">Login</h3>
      <input
        type="text"
        placeholder="Username"
        className="input-base"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        className="input-base"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button
        type="submit"
        className="w-100% bg-primary-dark h-[50px] my-3 flex items-center justify-center rounded-xl cursor-pointer relative overflow-hidden transition-all duration-500 ease-in-out shadow-md hover:scale-105 hover:shadow-lg before:absolute before:top-0 before:-left-full before:w-full before:h-full before:bg-gradient-to-r before:from-[#d00000] before:to-[#dc2f02] before:transition-all before:duration-500 before:ease-in-out before:z-[-1] before:rounded-xl hover:before:left-0 text-text-light"
        disabled={!username.trim() || !password.trim()}
      >
        Login
      </button>
    </form>
  );
};

import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export const AuthContainer = () => {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <div className="min-h-screen bg-surface-dark p-8">
      <div className="max-w-[var(--auth-form-width)] mx-auto mt-16">
        <h1 className="text-3xl font-bold text-text-light mb-6 text-center">Chat and Sketch with Friends!</h1>
        {showLogin ? <LoginForm /> : <RegisterForm />}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setShowLogin(true)}
            className={`flex-1 px-4 py-1.5 text-sm rounded border transition-colors
              ${
                showLogin
                  ? "border-secondary text-secondary bg-surface-light"
                  : "border-secondary/30 text-text-light/50 hover:border-secondary/50 hover:text-text-light/75"
              }`}
          >
            Login
          </button>
          <button
            onClick={() => setShowLogin(false)}
            className={`flex-1 px-4 py-1.5 text-sm rounded border transition-colors
              ${
                !showLogin
                  ? "border-secondary text-secondary bg-surface-light"
                  : "border-secondary/30 text-text-light/50 hover:border-secondary/50 hover:text-text-light/75"
              }`}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
};

import { FormEvent } from "react";
import { useSystemContext } from "../../hooks/useSystemContext";
import { useNotification } from "../../hooks/useNotification";

export const CreateChannelForm = ({ setIsCreateFormOpen }: { setIsCreateFormOpen: (isOpen: boolean) => void }) => {
  const systemContext = useSystemContext();
  const { showError } = useNotification();
  const { actions: systemActions } = systemContext;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | undefined;
    const password = formData.get("password") as string | undefined;

    try {
      await systemActions.createChannel(name, description, password);
      (e.target as HTMLFormElement).reset();
      setIsCreateFormOpen(false);
    } catch (error) {
      console.error("Failed to create channel:", error);
      showError("Failed to create channel");
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          name="name"
          placeholder="Channel Name"
          required
          className="w-full px-3 py-1.5 text-sm bg-surface-dark border border-primary/20 
            rounded-md text-text-light placeholder:text-text-light/30
            focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50
            transition-colors"
        />
        <input
          type="text"
          name="description"
          placeholder="Description (optional)"
          className="w-full px-3 py-1.5 text-sm bg-surface-dark border border-primary/20 
            rounded-md text-text-light placeholder:text-text-light/30
            focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50
            transition-colors"
        />
        <input
          type="password"
          name="password"
          placeholder="Password (optional)"
          className="w-full px-3 py-1.5 text-sm bg-surface-dark border border-primary/20 
            rounded-md text-text-light placeholder:text-text-light/30
            focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50
            transition-colors"
        />
        <button
          type="submit"
          className="w-full px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary 
            rounded-md hover:bg-primary/20 focus:outline-none focus:ring-2 
            focus:ring-primary/50 transition-colors"
        >
          Create
        </button>
      </form>
    </div>
  );
};

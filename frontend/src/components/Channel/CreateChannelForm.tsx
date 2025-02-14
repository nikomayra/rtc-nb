import { FormEvent } from "react";

type CreateChannelFormProps = {
  onSubmit: (name: string, description?: string, password?: string) => Promise<void>;
};

export const CreateChannelForm = ({ onSubmit }: CreateChannelFormProps) => {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | undefined;
    const password = formData.get("password") as string | undefined;

    onSubmit(name, description, password);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-text-light/70 uppercase tracking-wider mb-3">Create Channel</h3>
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

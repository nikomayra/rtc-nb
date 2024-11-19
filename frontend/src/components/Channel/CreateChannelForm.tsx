import { FormEvent } from 'react';

type CreateChannelFormProps = {
  onSubmit: (name: string, description: string) => Promise<boolean>;
};

export const CreateChannelForm = ({ onSubmit }: CreateChannelFormProps) => {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    onSubmit(name, description);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} id='create-channel-form'>
        <input type='text' name='name' />
        <input type='text' name='description' />
        <button type='submit'>Create</button>
      </form>
    </div>
  );
};

import { FormEvent } from 'react';

type CreateChannelFormProps = {
  onSubmit: (
    name: string,
    description?: string,
    password?: string
  ) => Promise<boolean>;
};

export const CreateChannelForm = ({ onSubmit }: CreateChannelFormProps) => {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | undefined;
    const password = formData.get('password') as string | undefined;

    onSubmit(name, description, password);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} id='create-channel-form'>
        <input type='text' name='name' placeholder='Channel Name' />
        <br />
        <input
          type='text'
          name='description'
          placeholder='Description (optional)'
          defaultValue={undefined}
        />
        <br />
        <input
          type='password'
          name='password'
          placeholder='Password (optional)'
          defaultValue={undefined}
        />
        <br />
        <button type='submit'>Create</button>
      </form>
    </div>
  );
};

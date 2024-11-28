import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../api/authApi';

// Mock the authApi
jest.mock('../../api/authApi', () => ({
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
  },
}));

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('useAuth hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.clear();
  });

  it('should login successfully', async () => {
    (authApi.login as jest.Mock).mockResolvedValue({
      success: true,
      data: { token: 'test-token' },
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('testuser', 'password');
    });

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.token).toBe('test-token');
    expect(result.current.username).toBe('testuser');
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'token',
      'test-token'
    );
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'username',
      'testuser'
    );
  });

  it('should handle login failure', async () => {
    (authApi.login as jest.Mock).mockResolvedValue({
      success: false,
      error: { message: 'Invalid credentials', code: 401 },
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.login('testuser', 'wrongpassword');
      } catch (error: unknown) {
        if (error instanceof Error) {
          expect(error.message).toBe('Invalid credentials, Code: 401');
        }
      }
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.token).toBe('');
    expect(result.current.username).toBe('');
  });

  it('should register successfully', async () => {
    (authApi.register as jest.Mock).mockResolvedValue({
      success: true,
      data: { token: 'new-user-token' },
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.register('newuser', 'newpassword');
    });

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.token).toBe('new-user-token');
    expect(result.current.username).toBe('newuser');
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'token',
      'new-user-token'
    );
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'username',
      'newuser'
    );
  });

  it('should handle registration failure', async () => {
    (authApi.register as jest.Mock).mockResolvedValue({
      success: false,
      error: { message: 'Registration error', code: 400 },
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.register('newuser', 'password');
      } catch (error: unknown) {
        if (error instanceof Error) {
          expect(error.message).toBe('Registration error, Code: 400');
        }
      }
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.token).toBe('');
    expect(result.current.username).toBe('');
  });

  it('should logout', () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.token).toBe('');
    expect(result.current.username).toBe('');
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('token');
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('username');
  });
});

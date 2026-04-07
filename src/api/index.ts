/**
 * API 클라이언트 및 엔드포인트 호출 함수
 * 예: getRooms(), createBooking() 등
 */
type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

type UserDto = {
  id: string;
  name: string;
  email: string;
};

type AuthResponse = {
  user: UserDto;
};

type CreateUserPayload = {
  id: string;
  name: string;
  email: string;
  password: string;
};

type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

const API_BASE = '/api';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const fallbackMessage = `요청 실패 (${response.status})`;
    let message = fallbackMessage;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      message = payload.error?.message ?? fallbackMessage;
    } catch {
      message = fallbackMessage;
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function loginWithPassword(email: string, password: string): Promise<UserDto> {
  const result = await requestJson<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return result.user;
}

export async function getCurrentUser(): Promise<UserDto> {
  const result = await requestJson<AuthResponse>('/auth/me', {
    method: 'GET',
  });
  return result.user;
}

export async function createCompanyUser(payload: CreateUserPayload): Promise<UserDto> {
  return requestJson<UserDto>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function changePassword(payload: ChangePasswordPayload): Promise<UserDto> {
  const result = await requestJson<AuthResponse>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.user;
}

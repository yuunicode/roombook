type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type UserDto = {
  id: string;
  name: string;
  email: string;
  department?: string;
  is_admin?: boolean;
};

export type UserAiUsageDto = {
  user_id: string;
  name: string;
  email: string;
  department: string;
  used_usd: number;
  period_month: string;
  updated_at: string | null;
};

export type UserAiUsageOverviewDto = {
  summary: {
    monthly_limit_usd: number;
    used_usd: number;
    remaining_usd: number;
    period_month: string;
  };
  items: UserAiUsageDto[];
};

export type RoomDto = {
  id: string;
  name: string;
  capacity: number;
};

export type LabelDto = {
  name: string;
};

type AuthResponse = {
  user: UserDto;
};

type CreateUserPayload = {
  id: string;
  name: string;
  department: string;
};

type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

export type ReservationDto = {
  id: string;
  room_id: string;
  room_name: string;
  title: string;
  label: string;
  start_at: string;
  end_at: string;
  purpose?: string | null;
  agenda_url?: string | null;
  description?: string | null;
  external_attendees?: string | null;
  agenda?: string | null;
  meeting_content?: string | null;
  meeting_result?: string | null;
  minutes_attachment?: string | null;
  created_by?: {
    name: string;
    email: string;
  };
  attendees?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
};

type ReservationUpsertPayload = {
  room_id?: string;
  title: string;
  label?: string;
  start_at: string;
  end_at: string;
  attendees?: string[];
  external_attendees?: string;
  agenda?: string;
  meeting_content?: string;
  meeting_result?: string;
  minutes_attachment?: string;
};

type ReservationQuery = {
  recent_months?: number;
  month?: number;
  day?: number;
  label?: string;
  creator?: string;
  attendee?: string;
};

export type MinutesLockDto = {
  reservation_id: string;
  holder_user_id: string;
  holder_name: string;
  expires_at: string;
};

export type MinutesLiveStateDto = {
  reservation_id: string;
  transcript_text: string;
  is_recording: boolean;
  updated_by_user_id?: string | null;
  updated_by_name?: string | null;
  updated_at: string;
};

type UpdateMinutesLiveStatePayload = {
  transcript_text?: string;
  is_recording?: boolean;
};

type TranscribeChunkPayload = {
  audio_base64: string;
  mime_type?: string;
  previous_text?: string;
};

export type TranscribeChunkResult = {
  text: string;
};

type MinutesSuggestionPayload = {
  transcript: string;
  existing_agenda?: string;
  existing_meeting_content?: string;
  existing_meeting_result?: string;
};

export type MinutesSuggestionResult = {
  agenda: string[];
  meeting_content: string[];
  meeting_result: string[];
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

  if (response.status === 204) {
    return undefined as T;
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

export async function listCompanyUsers(): Promise<UserDto[]> {
  return requestJson<UserDto[]>('/users', {
    method: 'GET',
  });
}

export async function listUserAiUsage(): Promise<UserAiUsageOverviewDto> {
  return requestJson<UserAiUsageOverviewDto>('/users/ai-usage', {
    method: 'GET',
  });
}

export async function listRooms(): Promise<RoomDto[]> {
  return requestJson<RoomDto[]>('/rooms', {
    method: 'GET',
  });
}

export async function listReservationLabels(): Promise<LabelDto[]> {
  return requestJson<LabelDto[]>('/labels', {
    method: 'GET',
  });
}

export async function createReservationLabel(name: string): Promise<LabelDto> {
  return requestJson<LabelDto>('/labels', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updateReservationLabel(oldName: string, name: string): Promise<LabelDto> {
  return requestJson<LabelDto>(`/labels/${encodeURIComponent(oldName)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function deleteReservationLabel(name: string): Promise<void> {
  await requestJson<void>(`/labels/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<UserDto> {
  return requestJson<UserDto>(`/users/${encodeURIComponent(userId)}/admin`, {
    method: 'PATCH',
    body: JSON.stringify({ is_admin: isAdmin }),
  });
}

export async function deleteCompanyUser(userId: string): Promise<void> {
  await requestJson<void>(`/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function changePassword(payload: ChangePasswordPayload): Promise<UserDto> {
  const result = await requestJson<AuthResponse>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.user;
}

function toQueryString(query: ReservationQuery): string {
  const params = new URLSearchParams();
  if (query.recent_months !== undefined) params.set('recent_months', String(query.recent_months));
  if (query.month !== undefined) params.set('month', String(query.month));
  if (query.day !== undefined) params.set('day', String(query.day));
  if (query.label) params.set('label', query.label);
  if (query.creator) params.set('creator', query.creator);
  if (query.attendee) params.set('attendee', query.attendee);
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export async function listReservations(query: ReservationQuery = {}): Promise<ReservationDto[]> {
  return requestJson<ReservationDto[]>(`/reservations${toQueryString(query)}`, {
    method: 'GET',
  });
}

export async function getReservationMinutes(reservationId: string): Promise<ReservationDto> {
  return requestJson<ReservationDto>(`/reservations/${reservationId}/minutes`, {
    method: 'GET',
  });
}

export async function createReservation(
  payload: ReservationUpsertPayload
): Promise<ReservationDto> {
  return requestJson<ReservationDto>('/reservations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateReservationMinutes(
  reservationId: string,
  payload: ReservationUpsertPayload
): Promise<ReservationDto> {
  return requestJson<ReservationDto>(`/reservations/${reservationId}/minutes`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteReservation(reservationId: string): Promise<void> {
  await requestJson<void>(`/reservations/${reservationId}`, {
    method: 'DELETE',
  });
}

export async function getMinutesLock(reservationId: string): Promise<MinutesLockDto | null> {
  return requestJson<MinutesLockDto | null>(`/reservations/${reservationId}/minutes-lock`, {
    method: 'GET',
  });
}

export async function acquireMinutesLock(
  reservationId: string,
  ttlSeconds = 15
): Promise<MinutesLockDto> {
  return requestJson<MinutesLockDto>(`/reservations/${reservationId}/minutes-lock`, {
    method: 'POST',
    body: JSON.stringify({ ttl_seconds: ttlSeconds }),
  });
}

export async function releaseMinutesLock(reservationId: string): Promise<void> {
  await requestJson<void>(`/reservations/${reservationId}/minutes-lock`, {
    method: 'DELETE',
  });
}

export async function getMinutesLiveState(reservationId: string): Promise<MinutesLiveStateDto> {
  return requestJson<MinutesLiveStateDto>(`/reservations/${reservationId}/minutes-live-state`, {
    method: 'GET',
  });
}

export async function updateMinutesLiveState(
  reservationId: string,
  payload: UpdateMinutesLiveStatePayload
): Promise<MinutesLiveStateDto> {
  return requestJson<MinutesLiveStateDto>(`/reservations/${reservationId}/minutes-live-state`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function transcribeChunk(
  payload: TranscribeChunkPayload
): Promise<TranscribeChunkResult> {
  return requestJson<TranscribeChunkResult>('/ai/transcribe-chunk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function suggestMinutesFromTranscript(
  payload: MinutesSuggestionPayload
): Promise<MinutesSuggestionResult> {
  return requestJson<MinutesSuggestionResult>('/ai/suggest-minutes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

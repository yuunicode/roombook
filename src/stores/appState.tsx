import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ReservationDraft, ReservationStatus, TimetableReservation } from '../components';

type AppUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  password?: string; // 비밀번호 필드 추가
};

type AppReservation = TimetableReservation & {
  room: string;
  attendees: AppUser[];
};

type AppStateContextValue = {
  userEmail: string;
  isLoggedIn: boolean;
  users: AppUser[];
  reservations: AppReservation[];
  setUserEmail: (email: string) => void;
  addUser: (user: AppUser) => void;
  logout: () => void;
  changePassword: (email: string, newPassword: string) => Promise<void>;
  addReservation: (draft: ReservationDraft, room: string) => void;
  updateReservation: (
    reservationId: string,
    payload: Omit<ReservationStatus, 'id' | 'creatorEmail'>
  ) => void;
  deleteReservation: (reservationId: string) => void;
};

type StoredReservation = Omit<AppReservation, 'start' | 'end'> & {
  start: string;
  end: string;
  attendees: AppUser[] | string;
};

const SESSION_KEY = 'roombook.userEmail';
const USERS_KEY = 'roombook.users';
const RESERVATIONS_KEY = 'roombook.reservations';

const initialUsers: AppUser[] = [
  { id: '1', name: '관리자', email: 'admin@ecminer.com', department: '관리팀' },
  { id: '2', name: 'user', email: 'user@ecminer.com', department: '운영팀' },
  { id: '3', name: '기획팀', email: 'planner@ecminer.com', department: '기획팀' },
  { id: '4', name: '디자이너', email: 'designer@ecminer.com', department: '디자인팀' },
  { id: '5', name: '운영담당', email: 'ops@ecminer.com', department: '운영팀' },
];

const initialReservations: AppReservation[] = [
  {
    id: 'seed-1',
    title: '제품 기획 미팅',
    start: new Date(2026, 1, 23, 10, 0),
    end: new Date(2026, 1, 23, 10, 30),
    attendees: [initialUsers[1], initialUsers[2]],
    agenda: '신규 기능 우선순위 논의',
    minutesAttachment: '기획_초안.docx',
    creatorEmail: 'planner@ecminer.com',
    room: 'room-a',
  },
  {
    id: 'seed-2',
    title: '디자인 리뷰',
    start: new Date(2026, 1, 24, 14, 0),
    end: new Date(2026, 1, 24, 15, 0),
    attendees: [initialUsers[1], initialUsers[3]],
    agenda: '랜딩 페이지 시안 검토',
    minutesAttachment: '',
    creatorEmail: 'designer@ecminer.com',
    room: 'room-b',
  },
  {
    id: 'seed-3',
    title: '운영 점검 회의',
    start: new Date(2026, 1, 25, 16, 0),
    end: new Date(2026, 1, 25, 17, 0),
    attendees: [initialUsers[4]],
    agenda: '월말 운영 이슈 점검',
    minutesAttachment: '',
    creatorEmail: 'user@ecminer.com',
    room: 'room-a',
  },
];

const AppStateContext = createContext<AppStateContextValue | null>(null);

function normalizeUsers(value: string | null): AppUser[] {
  if (!value) {
    return initialUsers;
  }

  try {
    const parsed = JSON.parse(value) as AppUser[];
    return parsed.map((user) => ({
      ...user,
      email: user.email.trim().toLowerCase(),
    }));
  } catch {
    return initialUsers;
  }
}

function resolveLegacyAttendees(attendees: string, users: AppUser[]) {
  const tokens = attendees
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return users.filter((user) => {
    const normalizedName = user.name.trim().toLowerCase();
    const normalizedEmail = user.email.trim().toLowerCase();
    return tokens.includes(normalizedName) || tokens.includes(normalizedEmail);
  });
}

function normalizeReservations(value: string | null, users: AppUser[]): AppReservation[] {
  if (!value) {
    return initialReservations;
  }

  try {
    const parsed = JSON.parse(value) as StoredReservation[];
    return parsed.map((item) => ({
      ...item,
      start: new Date(item.start),
      end: new Date(item.end),
      attendees:
        typeof item.attendees === 'string'
          ? resolveLegacyAttendees(item.attendees, users)
          : item.attendees.map((attendee) => ({
              ...attendee,
              email: attendee.email.trim().toLowerCase(),
            })),
    }));
  } catch {
    return initialReservations;
  }
}

function AppStateProvider({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmailState] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.localStorage.getItem(SESSION_KEY) ?? '';
  });
  const [users, setUsers] = useState<AppUser[]>(() => {
    if (typeof window === 'undefined') {
      return initialUsers;
    }
    return normalizeUsers(window.localStorage.getItem(USERS_KEY));
  });
  const [reservations, setReservations] = useState<AppReservation[]>(() => {
    if (typeof window === 'undefined') {
      return initialReservations;
    }
    const storedUsers = normalizeUsers(window.localStorage.getItem(USERS_KEY));
    return normalizeReservations(window.localStorage.getItem(RESERVATIONS_KEY), storedUsers);
  });

  useEffect(() => {
    window.localStorage.setItem(SESSION_KEY, userEmail);
  }, [userEmail]);

  useEffect(() => {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    const serialized = JSON.stringify(
      reservations.map((item) => ({
        ...item,
        start: item.start.toISOString(),
        end: item.end.toISOString(),
      }))
    );
    window.localStorage.setItem(RESERVATIONS_KEY, serialized);
  }, [reservations]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      userEmail,
      isLoggedIn: userEmail.length > 0,
      users,
      reservations,
      setUserEmail: (email: string) => {
        setUserEmailState(email.trim().toLowerCase());
      },
      addUser: (user) => {
        setUsers((previous) => {
          const normalizedEmail = user.email.trim().toLowerCase();
          if (previous.some((item) => item.email === normalizedEmail || item.id === user.id.trim())) {
            return previous;
          }
          return [
            ...previous,
            {
              ...user,
              id: user.id.trim(),
              name: user.name.trim(),
              email: normalizedEmail,
              department: user.department.trim() || '-',
            },
          ];
        });
      },
      logout: () => {
        setUserEmailState('');
        window.localStorage.removeItem(SESSION_KEY);
      },
      changePassword: async (email, newPassword) => {
        // 실제 저장소 업데이트 시뮬레이션
        setUsers((previous) =>
          previous.map((user) =>
            user.email.toLowerCase() === email.toLowerCase()
              ? { ...user, password: newPassword }
              : user
          )
        );
        // localStorage에 즉시 반영되도록 트리거 (useEffect가 비동기로 작동하므로)
      },
      addReservation: (draft, room) => {
        setReservations((previous) => [
          ...previous,
          {
            id: String(Date.now()),
            title: draft.title,
            attendees: draft.attendees,
            agenda: draft.agenda,
            minutesAttachment: draft.minutesAttachment,
            creatorEmail: userEmail,
            start: draft.start,
            end: draft.end,
            room,
          },
        ]);
      },
      updateReservation: (reservationId, payload) => {
        setReservations((previous) =>
          previous.map((item) => (item.id === reservationId ? { ...item, ...payload } : item))
        );
      },
      deleteReservation: (reservationId) => {
        setReservations((previous) => previous.filter((item) => item.id !== reservationId));
      },
    }),
    [reservations, userEmail, users]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}

export { AppStateProvider, useAppState };
export type { AppReservation, AppUser };

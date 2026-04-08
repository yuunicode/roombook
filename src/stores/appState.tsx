/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ReservationDraft, ReservationStatus, TimetableReservation } from '../components';

type AppUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  password?: string;
};

type AppReservation = TimetableReservation & {
  room: string;
  attendees: AppUser[];
};

type StoredReservation = Omit<AppReservation, 'start' | 'end'> & {
  start: string;
  end: string;
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

const AppStateContext = createContext<AppStateContextValue | null>(null);

const SESSION_KEY = 'roombook_session_email';
const USERS_KEY = 'roombook_users';
const RESERVATIONS_KEY = 'roombook_reservations';

function AppStateProvider({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmailState] = useState<string>(() => {
    return window.localStorage.getItem(SESSION_KEY) ?? '';
  });

  const [users, setUsers] = useState<AppUser[]>(() => {
    const saved = window.localStorage.getItem(USERS_KEY);
    return saved ? JSON.parse(saved) : [
      { id: '1', name: '관리자', email: 'admin@ecminer.com', department: '운영팀' },
      { id: '2', name: '홍길동', email: 'kuku@ecminer.com', department: '개발팀' },
    ];
  });

  const [reservations, setReservations] = useState<AppReservation[]>(() => {
    const saved = window.localStorage.getItem(RESERVATIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as StoredReservation[];
      return parsed.map((item) => ({
        ...item,
        start: new Date(item.start),
        end: new Date(item.end),
      }));
    }
    return [];
  });

  useEffect(() => {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    window.localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(reservations));
  }, [reservations]);

  const value = useMemo<AppStateContextValue>(() => ({
    userEmail,
    isLoggedIn: Boolean(userEmail),
    users,
    reservations,
    setUserEmail: (email) => {
      const normalized = email.trim().toLowerCase();
      setUserEmailState(normalized);
      if (normalized) {
        window.localStorage.setItem(SESSION_KEY, normalized);
      } else {
        window.localStorage.removeItem(SESSION_KEY);
      }
    },
    addUser: (user) => {
      setUsers((prev) => {
        const normalizedEmail = user.email.trim().toLowerCase();
        if (prev.some(u => u.email === normalizedEmail)) return prev;
        return [...prev, { ...user, email: normalizedEmail }];
      });
    },
    logout: () => {
      setUserEmailState('');
      window.localStorage.removeItem(SESSION_KEY);
    },
    changePassword: async (email, newPassword) => {
      setUsers(prev => prev.map(u => u.email.toLowerCase() === email.toLowerCase() ? { ...u, password: newPassword } : u));
    },
    addReservation: (draft, room) => {
      setReservations((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          ...draft,
          room,
          creatorEmail: userEmail,
        }
      ]);
    },
    updateReservation: (id, payload) => {
      setReservations((prev) => prev.map(r => r.id === id ? { ...r, ...payload } : r));
    },
    deleteReservation: (id) => {
      setReservations((prev) => prev.filter(r => r.id !== id));
    },
  }), [userEmail, users, reservations]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
}

export { AppStateProvider, useAppState };
export type { AppReservation, AppUser };

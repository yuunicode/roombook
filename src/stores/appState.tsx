/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ReservationDraft, ReservationStatus, TimetableReservation } from '../components';
import {
  changePassword as changePasswordApi,
  createCompanyUser,
  createReservation as createReservationApi,
  deleteReservation as deleteReservationApi,
  listCompanyUsers,
  listReservations,
  type ReservationDto,
  updateReservationMinutes,
} from '../api';

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

type AppStateContextValue = {
  userEmail: string;
  isLoggedIn: boolean;
  users: AppUser[];
  reservations: AppReservation[];
  reservationLabels: string[];
  setUserEmail: (email: string) => void;
  addUser: (user: AppUser) => void;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  addReservation: (draft: ReservationDraft, room: string) => void;
  updateReservation: (
    reservationId: string,
    payload: Omit<ReservationStatus, 'id' | 'creatorEmail'>
  ) => void;
  deleteReservation: (reservationId: string) => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

const SESSION_KEY = 'roombook_session_email';
const RESERVATION_LABELS_KEY = 'roombook_reservation_labels';
const DEFAULT_RESERVATION_LABELS = ['AIDA', '부동산', 'KETI'];

function mapReservationDtoToAppReservation(
  item: ReservationDto,
  allUsers: AppUser[]
): AppReservation {
  const attendees = item.attendees
    .map((attendee) => allUsers.find((user) => user.id === attendee.id))
    .filter((user): user is AppUser => Boolean(user));

  const room = item.room_id?.toLowerCase().startsWith('room-')
    ? item.room_id
    : `room-${item.room_id.toLowerCase()}`;

  return {
    id: item.id,
    title: item.title,
    label: item.label ?? '',
    start: new Date(item.start_at),
    end: new Date(item.end_at),
    attendees,
    externalAttendees: item.external_attendees ?? '',
    agenda: item.agenda ?? '',
    meetingContent: item.meeting_content ?? '',
    meetingResult: item.meeting_result ?? '',
    minutesAttachment: item.minutes_attachment ?? '',
    creatorEmail: item.created_by.email,
    room,
  };
}

function toIsoString(date: Date): string {
  return date.toISOString();
}

function toApiRoomId(room: string): string {
  if (room.startsWith('room-')) {
    return room.replace('room-', '').toUpperCase();
  }
  return room.toUpperCase();
}

function AppStateProvider({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmailState] = useState<string>(() => {
    return window.localStorage.getItem(SESSION_KEY) ?? '';
  });
  const [users, setUsers] = useState<AppUser[]>([]);
  const [reservations, setReservations] = useState<AppReservation[]>([]);
  const [reservationLabels] = useState<string[]>(() => {
    const saved = window.localStorage.getItem(RESERVATION_LABELS_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
    return DEFAULT_RESERVATION_LABELS;
  });

  useEffect(() => {
    window.localStorage.setItem(RESERVATION_LABELS_KEY, JSON.stringify(reservationLabels));
  }, [reservationLabels]);

  useEffect(() => {
    if (!userEmail) {
      setUsers([]);
      setReservations([]);
      return;
    }

    let mounted = true;
    const hydrate = async () => {
      try {
        const [nextUsers, nextReservations] = await Promise.all([
          listCompanyUsers(),
          listReservations(),
        ]);
        if (!mounted) return;
        const mappedUsers: AppUser[] = nextUsers.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          department: user.department ?? '',
        }));
        setUsers(mappedUsers);
        setReservations(
          nextReservations.map((item) => mapReservationDtoToAppReservation(item, mappedUsers))
        );
      } catch {
        if (!mounted) return;
        setUsers([]);
        setReservations([]);
      }
    };

    void hydrate();
    return () => {
      mounted = false;
    };
  }, [userEmail]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      userEmail,
      isLoggedIn: Boolean(userEmail),
      users,
      reservations,
      reservationLabels,
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
        void (async () => {
          const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            department: user.department,
            password: user.password ?? 'ecminer',
          };
          await createCompanyUser(payload);
          const nextUsers = await listCompanyUsers();
          setUsers(
            nextUsers.map((item) => ({
              id: item.id,
              name: item.name,
              email: item.email,
              department: item.department ?? '',
            }))
          );
        })();
      },
      logout: () => {
        setUserEmailState('');
        window.localStorage.removeItem(SESSION_KEY);
        setUsers([]);
        setReservations([]);
      },
      changePassword: async (currentPassword, newPassword) => {
        await changePasswordApi({
          current_password: currentPassword,
          new_password: newPassword,
        });
      },
      addReservation: (draft, room) => {
        void (async () => {
          const created = await createReservationApi({
            room_id: toApiRoomId(room),
            title: draft.title,
            label: draft.label,
            start_at: toIsoString(draft.start),
            end_at: toIsoString(draft.end),
            attendees: draft.attendees.map((attendee) => attendee.id),
            external_attendees: draft.externalAttendees,
            agenda: draft.agenda,
            meeting_content: draft.meetingContent,
            meeting_result: draft.meetingResult,
            minutes_attachment: draft.minutesAttachment,
          });
          setReservations((prev) => [mapReservationDtoToAppReservation(created, users), ...prev]);
        })();
      },
      updateReservation: (id, payload) => {
        void (async () => {
          const updated = await updateReservationMinutes(id, {
            title: payload.title,
            label: payload.label,
            start_at: toIsoString(payload.start),
            end_at: toIsoString(payload.end),
            attendees: payload.attendees.map((attendee) => attendee.id),
            external_attendees: payload.externalAttendees,
            agenda: payload.agenda,
            meeting_content: payload.meetingContent,
            meeting_result: payload.meetingResult,
            minutes_attachment: payload.minutesAttachment,
          });
          setReservations((prev) =>
            prev.map((reservation) =>
              reservation.id === id
                ? mapReservationDtoToAppReservation(updated, users)
                : reservation
            )
          );
        })();
      },
      deleteReservation: (id) => {
        void (async () => {
          await deleteReservationApi(id);
          setReservations((prev) => prev.filter((reservation) => reservation.id !== id));
        })();
      },
    }),
    [reservationLabels, reservations, userEmail, users]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
}

export { AppStateProvider, useAppState };
export type { AppReservation, AppUser };

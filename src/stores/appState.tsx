/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ReservationDraft, ReservationStatus, TimetableReservation } from '../components';
import {
  changePassword as changePasswordApi,
  createCompanyUser,
  createReservation as createReservationApi,
  deleteReservation as deleteReservationApi,
  getReservationMinutes as getReservationMinutesApi,
  listCompanyUsers,
  listRooms,
  listReservations,
  type ReservationDto,
  type RoomDto,
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
  roomId: string;
  roomName: string;
  attendees: AppUser[];
};

type AppRoom = {
  id: string;
  name: string;
  capacity: number;
};

type AppStateContextValue = {
  userEmail: string;
  isLoggedIn: boolean;
  users: AppUser[];
  rooms: AppRoom[];
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
  saveReservationMinutes: (
    reservationId: string,
    payload: Omit<ReservationStatus, 'id' | 'creatorEmail' | 'creatorName'>
  ) => Promise<AppReservation>;
  getReservationMinutes: (reservationId: string) => Promise<AppReservation | null>;
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
  const attendees = (item.attendees ?? [])
    .map((attendee) => allUsers.find((user) => user.id === attendee.id))
    .filter((user): user is AppUser => Boolean(user));

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
    creatorEmail: item.created_by?.email ?? userEmailFallback(allUsers),
    creatorName: item.created_by?.name ?? '',
    roomId: item.room_id,
    roomName: item.room_name || item.room_id,
  };
}

function userEmailFallback(users: AppUser[]): string {
  return users[0]?.email ?? '';
}

function toIsoString(date: Date): string {
  return date.toISOString();
}

function AppStateProvider({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmailState] = useState<string>(() => {
    return window.localStorage.getItem(SESSION_KEY) ?? '';
  });
  const [users, setUsers] = useState<AppUser[]>([]);
  const [rooms, setRooms] = useState<AppRoom[]>([]);
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
      setRooms([]);
      setReservations([]);
      return;
    }

    let mounted = true;
    const hydrate = async () => {
      try {
        const [nextUsers, nextReservations, nextRooms] = await Promise.all([
          listCompanyUsers(),
          listReservations(),
          listRooms(),
        ]);
        if (!mounted) return;
        const mappedUsers: AppUser[] = nextUsers.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          department: user.department ?? '',
        }));
        setUsers(mappedUsers);
        setRooms(
          nextRooms.map((room: RoomDto) => ({
            id: room.id,
            name: room.name,
            capacity: room.capacity,
          }))
        );
        setReservations(
          nextReservations.map((item) => mapReservationDtoToAppReservation(item, mappedUsers))
        );
      } catch {
        if (!mounted) return;
        setUsers([]);
        setRooms([]);
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
      rooms,
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
        setRooms([]);
        setReservations([]);
      },
      changePassword: async (currentPassword, newPassword) => {
        await changePasswordApi({
          current_password: currentPassword,
          new_password: newPassword,
        });
      },
      addReservation: (draft, roomId) => {
        void (async () => {
          const created = await createReservationApi({
            room_id: roomId,
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
          const mapped = mapReservationDtoToAppReservation(updated, users);
          setReservations((prev) =>
            prev.map((reservation) => (reservation.id === id ? mapped : reservation))
          );
        })();
      },
      saveReservationMinutes: async (id, payload) => {
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
        const mapped = mapReservationDtoToAppReservation(updated, users);
        setReservations((prev) =>
          prev.map((reservation) => (reservation.id === id ? mapped : reservation))
        );
        return mapped;
      },
      getReservationMinutes: async (id) => {
        try {
          const result = await getReservationMinutesApi(id);
          const mapped = mapReservationDtoToAppReservation(result, users);
          setReservations((prev) => {
            const exists = prev.some((item) => item.id === mapped.id);
            if (exists) {
              return prev.map((item) => (item.id === mapped.id ? mapped : item));
            }
            return [mapped, ...prev];
          });
          return mapped;
        } catch {
          return null;
        }
      },
      deleteReservation: (id) => {
        void (async () => {
          await deleteReservationApi(id);
          setReservations((prev) => prev.filter((reservation) => reservation.id !== id));
        })();
      },
    }),
    [reservationLabels, reservations, rooms, userEmail, users]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
}

export { AppStateProvider, useAppState };
export type { AppReservation, AppRoom, AppUser };

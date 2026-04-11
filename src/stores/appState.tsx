/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ReservationDraft, ReservationStatus, TimetableReservation } from '../components';
import {
  changePassword as changePasswordApi,
  createReservationLabel as createReservationLabelApi,
  createCompanyUser,
  createReservation as createReservationApi,
  deleteCompanyUser as deleteCompanyUserApi,
  deleteReservationLabel as deleteReservationLabelApi,
  deleteReservation as deleteReservationApi,
  getReservationMinutes as getReservationMinutesApi,
  listCompanyUsers,
  listReservationLabels as listReservationLabelsApi,
  listRooms,
  listReservations,
  setUserAdmin as setUserAdminApi,
  type LabelDto,
  type ReservationDto,
  type RoomDto,
  updateReservationLabel as updateReservationLabelApi,
  updateReservationMinutes,
} from '../api';

type AppUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  isAdmin: boolean;
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

type NewUserInput = {
  id: string;
  name: string;
  department: string;
};

type AppStateContextValue = {
  userEmail: string;
  isLoggedIn: boolean;
  users: AppUser[];
  rooms: AppRoom[];
  reservations: AppReservation[];
  reservationLabels: string[];
  currentUser: AppUser | null;
  isCurrentUserAdmin: boolean;
  setUserEmail: (email: string) => void;
  addUser: (user: NewUserInput) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  setUserAdmin: (userId: string, isAdmin: boolean) => Promise<void>;
  addReservationLabel: (name: string) => Promise<void>;
  renameReservationLabel: (oldName: string, newName: string) => Promise<void>;
  removeReservationLabel: (name: string) => Promise<void>;
  reloadReservations: () => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  addReservation: (draft: ReservationDraft, room: string) => Promise<void>;
  updateReservation: (
    reservationId: string,
    payload: Omit<ReservationStatus, 'id' | 'creatorEmail'>
  ) => Promise<void>;
  saveReservationMinutes: (
    reservationId: string,
    payload: Omit<ReservationStatus, 'id' | 'creatorEmail' | 'creatorName'>
  ) => Promise<AppReservation>;
  getReservationMinutes: (reservationId: string) => Promise<AppReservation | null>;
  deleteReservation: (reservationId: string) => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

const SESSION_KEY = 'roombook_session_email';
const DEFAULT_RESERVATION_LABELS = ['없음', 'AIDA', '부동산', 'KETI'];

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
  const [reservationLabels, setReservationLabels] = useState<string[]>(DEFAULT_RESERVATION_LABELS);

  useEffect(() => {
    if (!userEmail) {
      setUsers([]);
      setRooms([]);
      setReservations([]);
      setReservationLabels(DEFAULT_RESERVATION_LABELS);
      return;
    }

    let mounted = true;
    const hydrate = async () => {
      try {
        const [nextUsers, nextReservations, nextRooms, nextLabels] = await Promise.all([
          listCompanyUsers(),
          listReservations(),
          listRooms(),
          listReservationLabelsApi(),
        ]);
        if (!mounted) return;
        const mappedUsers: AppUser[] = nextUsers.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          department: user.department ?? '',
          isAdmin: Boolean(user.is_admin),
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
        const labelNames = nextLabels
          .map((item: LabelDto) => item.name)
          .filter((item) => item.trim());
        setReservationLabels(labelNames.length > 0 ? labelNames : DEFAULT_RESERVATION_LABELS);
      } catch {
        if (!mounted) return;
        setUsers([]);
        setRooms([]);
        setReservations([]);
        setReservationLabels(DEFAULT_RESERVATION_LABELS);
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
      currentUser:
        users.find((user) => user.email.toLowerCase() === userEmail.toLowerCase()) ?? null,
      isCurrentUserAdmin:
        users.find((user) => user.email.toLowerCase() === userEmail.toLowerCase())?.isAdmin ??
        false,
      setUserEmail: (email) => {
        const normalized = email.trim().toLowerCase();
        setUserEmailState(normalized);
        if (normalized) {
          window.localStorage.setItem(SESSION_KEY, normalized);
        } else {
          window.localStorage.removeItem(SESSION_KEY);
        }
      },
      addUser: async (user) => {
        const payload = {
          id: user.id,
          name: user.name,
          department: user.department,
        };
        await createCompanyUser(payload);
        const nextUsers = await listCompanyUsers();
        setUsers(
          nextUsers.map((item) => ({
            id: item.id,
            name: item.name,
            email: item.email,
            department: item.department ?? '',
            isAdmin: Boolean(item.is_admin),
          }))
        );
      },
      removeUser: async (userId) => {
        await deleteCompanyUserApi(userId);
        const nextUsers = await listCompanyUsers();
        setUsers(
          nextUsers.map((item) => ({
            id: item.id,
            name: item.name,
            email: item.email,
            department: item.department ?? '',
            isAdmin: Boolean(item.is_admin),
          }))
        );
      },
      setUserAdmin: async (userId, isAdmin) => {
        await setUserAdminApi(userId, isAdmin);
        const nextUsers = await listCompanyUsers();
        setUsers(
          nextUsers.map((item) => ({
            id: item.id,
            name: item.name,
            email: item.email,
            department: item.department ?? '',
            isAdmin: Boolean(item.is_admin),
          }))
        );
      },
      addReservationLabel: async (name) => {
        await createReservationLabelApi(name);
        const nextLabels = await listReservationLabelsApi();
        const labelNames = nextLabels.map((item) => item.name).filter((item) => item.trim());
        setReservationLabels(labelNames.length > 0 ? labelNames : DEFAULT_RESERVATION_LABELS);
      },
      renameReservationLabel: async (oldName, newName) => {
        await updateReservationLabelApi(oldName, newName);
        const [nextLabels, nextReservations] = await Promise.all([
          listReservationLabelsApi(),
          listReservations(),
        ]);
        const labelNames = nextLabels.map((item) => item.name).filter((item) => item.trim());
        setReservationLabels(labelNames.length > 0 ? labelNames : DEFAULT_RESERVATION_LABELS);
        setReservations(
          nextReservations.map((item) => mapReservationDtoToAppReservation(item, users))
        );
      },
      removeReservationLabel: async (name) => {
        await deleteReservationLabelApi(name);
        const [nextLabels, nextReservations] = await Promise.all([
          listReservationLabelsApi(),
          listReservations(),
        ]);
        const labelNames = nextLabels.map((item) => item.name).filter((item) => item.trim());
        setReservationLabels(labelNames.length > 0 ? labelNames : DEFAULT_RESERVATION_LABELS);
        setReservations(
          nextReservations.map((item) => mapReservationDtoToAppReservation(item, users))
        );
      },
      reloadReservations: async () => {
        const nextReservations = await listReservations();
        setReservations(
          nextReservations.map((item) => mapReservationDtoToAppReservation(item, users))
        );
      },
      logout: () => {
        setUserEmailState('');
        window.localStorage.removeItem(SESSION_KEY);
        setUsers([]);
        setRooms([]);
        setReservations([]);
        setReservationLabels(DEFAULT_RESERVATION_LABELS);
      },
      changePassword: async (currentPassword, newPassword) => {
        await changePasswordApi({
          current_password: currentPassword,
          new_password: newPassword,
        });
      },
      addReservation: async (draft, roomId) => {
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
      },
      updateReservation: async (id, payload) => {
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
export type { AppReservation, AppRoom, AppUser, NewUserInput };

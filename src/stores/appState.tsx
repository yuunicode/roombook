/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ReservationDraft, ReservationStatus, TimetableReservation } from '../components';
import {
  changePassword as changePasswordApi,
  createReservationLabel as createReservationLabelApi,
  createCompanyUser,
  createReservation as createReservationApi,
  deleteCompanyUser as deleteCompanyUserApi,
  deleteReservationLabel as deleteReservationLabelApi,
  deleteReservation as deleteReservationApi,
  getCurrentUser,
  getReservationMinutes as getReservationMinutesApi,
  listCompanyUsers,
  listReservationLabels as listReservationLabelsApi,
  listRooms,
  listReservations,
  logout as logoutApi,
  setUserAdmin as setUserAdminApi,
  type LabelDto,
  type ReservationDto,
  type RoomDto,
  type UserDto,
  updateReservation as updateReservationApi,
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
  isAuthResolved: boolean;
  users: AppUser[];
  rooms: AppRoom[];
  reservations: AppReservation[];
  reservationLabels: string[];
  currentUser: AppUser | null;
  isCurrentUserAdmin: boolean;
  setSessionUser: (user: AppUser | null) => void;
  addUser: (user: NewUserInput) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  setUserAdmin: (userId: string, isAdmin: boolean) => Promise<void>;
  addReservationLabel: (name: string) => Promise<void>;
  renameReservationLabel: (oldName: string, newName: string) => Promise<void>;
  removeReservationLabel: (name: string) => Promise<void>;
  reloadReservations: () => Promise<void>;
  logout: () => Promise<void>;
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
  deleteReservation: (reservationId: string) => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

const DEFAULT_RESERVATION_LABELS = ['없음'];

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
    otherNotes: item.other_notes ?? '',
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

function mapUserDtoToAppUser(user: UserDto): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email.trim().toLowerCase(),
    department: user.department ?? '',
    isAdmin: Boolean(user.is_admin),
  };
}

function toIsoString(date: Date): string {
  return date.toISOString();
}

function isSameAttendees(a: AppUser[], b: AppUser[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

function isSameReservation(a: AppReservation, b: AppReservation): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.label === b.label &&
    a.start.getTime() === b.start.getTime() &&
    a.end.getTime() === b.end.getTime() &&
    a.externalAttendees === b.externalAttendees &&
    a.agenda === b.agenda &&
    a.meetingContent === b.meetingContent &&
    a.meetingResult === b.meetingResult &&
    a.otherNotes === b.otherNotes &&
    a.minutesAttachment === b.minutesAttachment &&
    a.creatorEmail === b.creatorEmail &&
    a.creatorName === b.creatorName &&
    a.roomId === b.roomId &&
    a.roomName === b.roomName &&
    isSameAttendees(a.attendees, b.attendees)
  );
}

function upsertReservation(prev: AppReservation[], next: AppReservation): AppReservation[] {
  const index = prev.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [next, ...prev];
  }
  if (isSameReservation(prev[index], next)) {
    return prev;
  }
  const copied = prev.slice();
  copied[index] = next;
  return copied;
}

function mergeReservationList(prev: AppReservation[], next: AppReservation[]): AppReservation[] {
  if (prev.length !== next.length) return next;
  const prevById = new Map(prev.map((item) => [item.id, item]));
  let changed = false;
  const merged = next.map((item) => {
    const current = prevById.get(item.id);
    if (!current) {
      changed = true;
      return item;
    }
    if (isSameReservation(current, item)) {
      return current;
    }
    changed = true;
    return item;
  });
  if (!changed) {
    for (let i = 0; i < prev.length; i += 1) {
      if (prev[i] !== merged[i]) {
        changed = true;
        break;
      }
    }
  }
  return changed ? merged : prev;
}

function AppStateProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUserState] = useState<AppUser | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [rooms, setRooms] = useState<AppRoom[]>([]);
  const [reservations, setReservations] = useState<AppReservation[]>([]);
  const [reservationLabels, setReservationLabels] = useState<string[]>(DEFAULT_RESERVATION_LABELS);
  const usersRef = useRef<AppUser[]>([]);

  const resetAppData = useCallback(() => {
    setUsers([]);
    setRooms([]);
    setReservations([]);
    setReservationLabels(DEFAULT_RESERVATION_LABELS);
  }, []);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const mapReservationWithCurrentUsers = useCallback((item: ReservationDto) => {
    return mapReservationDtoToAppReservation(item, usersRef.current);
  }, []);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const user = await getCurrentUser();
        if (!mounted) return;
        setAuthUserState(mapUserDtoToAppUser(user));
      } catch {
        if (!mounted) return;
        setAuthUserState(null);
        resetAppData();
      } finally {
        if (mounted) {
          setIsAuthResolved(true);
        }
      }
    };

    void restoreSession();

    return () => {
      mounted = false;
    };
  }, [resetAppData]);

  useEffect(() => {
    if (!authUser) {
      resetAppData();
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
        const mappedUsers = nextUsers.map(mapUserDtoToAppUser);
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
        resetAppData();
      }
    };

    void hydrate();
    return () => {
      mounted = false;
    };
  }, [authUser, resetAppData]);

  const addReservationAction = useCallback(
    async (draft: ReservationDraft, roomId: string) => {
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
        other_notes: draft.otherNotes,
        minutes_attachment: draft.minutesAttachment,
      });
      const mapped = mapReservationWithCurrentUsers(created);
      setReservations((prev) => upsertReservation(prev, mapped));
    },
    [mapReservationWithCurrentUsers]
  );

  const updateReservationAction = useCallback(
    async (id: string, payload: Omit<ReservationStatus, 'id' | 'creatorEmail'>) => {
      const updated = await updateReservationApi(id, {
        title: payload.title,
        label: payload.label,
        start_at: toIsoString(payload.start),
        end_at: toIsoString(payload.end),
        attendees: payload.attendees.map((attendee) => attendee.id),
        external_attendees: payload.externalAttendees,
        agenda: payload.agenda,
        meeting_content: payload.meetingContent,
        meeting_result: payload.meetingResult,
        other_notes: payload.otherNotes,
        minutes_attachment: payload.minutesAttachment,
      });
      const mapped = mapReservationWithCurrentUsers(updated);
      setReservations((prev) => upsertReservation(prev, mapped));
    },
    [mapReservationWithCurrentUsers]
  );

  const saveReservationMinutesAction = useCallback(
    async (id: string, payload: Omit<ReservationStatus, 'id' | 'creatorEmail' | 'creatorName'>) => {
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
        other_notes: payload.otherNotes,
        minutes_attachment: payload.minutesAttachment,
      });
      const mapped = mapReservationWithCurrentUsers(updated);
      setReservations((prev) => upsertReservation(prev, mapped));
      return mapped;
    },
    [mapReservationWithCurrentUsers]
  );

  const getReservationMinutesAction = useCallback(
    async (id: string) => {
      try {
        const result = await getReservationMinutesApi(id);
        const mapped = mapReservationWithCurrentUsers(result);
        setReservations((prev) => upsertReservation(prev, mapped));
        return mapped;
      } catch {
        return null;
      }
    },
    [mapReservationWithCurrentUsers]
  );

  const reloadReservationsAction = useCallback(async () => {
    const nextReservations = await listReservations();
    const mapped = nextReservations.map(mapReservationWithCurrentUsers);
    setReservations((prev) => mergeReservationList(prev, mapped));
  }, [mapReservationWithCurrentUsers]);

  const deleteReservationAction = useCallback(async (id: string) => {
    await deleteReservationApi(id);
    setReservations((prev) => prev.filter((reservation) => reservation.id !== id));
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({
      userEmail: authUser?.email ?? '',
      isLoggedIn: Boolean(authUser),
      isAuthResolved,
      users,
      rooms,
      reservations,
      reservationLabels,
      currentUser: authUser
        ? (users.find((user) => user.email.toLowerCase() === authUser.email.toLowerCase()) ??
          authUser)
        : null,
      isCurrentUserAdmin: authUser
        ? (users.find((user) => user.email.toLowerCase() === authUser.email.toLowerCase())
            ?.isAdmin ?? authUser.isAdmin)
        : false,
      setSessionUser: (user) => {
        setAuthUserState(user ? { ...user, email: user.email.trim().toLowerCase() } : null);
        if (!user) {
          resetAppData();
        }
        setIsAuthResolved(true);
      },
      addUser: async (user) => {
        const payload = {
          id: user.id,
          name: user.name,
          department: user.department,
        };
        await createCompanyUser(payload);
        const nextUsers = await listCompanyUsers();
        setUsers(nextUsers.map(mapUserDtoToAppUser));
      },
      removeUser: async (userId) => {
        await deleteCompanyUserApi(userId);
        const nextUsers = await listCompanyUsers();
        setUsers(nextUsers.map(mapUserDtoToAppUser));
      },
      setUserAdmin: async (userId, isAdmin) => {
        await setUserAdminApi(userId, isAdmin);
        const nextUsers = await listCompanyUsers();
        setUsers(nextUsers.map(mapUserDtoToAppUser));
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
        const mapped = nextReservations.map((item) =>
          mapReservationDtoToAppReservation(item, users)
        );
        setReservations((prev) => mergeReservationList(prev, mapped));
      },
      removeReservationLabel: async (name) => {
        await deleteReservationLabelApi(name);
        const [nextLabels, nextReservations] = await Promise.all([
          listReservationLabelsApi(),
          listReservations(),
        ]);
        const labelNames = nextLabels.map((item) => item.name).filter((item) => item.trim());
        setReservationLabels(labelNames.length > 0 ? labelNames : DEFAULT_RESERVATION_LABELS);
        const mapped = nextReservations.map((item) =>
          mapReservationDtoToAppReservation(item, users)
        );
        setReservations((prev) => mergeReservationList(prev, mapped));
      },
      reloadReservations: reloadReservationsAction,
      logout: async () => {
        setAuthUserState(null);
        resetAppData();
        setIsAuthResolved(true);
        try {
          await logoutApi();
        } catch {
          // Ignore logout API failure after clearing local auth state.
        }
      },
      changePassword: async (currentPassword, newPassword) => {
        await changePasswordApi({
          current_password: currentPassword,
          new_password: newPassword,
        });
      },
      addReservation: addReservationAction,
      updateReservation: updateReservationAction,
      saveReservationMinutes: saveReservationMinutesAction,
      getReservationMinutes: getReservationMinutesAction,
      deleteReservation: deleteReservationAction,
    }),
    [
      addReservationAction,
      authUser,
      deleteReservationAction,
      getReservationMinutesAction,
      isAuthResolved,
      reloadReservationsAction,
      reservationLabels,
      reservations,
      resetAppData,
      rooms,
      saveReservationMinutesAction,
      updateReservationAction,
      users,
    ]
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

"use client";

import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";

export type UserRole = "CLIENT" | "FREELANCER" | null;

interface AuthRoleStore {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  clearUserRole: () => void;
  setRoleSelectorModalOpen: (isOpen: boolean) => void;
  roleSelectorModalOpen: boolean;
}

export type Screen =
  | "overview"
  | "skills_and_expertise"
  | "education"
  | "work_experience"
  | "links"
  | "kyc";

const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(name);
    }
    return null;
  },
  setItem: (name, value) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(name, value);
    }
  },
  removeItem: (name) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(name);
    }
  },
};

export const useAuthRoleStore = create<AuthRoleStore>()(
  persist(
    (set) => ({
      userRole: null,
      roleSelectorModalOpen: false,

      setUserRole: (role) =>
        set({
          userRole: role,
        }),

      clearUserRole: () =>
        set({
          userRole: null,
        }),

      setRoleSelectorModalOpen: (isOpen) =>
        set({
          roleSelectorModalOpen: isOpen,
        }),
    }),
    {
      name: "auth-role-storage",
      storage: createJSONStorage(() => safeLocalStorage),
    },
  ),
);

export const useCurrentScreenStore = create<{
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
}>()(
  persist(
    (set) => ({
      currentScreen: "overview",

      setCurrentScreen: (screen) =>
        set({
          currentScreen: screen,
        }),
    }),
    {
      name: "current-screen-storage", // localStorage key
      storage: createJSONStorage(() => safeLocalStorage),
    },
  ),
);

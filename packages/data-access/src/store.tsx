"use client";
import React, { useRef } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { Provider } from "react-redux";
import { createApiReducer, type ApiServices } from "./api";

/**
 * Creates a Redux store bound to the given API instance plus a `StoreProvider`
 * component. The store is instantiated lazily and only once per provider mount
 * (per-request safe for SSR).
 */
export function createStoreProvider(apiServices: ApiServices) {
  const makeStore = () =>
    configureStore({
      reducer: createApiReducer(apiServices),
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
        }).concat(apiServices.middleware),
    });

  function StoreProvider({ children }: { children: React.ReactNode }) {
    const storeRef = useRef<ReturnType<typeof makeStore> | null>(null);

    if (!storeRef.current) {
      storeRef.current = makeStore();
      setupListeners(storeRef.current.dispatch);
    }

    return <Provider store={storeRef.current}>{children}</Provider>;
  }

  return { makeStore, StoreProvider };
}

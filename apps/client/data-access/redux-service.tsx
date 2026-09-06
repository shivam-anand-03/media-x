"use client";
import { createStoreProvider } from "@workspace/data-access/store";
import ApiServices from "./api";

const { makeStore, StoreProvider } = createStoreProvider(ApiServices);

export { makeStore, StoreProvider };

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

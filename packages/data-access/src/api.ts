import { combineReducers } from "@reduxjs/toolkit";
import { createApi } from "@reduxjs/toolkit/query/react";
import { createBaseQueryWithReauth, type BaseQueryConfig } from "./base-query";

export interface ApiServicesConfig extends BaseQueryConfig {
  /**
   * Cache tag types used by `providesTags` / `invalidatesTags` across the
   * injected endpoints. Each consuming app supplies its own set.
   */
  tagTypes?: readonly string[];
  /** Redux slice key for this API. Defaults to `"api"`. */
  reducerPath?: string;
}

/**
 * Creates an empty RTK Query API instance wired to the shared re-auth base
 * query. Feature modules extend it with `apiServices.injectEndpoints(...)`.
 *
 * Each app calls this once and shares the returned singleton, so endpoint
 * injection keeps working exactly as before — only the configuration (base
 * URL, tag types, logout behaviour) now lives at the call site.
 */
export function createApiServices(config: ApiServicesConfig) {
  const { tagTypes = [], reducerPath = "api", ...baseQueryConfig } = config;

  return createApi({
    reducerPath,
    baseQuery: createBaseQueryWithReauth(baseQueryConfig),
    endpoints: () => ({}),
    tagTypes: [...tagTypes],
  });
}

export type ApiServices = ReturnType<typeof createApiServices>;

/** Combines a single API instance's reducer under its `reducerPath`. */
export function createApiReducer(
  apiServices: Pick<ApiServices, "reducerPath" | "reducer">,
) {
  return combineReducers({
    [apiServices.reducerPath]: apiServices.reducer,
  });
}

import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface BaseQueryConfig {
  /** Base URL prepended to every request. */
  baseUrl: string;
  /** Whether to send credentials (cookies). Defaults to `"include"`. */
  credentials?: RequestCredentials;
  /** Mutate outgoing request headers. */
  prepareHeaders?: (headers: Headers) => Headers | Promise<Headers>;
}

/**
 * The shared RTK Query base query.
 *
 * The API is unauthenticated, so this is a thin wrapper over
 * `fetchBaseQuery` — there is no token to refresh and no session to tear down.
 */
export function createBaseQuery(
  config: BaseQueryConfig,
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  const {
    baseUrl,
    credentials = "include",
    prepareHeaders = (headers) => headers,
  } = config;

  return fetchBaseQuery({ baseUrl, credentials, prepareHeaders });
}

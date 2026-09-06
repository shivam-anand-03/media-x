import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";

export interface BaseQueryConfig {
  /** Base URL prepended to every request. */
  baseUrl: string;
  /**
   * Endpoint called to refresh the access token when a request fails with a
   * `TOKEN_EXPIRED` 401/498. Defaults to `/auth/refresh/token`.
   */
  refreshUrl?: string;
  /**
   * Invoked when the session cannot be recovered (refresh failed, or a
   * non-`TOKEN_EXPIRED` auth error occurred). Put app-specific teardown here —
   * e.g. hitting a logout endpoint, clearing storage, redirecting to sign-in.
   */
  onUnauthorized?: () => void | Promise<void>;
  /** Whether to send credentials (cookies). Defaults to `"include"`. */
  credentials?: RequestCredentials;
  /** Mutate outgoing request headers. */
  prepareHeaders?: (headers: Headers) => Headers | Promise<Headers>;
}

export function createBaseQueryWithReauth(
  config: BaseQueryConfig,
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  const {
    baseUrl,
    refreshUrl = "/auth/refresh/token",
    onUnauthorized,
    credentials = "include",
    prepareHeaders = (headers) => headers,
  } = config;

  const mutex = new Mutex();

  const baseQuery = fetchBaseQuery({
    baseUrl,
    credentials,
    prepareHeaders,
  });

  return async (args, api, extraOptions) => {
    await mutex.waitForUnlock();
    let result = await baseQuery(args, api, extraOptions);

    if (
      result.error &&
      (result.error.status === 401 || result.error.status === 498)
    ) {
      const errorData = result.error.data as
        | { error?: string; details?: { error?: string } }
        | undefined;

      if (
        errorData?.error === "TOKEN_EXPIRED" ||
        errorData?.details?.error === "TOKEN_EXPIRED"
      ) {
        if (!mutex.isLocked()) {
          const release = await mutex.acquire();

          try {
            const refreshResult = await baseQuery(
              {
                url: refreshUrl,
                method: "POST",
              },
              api,
              extraOptions,
            );

            if (refreshResult.data) {
              result = await baseQuery(args, api, extraOptions);
            } else {
              await onUnauthorized?.();
            }
          } finally {
            release();
          }
        } else {
          await mutex.waitForUnlock();
          result = await baseQuery(args, api, extraOptions);
        }
      } else {
        await onUnauthorized?.();
      }
    }

    if (result.error && result.error.status === 403) {
      console.warn("Access forbidden:", result.error);
    }

    return result;
  };
}

"use client";
import { toast } from "sonner";

export const useResponseHandler = () => {
  const handleApiResponse = async <T>(
    apiCall: () => Promise<T>,
    options?: {
      onSuccess?: (data: T) => void;
      onError?: (error: any) => void;
      successMessage?: string;
      errorMessage?: string;
    },
  ) => {
    try {
      const result = await apiCall();
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
      options?.onSuccess?.(result);
      return result;
    } catch (error: any) {
      const msg =
        options?.errorMessage ||
        error?.data?.message ||
        error?.message ||
        "Something went wrong";
      toast.error(msg);
      options?.onError?.(error);
      throw error;
    }
  };

  return { handleApiResponse };
};

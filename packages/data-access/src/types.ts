export interface ApiResponse<T = undefined> {
  code: number;
  status: "success" | "failed";
  message: string;
  data?: T;
}

export type GenericApiResponse = ApiResponse<null>;

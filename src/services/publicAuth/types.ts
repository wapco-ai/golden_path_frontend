export interface UserDTO {
  id: number;
  phone: string;
  fullName?: string;
  email?: string;
  nationalId?: string;
  gender?: string | null;
  birthDate?: string | null;
  address?: Record<string, unknown> | null;
  preferences?: Record<string, unknown> | null;
  avatarUrl?: string | null;
  profileCompleted?: boolean;
  roles?: string[];
  level?: string | null;
}

export interface AuthTokensDTO {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user?: UserDTO;
}

export interface ApiErrorDTO {
  message?: string;
  code?: string;
  errors?: Record<string, string[] | string>;
}

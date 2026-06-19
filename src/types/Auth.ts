export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: "admin" | "user";
  createdAt: string;
}

export interface AuthState {
  currentUser: Omit<User, "password"> | null;
  isAuthenticated: boolean;
}
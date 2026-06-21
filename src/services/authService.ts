
export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: "admin" | "user" | "guest";
  createdAt: string;
}

export type AuthRole = User["role"];
export type CurrentUser = Omit<User, "password">;

const USERS_KEY = "app_users";
const CURRENT_USER_KEY = "current_user";

export const getUsers = (): User[] => {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
};

// Seed admin default — dipanggil SETELAH getUsers didefinisikan
const seedAdmin = () => {
  const users = getUsers();
  const adminExists = users.find((u) => u.role === "admin");
  if (!adminExists) {
    const admin: User = {
      id: "admin-001",
      username: "admin",
      email: "admin@admin.com",
      password: "admin123",
      role: "admin",
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(USERS_KEY, JSON.stringify([admin]));
  }
};

// Jalankan seed saat file pertama kali diload
seedAdmin();

export const register = (
  username: string,
  email: string,
  password: string
): { success: boolean; message: string } => {
  const users = getUsers();
  const exists = users.find((u) => u.email === email);
  if (exists) return { success: false, message: "Email sudah terdaftar!" };

  const newUser: User = {
    id: `user-${Date.now()}`,
    username,
    email,
    password,
    role: "user",
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));
  return { success: true, message: "Registrasi berhasil!" };
};

export const login = (
  email: string,
  password: string
): { success: boolean; message: string; role?: AuthRole } => {
  const users = getUsers();
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) return { success: false, message: "Email atau password salah!" };

  const safeUser: CurrentUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
  return { success: true, message: "Login berhasil!", role: user.role };
};

export const loginAsGuest = (): { success: boolean; message: string; role: "guest" } => {
  const now = new Date().toISOString();
  const guestUser: CurrentUser = {
    id: `guest-${Date.now()}`,
    username: "Guest",
    email: "guest@local",
    role: "guest",
    createdAt: now,
  };

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(guestUser));
  return { success: true, message: "Masuk sebagai guest berhasil!", role: "guest" };
};

export const logout = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): CurrentUser | null => {
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? JSON.parse(data) : null;
};

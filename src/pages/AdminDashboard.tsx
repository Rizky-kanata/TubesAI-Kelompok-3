// src/pages/AdminDashboard.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout, getUsers } from "../services/authService";

interface UserData {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);

  useEffect(() => {
    const allUsers = getUsers();
    setUsers(allUsers);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>👨‍💼 Admin Dashboard</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: "0.5rem 1rem",
            background: "#e74c3c",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          🚪 Logout
        </button>
      </div>

      <h2>Daftar Pengguna Terdaftar</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#2c3e50", color: "white" }}>
            <th style={th}>No</th>
            <th style={th}>Username</th>
            <th style={th}>Email</th>
            <th style={th}>Role</th>
            <th style={th}>Tanggal Daftar</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={user.id} style={{ background: index % 2 === 0 ? "#f9f9f9" : "white" }}>
              <td style={td}>{index + 1}</td>
              <td style={td}>{user.username}</td>
              <td style={td}>{user.email}</td>
              <td style={td}>
                <span style={{
                  padding: "2px 10px",
                  borderRadius: "12px",
                  background: user.role === "admin" ? "#e74c3c" : "#3498db",
                  color: "white",
                  fontSize: "0.8rem"
                }}>
                  {user.role}
                </span>
              </td>
              <td style={td}>{new Date(user.createdAt).toLocaleDateString("id-ID")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <p style={{ textAlign: "center", color: "#999" }}>Belum ada pengguna terdaftar.</p>
      )}
    </div>
  );
}

// Style helper
const th: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontWeight: "bold",
};

const td: React.CSSProperties = {
  padding: "10px 16px",
  borderBottom: "1px solid #eee",
};

export default AdminDashboard;
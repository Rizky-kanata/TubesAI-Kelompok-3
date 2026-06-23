import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../services/authService";

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRegister = () => {
    if (!form.username || !form.email || !form.password) {
      setIsSuccess(false);
      setMessage("Semua field harus diisi!");
      return;
    }
    const result = register(form.username, form.email, form.password);
    setIsSuccess(result.success);
    setMessage(result.message);
    if (result.success) setTimeout(() => navigate("/login"), 1500);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <img src="/logossc.png" alt="Logo" style={styles.logo}/>
        </div>

        <h2 style={styles.title}>Register PROSA</h2>
        <p style={styles.subtitle}>Daftar untuk menggunakan chatbot Layanan Administrasi UKM dan Ormawa</p>

        {message && (
          <div style={isSuccess ? styles.successBox : styles.errorBox}>
            {isSuccess ? "✅" : "⚠️"} {message}
          </div>
        )}

        <div style={styles.inputGroup}>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            placeholder="Nama pengguna"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            onFocus={(e) => (e.target.style.borderColor = "#6c63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="contoh@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onFocus={(e) => (e.target.style.borderColor = "#6c63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="Minimal 6 karakter"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onFocus={(e) => (e.target.style.borderColor = "#6c63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
          />
        </div>

        <button
          style={styles.button}
          onClick={handleRegister}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#574fd6")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#6c63ff")}
        >
          Daftar Sekarang →
        </button>

        <p style={styles.footerText}>
          Sudah punya akun?{" "}
          <Link to="/login" style={styles.link}>
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "1rem",
  },
  card: {
    background: "linear-gradient(135deg, #f3174e 0%, #670010 100%, #670010 100%)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "24px",
    padding: "2.5rem",
    width: "100%",
    maxWidth: "450px",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.4)",
  },
  iconWrapper: {
    textAlign: "center",
  },

  title: {
    color: "#ffffff",
    fontSize: "1.8rem",
    fontWeight: 700,
    textAlign: "center",
    margin: "0 0 0.1rem 0",
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    fontSize: "0.9rem",
    marginBottom: "1 rem",
  },
  errorBox: {
    background: "rgba(231, 76, 60, 0.15)",
    border: "1px solid rgba(231, 76, 60, 0.4)",
    color: "#ff6b6b",
    borderRadius: "10px",
    padding: "0.75rem 1rem",
    fontSize: "0.85rem",
    marginBottom: "1rem",
  },
  successBox: {
    background: "rgba(46, 213, 115, 0.15)",
    border: "1px solid rgba(46, 213, 115, 0.4)",
    color: "#2ed573",
    borderRadius: "10px",
    padding: "0.75rem 1rem",
    fontSize: "0.85rem",
    marginBottom: "1rem",
  },
  inputGroup: {
    marginBottom: "1.2rem",
  },
  label: {
    display: "block",
    color: "rgba(255,255,255,0.7)",
    fontSize: "0.85rem",
    marginBottom: "0.4rem",
    fontWeight: 500,
  },
  input: {
    width: "100%",
    padding: "0.8rem 1rem",
    borderRadius: "12px",
    border: "1px solid #0e0c0c",
    color: "#0e0c0c",
    fontSize: "0.95rem",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "0.9rem",
    background: "#6c63ff",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
    marginTop: "0.5rem",
    marginBottom: "1.2rem",
  },
  footerText: {
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    fontSize: "0.9rem",
    margin: 0,
  },
  link: {
    color: "#6c63ff",
    textDecoration: "none",
    fontWeight: 600,
  },
};

export default Register;

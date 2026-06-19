import { Navigate } from "react-router-dom";
import { getCurrentUser } from "../services/authService";

interface Props {
  children: React.ReactNode;
  allowedRole?: "admin" | "user";
}

const ProtectedRoute = ({ children, allowedRole }: Props) => {
  const user = getCurrentUser();

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole)
    return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
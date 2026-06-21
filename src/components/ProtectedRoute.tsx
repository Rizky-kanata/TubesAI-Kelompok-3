import { Navigate } from "react-router-dom";
import { getCurrentUser, type AuthRole } from "../services/authService";

interface Props {
  children: React.ReactNode;
  allowedRole?: AuthRole;
  allowedRoles?: AuthRole[];
}

const ProtectedRoute = ({ children, allowedRole, allowedRoles }: Props) => {
  const user = getCurrentUser();
  const roles = allowedRoles || (allowedRole ? [allowedRole] : null);

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;

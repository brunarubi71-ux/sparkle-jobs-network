import { Navigate } from "react-router-dom";

// Legacy route — admin login is now consolidated into /auth.
// Anyone landing here is redirected to the unified auth page.
export default function AdminLogin() {
  return <Navigate to="/auth" replace />;
}

import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import { AuthContext } from "../contexts/AuthContext";

type Props = {
  children: JSX.Element;
};

export default function PrivateRoute({ children }: Props) {
  const { loading, isAuthenticated, user } = useContext(AuthContext);

  // while auth initializes, show spinner to avoid flash redirect
  if (loading) {
    return (
      <Box sx={{ width: "100%", height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // Prefer isAuthenticated if available, fallback to "user"
  const auth = typeof isAuthenticated !== "undefined" ? isAuthenticated : Boolean(user);

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
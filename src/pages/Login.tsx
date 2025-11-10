import React, { useState, useContext } from "react";
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Checkbox, FormControlLabel, IconButton, InputAdornment, Alert
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { saveToken, setUser, setCompany } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const valid = email.trim() && password.trim().length >= 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!valid) return;

    setLoading(true);
    try {
      const res = await api.post("/Auth/Login", {
        email: email.trim(),
        password: password.trim(),
        rememberMe: remember,
      });
      const { token, user, company } = res.data;
      saveToken(token, remember);
      setUser(user);
      setCompany(company);
      navigate("/invoices");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) setError("Email or password is wrong.");
      else setError(err?.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      {/* Header */}
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
        {/* <img src="/logo.svg" alt="" style={{ height: 24, verticalAlign: "middle", marginRight: 6 }} /> */}
        InvoiceApp
      </Typography>

      {/* Card */}
      <Card sx={{ width: "100%", maxWidth: 400, boxShadow: 3, borderRadius: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" align="center" sx={{ mb: 0.5, fontWeight: 600 }}>
            Welcome Back
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            Log in to your account.
          </Typography>

          <form onSubmit={submit}>
            <TextField
              label="Email Address*"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password*"
              type={showPw ? "text" : "password"}
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw(p => !p)} edge="end">
                      {showPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <FormControlLabel
              control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
              label="Remember me"
              sx={{ mt: 1 }}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2, mb: 1 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={!valid || loading}
              sx={{ mt: 2, mb: 1, py: 1.2, fontWeight: 600 }}
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <Typography align="center" variant="body2" sx={{ mt: 1 }}>
            <Link to="/signup" style={{ textDecoration: "none" }}>
              Create account
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
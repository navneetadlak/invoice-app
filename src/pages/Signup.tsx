import React, { useContext, useState } from "react";
import {
  Box, Card, CardContent, TextField, Button, Typography, Grid,
  IconButton, InputAdornment, LinearProgress, FormHelperText
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { AuthService } from "../services/auth.service";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const ZIP_LENGTH = 5;

const passwordStrength = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score += 30;
  if (/[A-Z]/.test(pw)) score += 20;
  if (/[0-9]/.test(pw)) score += 20;
  if (/[^A-Za-z0-9]/.test(pw)) score += 30;
  return Math.min(100, score);
};

export default function Signup() {
  const { saveToken, setUser, setCompany } = useContext(AuthContext);
  const nav = useNavigate();

  const [form, setForm] = useState({
    FirstName: "",
    LastName: "",
    Email: "",
    Password: "",
    CompanyName: "",
    Address: "",
    City: "",
    Zip: "",
    Industry: "",
    CurrencySymbol: ""
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "" }));
  };

  const handleLogo = (f: File | null) => {
    if (!f) { setLogo(null); setPreview(null); return; }
    if (!["image/png", "image/jpeg"].includes(f.type)) {
      setErrors(e => ({ ...e, Logo: "Only PNG/JPG allowed." }));
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErrors(e => ({ ...e, Logo: "Max file size 5 MB." }));
      return;
    }
    setLogo(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleZipInput = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    const capped = digitsOnly.slice(0, ZIP_LENGTH);
    handleChange("Zip", capped);
  };

  const onZipPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    const digits = text.replace(/\D/g, "").slice(0, ZIP_LENGTH);
    // if pasted text would produce different value, prevent default and set controlled value
    if (digits !== text || digits.length > ZIP_LENGTH) {
      e.preventDefault();
      handleZipInput(digits);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.FirstName.trim()) e.FirstName = "Please enter your first name.";
    if (!form.LastName.trim()) e.LastName = "Please enter your last name.";
    if (!form.Email.trim()) e.Email = "Enter a valid email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.Email))
      e.Email = "Enter a valid email address.";
    if (!form.Password || form.Password.length < 8 ||
      !/[A-Za-z]/.test(form.Password) || !/[0-9]/.test(form.Password))
      e.Password = "Password must be at least 8 characters with letters + numbers.";
    if (!form.CompanyName.trim()) e.CompanyName = "Please enter your company name.";
    if (!form.Address.trim()) e.Address = "Please enter company address.";
    if (!form.City.trim()) e.City = "Please enter city.";

    const zipRegex = new RegExp(`^\\d{${ZIP_LENGTH}}$`);
    if (!zipRegex.test(form.Zip))
      e.Zip = `Zip must be exactly ${ZIP_LENGTH} digits.`;

    if (!form.CurrencySymbol.trim())
      e.CurrencySymbol = "Enter a valid currency symbol.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) {
      fd.append(k, String(v ?? ""));
    }
    if (logo) fd.append("logo", logo);

    setLoading(true);
    try {
      const res = await AuthService.signup(fd);
      const { token, user, company } = res.data;
      saveToken(token, true);
      setUser(user);
      setCompany(company);
      nav("/invoices");
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.errors) {
        const mapped: Record<string, string> = {};
        for (const k of Object.keys(data.errors)) {
          mapped[k] = Array.isArray(data.errors[k]) ? data.errors[k][0] : String(data.errors[k]);
        }
        setErrors(mapped);
      } else if (data?.message) {
        setErrors({ _global: String(data.message) });
      } else {
        setErrors({ _global: "Signup failed. Please check details." });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" justifyContent="center" sx={{ py: 6, minHeight: "100vh" }}>
      <Card sx={{ width: 950, borderRadius: 2, boxShadow: 3 }}>
        <CardContent>
          <Typography variant="h4" align="center">Create Your Account</Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            Set up your company and start invoicing in minutes.
          </Typography>

          <Grid container spacing={3}>
            {/* User Information */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>User Information</Typography>
              <TextField label="First Name*" fullWidth margin="dense"
                value={form.FirstName} onChange={e => handleChange("FirstName", e.target.value)}
                error={!!errors.FirstName} helperText={errors.FirstName} />
              <TextField label="Last Name*" fullWidth margin="dense"
                value={form.LastName} onChange={e => handleChange("LastName", e.target.value)}
                error={!!errors.LastName} helperText={errors.LastName} />
              <TextField label="Email Address*" fullWidth margin="dense"
                value={form.Email} onChange={e => handleChange("Email", e.target.value)}
                error={!!errors.Email} helperText={errors.Email} />
              <TextField
                label="Password*" fullWidth margin="dense"
                type={showPw ? "text" : "password"}
                value={form.Password}
                onChange={e => handleChange("Password", e.target.value)}
                error={!!errors.Password}
                helperText={errors.Password}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPw(p => !p)}>
                        {showPw ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <LinearProgress
                variant="determinate"
                value={passwordStrength(form.Password)}
                sx={{ height: 6, borderRadius: 1, mt: 1 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>Company Information</Typography>
              <TextField label="Company Name*" fullWidth margin="dense"
                value={form.CompanyName}
                onChange={e => handleChange("CompanyName", e.target.value)}
                error={!!errors.CompanyName} helperText={errors.CompanyName} />

              {/* Logo upload */}
              <Box display="flex" alignItems="center" gap={2} mt={1}>
                <Box sx={{
                  width: 72, height: 72, border: "1px dashed grey",
                  display: "flex", justifyContent: "center", alignItems: "center",
                  borderRadius: 1, overflow: "hidden"
                }}>
                  {preview ? (
                    <img src={preview} alt="logo" style={{ maxWidth: "70px", maxHeight: "70px" }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">Logo</Typography>
                  )}
                </Box>
                <Box>
                  <Button variant="outlined" component="label">
                    Choose Logo
                    <input hidden accept="image/png,image/jpeg"
                      type="file" onChange={e => handleLogo(e.target.files?.[0] ?? null)} />
                  </Button>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Max 2–5 MB
                  </Typography>
                  {errors.Logo && <FormHelperText error>{errors.Logo}</FormHelperText>}
                </Box>
              </Box>

              <TextField label="Address*" fullWidth margin="dense" multiline rows={3}
                value={form.Address}
                onChange={e => handleChange("Address", e.target.value)}
                error={!!errors.Address} helperText={errors.Address} sx={{ mt: 2 }} />

              <Box display="flex" gap={2}>
                <TextField label="City*" fullWidth margin="dense"
                  value={form.City}
                  onChange={e => handleChange("City", e.target.value)}
                  error={!!errors.City} helperText={errors.City} />
                <TextField
                  label={`Zip Code*`}
                  fullWidth
                  margin="dense"
                  value={form.Zip}
                  onChange={e => handleZipInput(e.target.value)}
                  onPaste={onZipPaste}
                  inputProps={{ maxLength: ZIP_LENGTH, inputMode: "numeric", pattern: "[0-9]*" }}
                  type="text"
                  error={!!errors.Zip}
                  helperText={errors.Zip || `${ZIP_LENGTH} digit zip code`}
                />
              </Box>

              <TextField label="Industry" fullWidth margin="dense"
                value={form.Industry}
                onChange={e => handleChange("Industry", e.target.value)}
                error={!!errors.Industry} helperText={errors.Industry} />
              <TextField label="Currency Symbol*" fullWidth margin="dense"
                value={form.CurrencySymbol}
                onChange={e => handleChange("CurrencySymbol", e.target.value)}
                error={!!errors.CurrencySymbol}
                helperText={errors.CurrencySymbol || "$, ₹, €, AED"} />
            </Grid>
          </Grid>

          {/* Footer actions */}
          <Box
            sx={{
              borderTop: 1, borderColor: "divider", mt: 4, pt: 2,
              display: "flex", justifyContent: "space-between", flexWrap: "wrap"
            }}
          >
            <Typography variant="body2" sx={{ mb: { xs: 2, md: 0 } }}>
              Already have an account? <Link to="/login">Login</Link>
            </Typography>
            <Button
              variant="contained"
              onClick={submit}
              disabled={loading}
              sx={{ minWidth: 160 }}
            >
              {loading ? "Signing Up…" : "Sign Up"}
            </Button>
          </Box>

          {errors._global && (
            <Typography color="error" sx={{ mt: 1 }}>{errors._global}</Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
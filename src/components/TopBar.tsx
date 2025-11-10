import { useContext } from "react";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export default function TopBar() {
  const { user, company, logout } = useContext(AuthContext);

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ mr: 2 }}>
          Invoicing App
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Button color="inherit" component={RouterLink} to="/invoices">Invoices</Button>
          <Button color="inherit" component={RouterLink} to="/items">Items</Button>
        </Box>
        <Box>
          {company && <Typography variant="body2" sx={{ mr: 2, display: "inline" }}>{company.companyName}</Typography>}
          {user ? (
            <Button color="inherit" onClick={logout}>Logout</Button>
          ) : (
            <Button color="inherit" component={RouterLink} to="/login">Login</Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

import React, { useContext } from "react";
import {
    AppBar,
    Box,
    Toolbar,
    Typography,
    Button,
    IconButton,
    Menu,
    MenuItem,
    useTheme,
    useMediaQuery,
    Drawer,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
    Avatar,
    Chip
} from "@mui/material";
import {
    Menu as MenuIcon,
    Dashboard as DashboardIcon,
    Receipt as InvoiceIcon,
    Inventory as ItemsIcon,
    AccountCircle,
    ExitToApp,
    Business
} from "@mui/icons-material";
import { useNavigate, Link as RouterLink, useLocation } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const { logout, user, company } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const [userMenuAnchor, setUserMenuAnchor] = React.useState<null | HTMLElement>(null);
    const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

    const handleLogout = () => {
        logout();
        navigate("/login");
        setUserMenuAnchor(null);
        setMobileDrawerOpen(false);
    };

    const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setUserMenuAnchor(event.currentTarget);
    };

    const handleMenuClose = () => {
        setUserMenuAnchor(null);
    };

    const toggleDrawer = (open: boolean) => () => {
        setMobileDrawerOpen(open);
    };

    const navigationItems = [
        { path: "/invoices", label: "Invoices", icon: <InvoiceIcon /> },
        { path: "/items", label: "Items", icon: <ItemsIcon /> },
    ];

    // Mobile Drawer Content
    const drawerContent = (
        <Box sx={{ width: 280, p: 2 }}>
            {/* User Info Section */}
            {/* <Box sx={{ p: 2, textAlign: "center" }}>
        <Avatar
          sx={{
            width: 64,
            height: 64,
            mx: "auto",
            mb: 2,
            bgcolor: "primary.main",
            fontSize: "1.5rem"
          }}
        >
          {(user?.firstName?.[0] ?? "U").toUpperCase()}
        </Avatar>
        <Typography variant="h6" noWrap>
          {user ? `${user.firstName ?? ""} ${user.lastName ?? ""}` : "User"}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {company?.companyName ?? ""}
        </Typography>
        <Chip
          label="Active"
          size="small"
          color="success"
          sx={{ mt: 1 }}
        />
      </Box> */}

            <Divider sx={{ my: 2 }} />

            {/* Navigation Items */}
            <List>
                {navigationItems.map((item) => (
                    <ListItem
                        key={item.path}
                        component={RouterLink}
                        to={item.path}
                        onClick={toggleDrawer(false)}
                        sx={{
                            borderRadius: 1,
                            mb: 0.5,
                            backgroundColor: location.pathname === item.path ? "primary.light" : "transparent",
                            color: location.pathname === item.path ? "primary.contrastText" : "text.primary",
                            "&:hover": {
                                backgroundColor: location.pathname === item.path ? "primary.main" : "action.hover",
                            },
                        }}
                    >
                        <ListItemIcon sx={{
                            color: location.pathname === item.path ? "primary.contrastText" : "text.secondary"
                        }}>
                            {item.icon}
                        </ListItemIcon>
                        <ListItemText primary={item.label} />
                    </ListItem>
                ))}
            </List>

            <Divider sx={{ my: 2 }} />

            {/* Footer Actions */}
            <Box sx={{ p: 1 }}>
                <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<ExitToApp />}
                    onClick={handleLogout}
                    sx={{ justifyContent: "flex-start" }}
                >
                    Logout
                </Button>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            {/* Header */}
            <AppBar
                position="sticky"
                elevation={2}
                sx={{
                    bgcolor: "background.paper",
                    color: "text.primary",
                    borderBottom: 1,
                    borderColor: "divider"
                }}
            >
                <Toolbar sx={{ justifyContent: "space-between", px: { xs: 1, sm: 2 } }}>
                    {/* Left Section - Logo and Navigation */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        {/* Mobile Menu Button */}
                        {isMobile && (
                            <IconButton
                                edge="start"
                                aria-label="open menu"
                                onClick={toggleDrawer(true)}
                                sx={{ color: "primary.main" }}
                            >
                                <MenuIcon />
                            </IconButton>
                        )}

                        {/* Logo */}
                        <Typography
                            variant="h5"
                            component={RouterLink}
                            to="/invoices"
                            sx={{
                                color: "primary.main",
                                textDecoration: "none",
                                fontWeight: "bold",
                                display: "flex",
                                alignItems: "center",
                                gap: 1
                            }}
                        >
                            <Business sx={{ fontSize: 28 }} />
                            InvoiceApp
                        </Typography>

                        {/* Desktop Navigation */}
                        {!isMobile && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 2 }}>
                                {navigationItems.map((item) => (
                                    <Button
                                        key={item.path}
                                        component={RouterLink}
                                        to={item.path}
                                        startIcon={item.icon}
                                        sx={{
                                            color: location.pathname === item.path ? "primary.main" : "text.primary",
                                            borderBottom: location.pathname === item.path ? 2 : 0,
                                            borderColor: "primary.main",
                                            borderRadius: 0,
                                            "&:hover": {
                                                backgroundColor: "action.hover",
                                            },
                                        }}
                                    >
                                        {item.label}
                                    </Button>
                                ))}
                            </Box>
                        )}
                    </Box>

                    {/* Right Section - User Info */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        {/* User Info - Desktop */}
                        {!isMobile && (
                            <>
                                <Box sx={{ textAlign: "right" }}>
                                    <Typography variant="subtitle2" noWrap>
                                        {user ? `${user.firstName ?? ""} ${user.lastName ?? ""}` : ""}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                        {company?.companyName ?? ""}
                                    </Typography>
                                </Box>
                                <IconButton
                                    onClick={handleUserMenuOpen}
                                    sx={{
                                        border: 1,
                                        borderColor: "divider",
                                        bgcolor: "background.default"
                                    }}
                                >
                                    <AccountCircle />
                                </IconButton>
                            </>
                        )}

                        {/* Mobile User Menu */}
                        {isMobile && (
                            <IconButton onClick={handleUserMenuOpen} color="primary">
                                <AccountCircle />
                            </IconButton>
                        )}
                    </Box>

                    {/* User Menu */}
                    <Menu
                        anchorEl={userMenuAnchor}
                        open={Boolean(userMenuAnchor)}
                        onClose={handleMenuClose}
                        PaperProps={{
                            sx: {
                                width: 200,
                                mt: 1.5
                            }
                        }}
                    >
                        <MenuItem sx={{ pointerEvents: "none" }}>
                            <Box>
                                <Typography variant="subtitle2">
                                    {user ? `${user.firstName ?? ""} ${user.lastName ?? ""}` : "User"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {company?.companyName ?? ""}
                                </Typography>
                            </Box>
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={handleLogout}>
                            <ListItemIcon>
                                <ExitToApp fontSize="small" />
                            </ListItemIcon>
                            Logout
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            {/* Mobile Drawer */}
            <Drawer
                anchor="left"
                open={mobileDrawerOpen}
                onClose={toggleDrawer(false)}
                ModalProps={{
                    keepMounted: true, // Better mobile performance
                }}
            >
                {drawerContent}
            </Drawer>

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: { xs: 2, sm: 4 },
                    bgcolor: "background.default",
                    minHeight: "calc(100vh - 120px)"
                }}
            >
                {children}
            </Box>

            {/* Footer */}
            <Box
                component="footer"
                sx={{
                    py: 3,
                    px: 2,
                    textAlign: "center",
                    bgcolor: "background.paper",
                    borderTop: 1,
                    borderColor: "divider",
                    mt: "auto"
                }}
            >
                <Typography variant="body2" color="text.secondary">
                    © {new Date().getFullYear()} InvoiceApp - Streamline Your Invoicing Process
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                    Version 1.0.0
                </Typography>
            </Box>
        </Box>
    );
}
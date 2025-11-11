import React, { useContext, useEffect, useMemo, useState } from "react";
import {
    Box,
    Grid,
    Paper,
    Typography,
    Button,
    IconButton,
    Menu,
    MenuItem,
    TextField,
    Tooltip,
    Divider,
    MenuList,
    FormControlLabel,
    Checkbox,
    FormControl,
    InputAdornment,
    Card,
    CardContent,
    useTheme,
    useMediaQuery,
} from "@mui/material";
import {
    LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell
} from "recharts";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/FileDownload";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ReceiptIcon from "@mui/icons-material/Receipt";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PieChartIcon from "@mui/icons-material/PieChart";
import InvoiceService from "../services/invoice.service";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DataGrid, GridActionsCellItem, type GridColDef } from "@mui/x-data-grid";
import dayjs from "dayjs";

const formatMoney = (value: number | null | undefined, symbol = "$") => {
    if (value == null) return "-";
    return `${symbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

type RangeKey = "today" | "week" | "month" | "year" | "custom";

export default function InvoicesPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const { authInfo, isAuthenticated, loading } = useContext(AuthContext);
    const company = (authInfo && authInfo._raw && authInfo._raw.company) ? authInfo._raw.company : null;
    const currencySymbol = (company?.currencySymbol) ?? (authInfo?._raw?.currencySymbol) ?? "$";

    const [range, setRange] = useState<RangeKey>("today");
    const [customFrom, setCustomFrom] = useState<string>("");
    const [customTo, setCustomTo] = useState<string>("");

    const [invoices, setInvoices] = useState<any[]>([]);
    const [filtered, setFiltered] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<{ invoiceCount: number; totalAmount: number }>({ invoiceCount: 0, totalAmount: 0 });
    const [trend12, setTrend12] = useState<any[]>([]);
    const [topItems, setTopItems] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);

    // Column chooser state
    const [columnsVisible, setColumnsVisible] = useState<Record<string, boolean>>({
        invoiceNo: true,
        invoiceDate: true,
        customerName: true,
        itemsCount: true,
        subTotal: true,
        taxPercentage: true,
        taxAmount: true,
        invoiceAmount: true,
        actions: true,
    });

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const openColMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const closeColMenu = () => setAnchorEl(null);

    const computeFromTo = () => {
        const today = dayjs().startOf("day");
        let from = today.startOf("day");
        let to = today.endOf("day");

        if (range === "week") {
            from = today.startOf("week");
        } else if (range === "month") {
            from = today.startOf("month");
        } else if (range === "year") {
            from = today.startOf("year");
        } else if (range === "custom" && customFrom && customTo) {
            from = dayjs(customFrom).startOf("day");
            to = dayjs(customTo).endOf("day");
        }

        return { from: from.format("YYYY-MM-DD"), to: to.format("YYYY-MM-DD") };
    };

    const loadAll = async () => {
        setLoadingData(true);
        const { from, to } = computeFromTo();

        try {
            const [listRes, metricsRes, trendRes, topRes] = await Promise.allSettled([
                InvoiceService.getList(from, to),
                InvoiceService.getMetrics(from, to),
                InvoiceService.getTrend12M(),
                InvoiceService.getTopItems(from, to)
            ]);

            // Handle list response
            let list: any[] = [];
            if (listRes.status === "fulfilled") {
                const rawList = listRes.value?.data ?? [];
                list = rawList.map((r: any) => ({
                    invoiceID: r.invoiceID ?? r.InvoiceID ?? r.primaryKeyID ?? 0,
                    invoiceNo: String(r.invoiceNo ?? r.InvoiceNo ?? r.invoiceNumber ?? ""),
                    invoiceDate: r.invoiceDate ?? r.InvoiceDate ?? r.invoiceDateString ?? null,
                    customerName: r.customerName ?? r.CustomerName ?? "",
                    itemsCount: Number(r.itemsCount ?? r.ItemsCount ?? r.items ?? 0),
                    subTotal: Number(r.subTotal ?? r.SubTotal ?? 0),
                    taxPercentage: Number(r.taxPercentage ?? r.TaxPercentage ?? 0),
                    taxAmount: Number(r.taxAmount ?? r.TaxAmount ?? 0),
                    invoiceAmount: Number(r.invoiceAmount ?? r.InvoiceAmount ?? 0),
                    __raw: r,
                }));
                setInvoices(list);
                setFiltered(list);
            }

            // Fallback helpers (compute metrics/trend/top from list if APIs fail)
            const computeMetricsFromList = (arr: any[]) => {
                const invoiceCount = arr.length;
                const totalAmount = arr.reduce((s: number, it: any) => s + Number(it.invoiceAmount ?? 0), 0);
                return { invoiceCount, totalAmount };
            };

            // Handle metrics response (with fallback)
            if (metricsRes.status === "fulfilled") {
                const md = metricsRes.value?.data ?? {};
                const invoiceCount = md.invoiceCount ?? md.InvoiceCount ?? null;
                const totalAmount = md.totalAmount ?? md.TotalAmount ?? null;
                if (invoiceCount !== null && totalAmount !== null) {
                    setMetrics({
                        invoiceCount,
                        totalAmount: Number(totalAmount)
                    });
                } else {
                    // fallback
                    setMetrics(computeMetricsFromList(list));
                }
            } else {
                setMetrics(computeMetricsFromList(list));
            }

            // Trend: prefer server, else roll-your-own monthly totals for last 12 months
            if (trendRes.status === "fulfilled" && Array.isArray(trendRes.value?.data) && trendRes.value.data.length) {
                const tr = trendRes.value.data;
                setTrend12(tr.map((t: any) => ({
                    monthStart: t.monthStart,
                    invoiceCount: t.invoiceCount ?? t.InvoiceCount ?? 0,
                    amountSum: Number(t.amountSum ?? t.AmountSum ?? 0),
                })));
            } else {
                // compute last-12-month buckets from list
                const now = dayjs();
                const months: any[] = [];
                for (let i = 11; i >= 0; i--) {
                    const dt = now.subtract(i, "month").startOf("month");
                    const key = dt.format("YYYY-MM");
                    months.push({ key, label: dt.format("MMM YY"), monthStart: dt.toISOString(), invoiceCount: 0, amountSum: 0 });
                }
                list.forEach((inv: any) => {
                    if (!inv.invoiceDate) return;
                    const m = dayjs(inv.invoiceDate).format("YYYY-MM");
                    const bucket = months.find((x) => x.key === m);
                    if (bucket) {
                        bucket.invoiceCount += 1;
                        bucket.amountSum += Number(inv.invoiceAmount ?? 0);
                    }
                });
                setTrend12(months.map(m => ({ monthStart: m.monthStart, invoiceCount: m.invoiceCount, amountSum: m.amountSum })));
            }

            // Top items: prefer server, else fallback to counting itemsCount per invoice (best-effort)
            if (topRes.status === "fulfilled" && Array.isArray(topRes.value?.data) && topRes.value.data.length) {
                const top = topRes.value.data;
                setTopItems(top.map((t: any) => ({
                    itemID: t.itemID,
                    itemName: t.itemName,
                    amountSum: Number(t.amountSum ?? t.AmountSum ?? 0),
                })));
            } else {
                // fallback: use invoice itemsCount as proxy and show the largest invoices
                const fallbackTop = [...list]
                    .sort((a: any, b: any) => (b.invoiceAmount ?? 0) - (a.invoiceAmount ?? 0))
                    .slice(0, 5)
                    .map((inv: any, idx: number) => ({
                        itemID: idx + 1,
                        itemName: `Invoice ${inv.invoiceNo || inv.invoiceID}`,
                        amountSum: Number(inv.invoiceAmount ?? 0),
                    }));
                setTopItems(fallbackTop);
            }

        } catch (ex) {
            console.error("Unexpected loadAll error", ex);
        } finally {
            setLoadingData(false);
        }
    };


    useEffect(() => {
        if (!isAuthenticated && !loading) return;
        loadAll();
    }, [range, customFrom, customTo, isAuthenticated, loading]);

    useEffect(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) setFiltered(invoices);
        else setFiltered(invoices.filter(i =>
            String(i.invoiceNo ?? "").toLowerCase().includes(q) ||
            String(i.customerName ?? "").toLowerCase().includes(q)
        ));
    }, [searchText, invoices]);

    const exportCsv = () => {
        const cols = [
            ["Invoice No", "invoiceNo"],
            ["Date", "invoiceDate"],
            ["Customer", "customerName"],
            ["Items", "itemsCount"],
            ["Sub Total", "subTotal"],
            ["Tax %", "taxPercentage"],
            ["Tax Amount", "taxAmount"],
            ["Total", "invoiceAmount"],
        ];
        const rows = [cols.map(c => c[0]).join(",")];
        for (const r of filtered) {
            const vals = cols.map(c => {
                const key = c[1] as string;
                let v = (r as any)[key];
                if (key === "subTotal" || key === "taxAmount" || key === "invoiceAmount") {
                    v = Number(v || 0).toFixed(2);
                }
                if (v == null) v = "";
                if (typeof v === "string" && (v.includes(",") || v.includes('"'))) v = `"${v.replace(/"/g, '""')}"`;
                return v;
            });
            rows.push(vals.join(","));
        }

        const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoices_export_${dayjs().format("YYYYMMDD")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Delete this invoice? This is permanent.")) return;
        try {
            await InvoiceService.delete(id);
            await loadAll();
        } catch (err: any) {
            alert(err?.response?.data?.message || "Delete failed");
        }
    };

    const columns: GridColDef[] = useMemo(() => ([
        {
            field: "invoiceNo",
            headerName: "Invoice No",
            width: isMobile ? 120 : 160,
            renderCell: (p) => <Typography sx={{ fontWeight: 600, fontSize: isMobile ? "0.8rem" : "0.875rem" }}>{p.value}</Typography>,
            hide: !columnsVisible.invoiceNo
        },
        {
            field: "invoiceDate",
            headerName: "Date",
            width: isMobile ? 100 : 140,
            renderCell: (p) => <Typography sx={{ fontSize: isMobile ? "0.8rem" : "0.875rem" }}>{dayjs(p.value).format("DD-MMM-YYYY")}</Typography>,
            hide: !columnsVisible.invoiceDate
        },
        {
            field: "customerName",
            headerName: "Customer",
            width: isMobile ? 140 : 220,
            hide: !columnsVisible.customerName,
            renderCell: (p) => <Typography sx={{ fontSize: isMobile ? "0.8rem" : "0.875rem" }}>{p.value}</Typography>,
        },
        {
            field: "itemsCount",
            headerName: "Items",
            width: isMobile ? 70 : 80,
            type: "number",
            hide: !columnsVisible.itemsCount,
            renderCell: (p) => <Typography sx={{ fontSize: isMobile ? "0.8rem" : "0.875rem" }}>{p.value}</Typography>,
        },
        {
            field: "subTotal",
            headerName: "Sub Total",
            width: isMobile ? 100 : 140,
            headerAlign: "right",
            align: "right",
            renderCell: (p) => <Typography sx={{ fontSize: isMobile ? "0.8rem" : "0.875rem" }}>{formatMoney(Number(p.value), currencySymbol)}</Typography>,
            hide: !columnsVisible.subTotal
        },
        {
            field: "taxPercentage",
            headerName: "Tax %",
            width: isMobile ? 70 : 90,
            headerAlign: "right",
            align: "right",
            renderCell: (p) => <Typography sx={{ fontSize: isMobile ? "0.8rem" : "0.875rem" }}>{Number(p.value ?? 0).toFixed(2)}</Typography>,
            hide: !columnsVisible.taxPercentage
        },
        {
            field: "taxAmount",
            headerName: "Tax Amt",
            width: isMobile ? 100 : 140,
            headerAlign: "right",
            align: "right",
            renderCell: (p) => <Typography sx={{ fontSize: isMobile ? "0.8rem" : "0.875rem" }}>{formatMoney(Number(p.value), currencySymbol)}</Typography>,
            hide: !columnsVisible.taxAmount
        },
        {
            field: "invoiceAmount",
            headerName: "Total",
            width: isMobile ? 110 : 160,
            headerAlign: "right",
            align: "right",
            renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: isMobile ? "0.8rem" : "0.875rem" }}>{formatMoney(Number(p.value), currencySymbol)}</Typography>,
            hide: !columnsVisible.invoiceAmount
        },
        {
            field: "actions",
            type: "actions",
            headerName: "Actions",
            width: isMobile ? 100 : 140,
            getActions: (params) => [
                <GridActionsCellItem
                    icon={<Tooltip title="Edit"><EditIcon fontSize={isMobile ? "small" : "medium"} /></Tooltip>}
                    label="Edit"
                    onClick={() => navigate(`/invoice/edit/${params.row.invoiceID}`)}
                />,
                <GridActionsCellItem
                    icon={<Tooltip title="Print"><PrintIcon fontSize={isMobile ? "small" : "medium"} /></Tooltip>}
                    label="Print"
                    onClick={() => window.open(`/invoice/print/${params.row.invoiceID}`, "_blank")}
                />,
                <GridActionsCellItem
                    icon={<Tooltip title="Delete"><DeleteIcon fontSize={isMobile ? "small" : "medium"} /></Tooltip>}
                    label="Delete"
                    onClick={() => handleDelete(params.row.invoiceID)}
                />,
            ],
            hide: !columnsVisible.actions
        }
    ]), [columnsVisible, currencySymbol, navigate, isMobile]);

    const toggleColumn = (k: string) => {
        setColumnsVisible(prev => ({ ...prev, [k]: !prev[k] }));
    };

    // Improved StatCard component
    const StatCard = ({ title, value, subtitle, icon, color = "primary" }: any) => (
        <Card sx={{ height: "100%", borderRadius: 2, boxShadow: 1 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="h4" component="div" sx={{ fontWeight: "bold", mb: 0.5 }}>
                            {value}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {subtitle}
                        </Typography>
                    </Box>
                    <Box sx={{
                        color: `${color}.main`,
                        backgroundColor: `${color}.light`,
                        borderRadius: 2,
                        p: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    return (
        <Box sx={{ p: { xs: 1, sm: 2 } }}>
            {/* Header Section */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: "bold", mb: 1 }}>
                    Invoices
                </Typography>

                {/* Date Range Filter - Responsive */}
                <Box sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 2,
                    alignItems: { xs: "stretch", sm: "center" },
                    justifyContent: "space-between",
                    mb: 2
                }}>
                    <Box sx={{
                        display: "flex",
                        gap: 1,
                        flexWrap: "wrap",
                        justifyContent: { xs: "center", sm: "flex-start" }
                    }}>
                        {(["today", "week", "month", "year", "custom"] as RangeKey[]).map((key) => (
                            <Button
                                key={key}
                                variant={range === key ? "contained" : "outlined"}
                                size="small"
                                onClick={() => setRange(key)}
                                sx={{
                                    textTransform: "capitalize",
                                    minWidth: { xs: "60px", sm: "auto" }
                                }}
                            >
                                {key}
                            </Button>
                        ))}
                    </Box>

                    {/* Custom Date Inputs */}
                    {range === "custom" && (
                        <Box sx={{
                            display: "flex",
                            gap: 1,
                            flexWrap: "wrap",
                            justifyContent: { xs: "center", sm: "flex-start" }
                        }}>
                            <TextField
                                label="From"
                                type="date"
                                size="small"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ minWidth: 140 }}
                            />
                            <TextField
                                label="To"
                                type="date"
                                size="small"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ minWidth: 140 }}
                            />
                            <Button variant="contained" size="small" onClick={loadAll}>
                                Apply
                            </Button>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Number of Invoices"
                        value={metrics.invoiceCount ?? 0}
                        subtitle={range === "custom" ? `${customFrom} → ${customTo}` : `This ${range}`}
                        icon={<ReceiptIcon />}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Invoice Amount"
                        value={formatMoney(metrics.totalAmount ?? 0, currencySymbol)}
                        subtitle={range === "custom" ? `${customFrom} → ${customTo}` : `This ${range}`}
                        icon={<AttachMoneyIcon />}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ height: "100%", borderRadius: 2, boxShadow: 1 }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ height: 120 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trend12.map(t => ({ name: dayjs(t.monthStart).format("MMM YY"), amount: Number(t.amountSum || 0) }))}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                                        <ReTooltip formatter={(value: any) => formatMoney(Number(value), currencySymbol)} />
                                        <Line type="monotone" dataKey="amount" stroke={theme.palette.info.main} strokeWidth={2} dot={{ r: 2 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>

                            <Box sx={{
                                height: 30,
                                bgcolor: "grey.50",
                                borderRadius: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "1px dashed",
                                borderColor: "divider"
                            }}>
                                <Typography variant="caption" color="text.secondary">
                                    Line Chart: Monthly Revenue
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ height: "100%", borderRadius: 2, boxShadow: 1 }}>
                        <CardContent sx={{ p: 4 }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Top 5 Items
                                </Typography>
                                <PieChartIcon color="warning" />
                            </Box>
                            <Box sx={{ height: 120 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={topItems.map(t => ({ name: t.itemName, value: Number(t.amountSum || 0) }))}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={40}
                                            innerRadius={20}
                                            label={(entry) => entry.name.length > 12 ? `${entry.name.slice(0, 10)}...` : entry.name}
                                        >
                                            {topItems.map((_, idx) => (
                                                <Cell key={`cell-${idx}`} fill={["#8884d8", "#82ca9d", "#ffc658", "#ff7f50", "#a4de6c"][idx % 5]} />
                                            ))}
                                        </Pie>
                                        <ReTooltip formatter={(v: any) => formatMoney(Number(v), currencySymbol)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Action Bar */}
            <Box sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 2,
                justifyContent: "space-between",
                alignItems: { xs: "stretch", sm: "center" },
                mb: 2
            }}>
                {/* Search Box */}
                <TextField
                    placeholder="Search Invoice No, Customer..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    size="small"
                    sx={{
                        minWidth: { xs: "100%", sm: 300 },
                        "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                        }
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                    }}
                />

                {/* Action Buttons */}
                <Box sx={{
                    display: "flex",
                    gap: 1,
                    justifyContent: { xs: "space-between", sm: "flex-end" },
                    flexWrap: "wrap"
                }}>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => navigate("/invoice/new")}
                        size="small"
                    >
                        {isSmallMobile ? "New" : "New Invoice"}
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={exportCsv}
                        size="small"
                    >
                        {isSmallMobile ? "Export" : "Export CSV"}
                    </Button>
                    <Tooltip title="Column Settings">
                        <IconButton onClick={openColMenu} size="small">
                            <ViewColumnIcon />
                        </IconButton>
                    </Tooltip>

                    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeColMenu}>
                        <MenuList dense>
                            {Object.entries(columnsVisible).map(([key, visible]) => (
                                <MenuItem key={key} onClick={() => toggleColumn(key)}>
                                    <FormControlLabel
                                        control={<Checkbox checked={visible} />}
                                        label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                    />
                                </MenuItem>
                            ))}
                        </MenuList>
                    </Menu>
                </Box>
            </Box>

            {/* Data Grid */}
            <Paper sx={{
                p: { xs: 0.5, sm: 2 },
                borderRadius: 2,
                boxShadow: 1,
                height: "100%"
            }}>
                <Box sx={{ height: 540, width: "100%" }}>
                    <DataGrid
                        rows={filtered}
                        columns={columns}
                        getRowId={(r) => r.invoiceID}
                        pageSize={rowsPerPage}
                        onPageSizeChange={(newSize) => setRowsPerPage(newSize)}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        pagination
                        disableSelectionOnClick
                        loading={loadingData}
                        sx={{
                            border: "none",
                            "& .MuiDataGrid-cell": {
                                alignItems: "center",
                                borderBottom: "1px solid",
                                borderBottomColor: "divider"
                            },
                            "& .MuiDataGrid-columnHeader": {
                                fontWeight: 600,
                                backgroundColor: "grey.50"
                            },
                            "& .MuiDataGrid-row:hover": {
                                backgroundColor: "action.hover"
                            }
                        }}
                    />
                </Box>
            </Paper>
        </Box>
    );
}
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
    Select,
    InputLabel,
    FormControl,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/FileDownload";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
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
    const { authInfo, isAuthenticated, loading, /* fallback: company may be in context user/company */ } = useContext(AuthContext);
    const company = (authInfo && authInfo._raw && authInfo._raw.company) ? authInfo._raw.company : null;
    const currencySymbol = (company?.currencySymbol) ?? (authInfo?._raw?.currencySymbol) ?? "$";
    const [range, setRange] = useState<RangeKey>("month");
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

    // menu anchor for column chooser
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const openColMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const closeColMenu = () => setAnchorEl(null);

    const computeFromTo = () => {
        const today = dayjs().startOf("day");
        let from = today.startOf("month");
        let to = today.endOf("day");
        if (range === "today") {
            from = today.startOf("day");
            to = today.endOf("day");
        } else if (range === "week") {
            from = today.startOf("week");
            to = today.endOf("day");
        } else if (range === "month") {
            from = today.startOf("month");
            to = today.endOf("day");
        } else if (range === "year") {
            from = today.startOf("year");
            to = today.endOf("day");
        } else if (range === "custom") {
            // use customFrom/customTo if present, else fallback to month
            if (customFrom && customTo) {
                from = dayjs(customFrom).startOf("day");
                to = dayjs(customTo).endOf("day");
            } else {
                from = today.startOf("month");
                to = today.endOf("day");
            }
        }
        // return YYYY-MM-DD for API
        return { from: from.format("YYYY-MM-DD"), to: to.format("YYYY-MM-DD") };
    };

    const loadAll = async () => {
        setLoadingData(true);
        const { from, to } = computeFromTo();

        const pList = InvoiceService.getList(from, to);
        const pMetrics = InvoiceService.getMetrics(from, to);
        const pTrend = InvoiceService.getTrend12M();
        const pTop = InvoiceService.getTopItems(from, to);

        try {
            const results = await Promise.allSettled([pList, pMetrics, pTrend, pTop]);

            const [listRes, metricsRes, trendRes, topRes] = results;

            // ---------- LIST ----------
            if (listRes.status === "fulfilled") {
                const rawList = listRes.value?.data ?? [];
                const list = (rawList || []).map((r: any) => ({
                    // fallback to primaryKeyID because some responses include it
                    invoiceID: r.invoiceID ?? r.InvoiceID ?? r.primaryKeyID ?? 0,
                    // always normalise invoiceNo to string (null => "")
                    invoiceNo: String(r.invoiceNo ?? r.InvoiceNo ?? r.invoiceNumber ?? "" ?? ""),
                    invoiceDate: r.invoiceDate ?? r.InvoiceDate ?? r.invoiceDateString ?? null,
                    customerName: r.customerName ?? r.CustomerName ?? "",
                    itemsCount: Number(r.itemsCount ?? r.ItemsCount ?? r.items ?? 0),
                    subTotal: Number(r.subTotal ?? r.SubTotal ?? 0),
                    taxPercentage: Number(r.taxPercentage ?? r.TaxPercentage ?? 0),
                    taxAmount: Number(r.taxAmount ?? r.TaxAmount ?? 0),
                    invoiceAmount: Number(r.invoiceAmount ?? r.InvoiceAmount ?? r.invoiceAmount ?? 0),
                    updatedOn: r.updatedOn ?? r.UpdatedOn ?? null,
                    __raw: r,
                }));

                setInvoices(list);
                setFiltered(list);
            } else {
                console.warn("getList failed", listRes.reason);
                setInvoices([]);
                setFiltered([]);
            }

            // ---------- METRICS ----------
            if (metricsRes.status === "fulfilled") {
                const md = metricsRes.value?.data ?? {};
                setMetrics({
                    invoiceCount: md.invoiceCount ?? md.InvoiceCount ?? 0,
                    totalAmount: Number(md.totalAmount ?? md.TotalAmount ?? 0),
                });
            } else {
                console.warn("getMetrics failed", metricsRes.reason);
                setMetrics({ invoiceCount: 0, totalAmount: 0 });
            }

            // ---------- TREND (safe to ignore failure) ----------
            if (trendRes.status === "fulfilled") {
                const tr = trendRes.value?.data ?? [];
                setTrend12((tr || []).map((t: any) => ({
                    monthStart: t.monthStart,
                    invoiceCount: t.invoiceCount ?? t.InvoiceCount ?? 0,
                    amountSum: Number(t.amountSum ?? t.AmountSum ?? 0),
                })));
            } else {
                console.warn("getTrend12M failed", trendRes.reason);
                setTrend12([]);
            }

            // ---------- TOP ITEMS ----------
            if (topRes.status === "fulfilled") {
                const top = topRes.value?.data ?? [];
                setTopItems((top || []).map((t: any) => ({
                    itemID: t.itemID,
                    itemName: t.itemName,
                    amountSum: Number(t.amountSum ?? t.AmountSum ?? 0),
                })));
            } else {
                console.warn("getTopItems failed", topRes.reason);
                setTopItems([]);
            }
        } catch (ex) {
            // unexpected (shouldn't happen because we handled allSettled)
            console.error("Unexpected loadAll error", ex);
        } finally {
            setLoadingData(false);
        }
    };


    // initial load and on range change
    useEffect(() => {
        if (!isAuthenticated && !loading) return; // don't load if not auth
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range, customFrom, customTo, isAuthenticated, loading]);

    // client side search filter on invoices array
    useEffect(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) setFiltered(invoices);
        else setFiltered(invoices.filter(i =>
            String(i.invoiceNo ?? "").toLowerCase().includes(q) ||
            String(i.customerName ?? "").toLowerCase().includes(q)
        ));
    }, [searchText, invoices]);

    // export CSV of current filtered grid
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

    // delete invoice
    const handleDelete = async (id: number) => {
        if (!confirm("Delete this invoice? This is permanent.")) return;
        try {
            await InvoiceService.delete(id);
            // refresh list and metrics
            await loadAll();
        } catch (err: any) {
            alert(err?.response?.data?.message || "Delete failed");
        }
    };

    // columns for DataGrid
    const columns: GridColDef[] = useMemo(() => ([
        {
            field: "invoiceNo",
            headerName: "Invoice No",
            width: 160,
            renderCell: (p) => <Typography sx={{ fontWeight: 600 }}>{p.value}</Typography>,
            hide: !columnsVisible.invoiceNo
        },
        {
            field: "invoiceDate",
            headerName: "Date",
            width: 140,
            renderCell: (p) => <span>{dayjs(p.value).format("DD-MMM-YYYY")}</span>,
            hide: !columnsVisible.invoiceDate
        },
        {
            field: "customerName",
            headerName: "Customer",
            width: 220,
            hide: !columnsVisible.customerName,
        },
        {
            field: "itemsCount",
            headerName: "Items",
            width: 80,
            type: "number",
            hide: !columnsVisible.itemsCount
        },
        {
            field: "subTotal",
            headerName: "Sub Total",
            width: 140,
            headerAlign: "right",
            align: "right",
            renderCell: (p) => <span>{formatMoney(Number(p.value), currencySymbol)}</span>,
            hide: !columnsVisible.subTotal
        },
        {
            field: "taxPercentage",
            headerName: "Tax %",
            width: 90,
            headerAlign: "right",
            align: "right",
            renderCell: (p) => <span>{Number(p.value ?? 0).toFixed(2)}</span>,
            hide: !columnsVisible.taxPercentage
        },
        {
            field: "taxAmount",
            headerName: "Tax Amt",
            width: 140,
            headerAlign: "right",
            align: "right",
            renderCell: (p) => <span>{formatMoney(Number(p.value), currencySymbol)}</span>,
            hide: !columnsVisible.taxAmount
        },
        {
            field: "invoiceAmount",
            headerName: "Total",
            width: 160,
            headerAlign: "right",
            align: "right",
            renderCell: (p) => <span style={{ fontWeight: 700 }}>{formatMoney(Number(p.value), currencySymbol)}</span>,
            hide: !columnsVisible.invoiceAmount
        },
        {
            field: "actions",
            type: "actions",
            headerName: "Actions",
            width: 140,
            getActions: (params) => [
                <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={() => navigate(`/invoice/edit/${params.row.invoiceID}`)} />,
                <GridActionsCellItem icon={<PrintIcon />} label="Print" onClick={() => window.open(`/invoice/print/${params.row.invoiceID}`, "_blank")} />,
                <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDelete(params.row.invoiceID)} />,
            ],
            hide: !columnsVisible.actions
        }
    ]), [columnsVisible, currencySymbol, navigate]);

    // Column chooser toggle
    const toggleColumn = (k: string) => {
        setColumnsVisible(prev => ({ ...prev, [k]: !prev[k] }));
    };

    // Card small component
    const StatCard = ({ title, subtitle, children }: any) => (
        <Paper sx={{ p: 2, borderRadius: 2, minHeight: 110 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{children}</Typography>
            <Typography variant="caption" color="text.secondary">{title}</Typography>
            <Box sx={{ mt: 1 }}><Typography variant="body2" color="text.secondary">{subtitle}</Typography></Box>
        </Paper>
    );

    return (
        <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box>
                    <Typography variant="h5" sx={{ mb: 0.5 }}>Invoices</Typography>
                    <Typography variant="body2" color="text.secondary">Manage your invoices and get quick insights.</Typography>
                </Box>

                {/* Range filters */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Button variant={range === "today" ? "contained" : "outlined"} onClick={() => setRange("today")}>Today</Button>
                    <Button variant={range === "week" ? "contained" : "outlined"} onClick={() => setRange("week")}>Week</Button>
                    <Button variant={range === "month" ? "contained" : "outlined"} onClick={() => setRange("month")}>Month</Button>
                    <Button variant={range === "year" ? "contained" : "outlined"} onClick={() => setRange("year")}>Year</Button>
                    <Button variant={range === "custom" ? "contained" : "outlined"} onClick={() => setRange("custom")}>Custom</Button>
                </Box>
            </Box>

            {/* Cards */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                    <StatCard title="Number of Invoices" subtitle={range === "custom" ? `${customFrom} → ${customTo}` : range}>
                        {metrics.invoiceCount ?? 0}
                    </StatCard>
                </Grid>
                <Grid item xs={12} md={3}>
                    <StatCard title="Total Invoice Amount" subtitle={range === "custom" ? `${customFrom} → ${customTo}` : range}>
                        {formatMoney(metrics.totalAmount ?? 0, currencySymbol)}
                    </StatCard>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2, borderRadius: 2, minHeight: 110 }}>
                        <Typography variant="subtitle2" color="text.secondary">Last 12 Months</Typography>
                        {/* Placeholder for line chart */}
                        <Box sx={{ mt: 1, height: 80, bgcolor: "grey.100", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Typography variant="caption">Line Chart: Monthly Revenue</Typography>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2, borderRadius: 2, minHeight: 110 }}>
                        <Typography variant="subtitle2" color="text.secondary">Top 5 Items</Typography>
                        {/* Placeholder for pie chart */}
                        <Box sx={{ mt: 1, height: 80, bgcolor: "grey.100", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Typography variant="caption">Pie Chart: Item Distribution</Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Action bar */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", bgcolor: "background.paper", px: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                        <SearchIcon sx={{ mr: 1 }} />
                        <input placeholder="Search Invoice No, Customer..." value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ border: "none", outline: "none" }} />
                    </Box>
                </Box>

                <Box sx={{ display: "flex", gap: 1 }}>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/invoice/new")}>New Invoice</Button>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Export</Button>
                    <IconButton onClick={openColMenu}><ViewColumnIcon /></IconButton>
                    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeColMenu}>
                        <MenuList>
                            {Object.keys(columnsVisible).map(k => (
                                <MenuItem key={k} onClick={() => toggleColumn(k)}>
                                    <FormControlLabel control={<Checkbox checked={Boolean(columnsVisible[k])} />} label={k} />
                                </MenuItem>
                            ))}
                        </MenuList>
                    </Menu>
                </Box>
            </Box>

            {/* Custom range inputs */}
            {range === "custom" && (
                <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                    <TextField label="From" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
                    <TextField label="To" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} InputLabelProps={{ shrink: true }} />
                    <Button variant="contained" onClick={() => loadAll()}>Apply</Button>
                </Box>
            )}

            {/* Grid */}
            <Paper sx={{ p: 1 }}>
                <div style={{ height: 540, width: "100%" }}>
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
                            ".MuiDataGrid-cell": { alignItems: "center" },
                            ".MuiDataGrid-columnHeader": { fontWeight: 600 },
                        }}
                    />
                </div>
            </Paper>
        </Box>
    );
}

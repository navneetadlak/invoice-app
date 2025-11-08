import React, { useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Typography,
    IconButton,
    Tooltip,
    Dialog,
    DialogContent,
    DialogTitle,
    Menu,
    MenuItem,
    Checkbox,
    FormControlLabel,
    useTheme,
    useMediaQuery,
    Paper,
    Grid,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { ItemService } from "../services/item.service";
import ItemEditor from "../components/ItemEditor";

function formatCurrency(n: number | null | undefined) {
    if (n == null) return "-";
    // Use Intl.NumberFormat to get thousand separators and two decimals
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function ItemsList() {
    const [rows, setRows] = useState<any[]>([]);
    const [filtered, setFiltered] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [openEditor, setOpenEditor] = useState(false);
    const [editing, setEditing] = useState<any | null>(null);
    const [search, setSearch] = useState("");
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [openColDialog, setOpenColDialog] = useState(false);

    // Column visibility state
    const defaultColumns = {
        picture: true,
        itemName: true,
        description: true,
        saleRate: true,
        discountPct: true,
        actions: true,
    };
    const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
        try {
            const raw = localStorage.getItem("items_visible_columns");
            return raw ? JSON.parse(raw) : defaultColumns;
        } catch {
            return defaultColumns;
        }
    });

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    useEffect(() => {
        localStorage.setItem("items_visible_columns", JSON.stringify(visibleCols));
    }, [visibleCols]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await ItemService.getList();
            setRows(res.data ?? []);
        } catch (e) {
            console.error("Failed to load items", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    // client-side search
    useEffect(() => {
        if (!search.trim()) setFiltered(rows);
        else {
            const q = search.trim().toLowerCase();
            setFiltered(rows.filter(r =>
                (r.itemName ?? "").toString().toLowerCase().includes(q) ||
                (r.description ?? "").toString().toLowerCase().includes(q)
            ));
        }
    }, [search, rows]);

    // DataGrid columns
    const columns: GridColDef[] = useMemo(() => [
        {
            field: "picture",
            headerName: "Picture",
            width: 80,
            sortable: false,
            renderCell: (params) => {
                const id = params.row.itemID;
                const thumbUrl = id ? `${import.meta.env.VITE_API_BASE_URL}/Item/PictureThumbnail/${id}` : "";
                return (
                    <Box sx={{ width: 50, height: 50, borderRadius: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "grey.100" }}>
                        {params.row.hasPicture ? (
                            // Use backend thumbnail endpoint
                            <img src={thumbUrl} alt="thumb" style={{ width: 50, height: 50, objectFit: "cover" }} />
                        ) : (
                            <Box sx={{ width: 24, height: 24, bgcolor: "grey.300", borderRadius: 0.5 }} />
                        )}
                    </Box>
                );
            },
            hide: !visibleCols.picture
        },
        {
            field: "itemName",
            headerName: "Item Name",
            width: 260,
            renderCell: (p) => (
                <Box>
                    <Typography sx={{ fontWeight: 600 }}>{p.row.itemName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{p.row.category ?? ""}</Typography>
                </Box>
            ),
            hide: !visibleCols.itemName
        },
        {
            field: "description",
            headerName: "Description",
            flex: 1,
            minWidth: 220,
            renderCell: (p) => {
                const desc = p.row.description ?? "";
                const short = desc.length > 80 ? `${desc.slice(0, 80)}…` : desc;
                return (
                    <Tooltip title={desc}>
                        <Typography variant="body2" noWrap>{short}</Typography>
                    </Tooltip>
                );
            },
            hide: !visibleCols.description
        },
        {
            field: "saleRate",
            headerName: "Sale Rate",
            width: 140,
            headerAlign: "right",
            align: "right",
            renderCell: (p) => {
                const val = p.row.saleRate ?? p.row.SaleRate ?? p.row.salesRate ?? p.row.SalesRate ?? 0;
                return <Typography>{formatCurrency(Number(val))}</Typography>;
            },
            hide: !visibleCols.saleRate
        },
        {
            field: "discountPct",
            headerName: "Discount %",
            width: 120,
            headerAlign: "right",
            align: "right",
            renderCell: (p) => <Typography>{Number(p.row.discountPct || 0).toFixed(2)}%</Typography>,
            hide: !visibleCols.discountPct
        },
        {
            field: "actions",
            headerName: "Actions",
            width: 140,
            sortable: false,
            renderCell: (params) => (
                <Box>
                    <Tooltip title="Edit">
                        <IconButton size="small" color="primary" onClick={() => { setEditing(params.row); setOpenEditor(true); }}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={async () => {
                            if (!window.confirm("Delete this item? This is permanent.")) return;
                            try {
                                await ItemService.delete(params.row.itemID);
                                load();
                            } catch (err: any) {
                                const status = err?.response?.status;
                                if (status === 412) alert("Record modified by another user. Reload and try again.");
                                else alert(err?.response?.data?.message || "Delete failed.");
                            }
                        }}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            ),
            hide: !visibleCols.actions
        }
    ], [visibleCols]);

    // Export visible rows & columns as CSV
    const exportCsv = () => {
        // columns to include in export (visible ones)
        const colsToExport = columns.filter(c => !c.hide && c.field !== "actions");
        const header = colsToExport.map(c => c.headerName ?? c.field);
        const csvRows = [header.join(",")];

        // use filtered (search) rows
        for (const r of filtered) {
            const cells = colsToExport.map(c => {
                const f = c.field;
                let v = (r as any)[f];
                if (f === "saleRate") v = formatCurrency(v);
                if (f === "discountPct") v = (Number(v || 0).toFixed(2) + "%");
                if (v == null) v = "";
                // escape any commas/quotes
                if (typeof v === "string" && (v.includes(",") || v.includes("\""))) {
                    return `"${v.replace(/"/g, '""')}"`;
                }
                return String(v);
            });
            csvRows.push(cells.join(","));
        }

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `items_export_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Column chooser menu handlers
    const openColMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const closeColMenu = () => setAnchorEl(null);

    const toggleCol = (key: string) => {
        setVisibleCols(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Mobile card view
    if (isMobile) {
        return (
            <Box p={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h5">Items</Typography>
                    <Box display="flex" gap={1}>
                        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setEditing(null); setOpenEditor(true); }}>Add</Button>
                        <Button startIcon={<FileDownloadIcon />} variant="outlined" onClick={exportCsv}>Export</Button>
                    </Box>
                </Box>

                <Box mb={2}>
                    <input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd" }} />
                </Box>

                <Grid container spacing={2}>
                    {filtered.map(item => (
                        <Grid item xs={12} key={item.itemID}>
                            <Paper sx={{ p: 2, display: "flex", gap: 2 }}>
                                <Box sx={{ width: 64, height: 64 }}>
                                    {item.hasPicture ? (
                                        <img src={`${import.meta.env.VITE_API_BASE_URL}/Item/PictureThumbnail/${item.itemID}`} alt="thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                        <Box sx={{ width: "100%", height: "100%", bgcolor: "grey.100" }} />
                                    )}
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontWeight: 600 }}>{item.itemName}</Typography>
                                    <Typography variant="body2" color="text.secondary" noWrap>{item.description}</Typography>
                                </Box>
                                <Box sx={{ textAlign: "right" }}>
                                    <Typography>{formatCurrency(item.saleRate)}</Typography>
                                    <Typography variant="caption">{Number(item.discountPct || 0).toFixed(2)}%</Typography>
                                    <Box>
                                        <IconButton size="small" onClick={() => { setEditing(item); setOpenEditor(true); }}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" color="error" onClick={async () => { if (confirm("Delete?")) { await ItemService.delete(item.itemID); load(); } }}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>

                <Dialog open={openEditor} onClose={() => setOpenEditor(false)} fullWidth maxWidth="sm">
                    <DialogContent>
                        <ItemEditor open={openEditor} record={editing} onClose={() => { setOpenEditor(false); load(); }} />
                    </DialogContent>
                </Dialog>
            </Box>
        );
    }

    // Desktop DataGrid view
    return (
        <Box p={2}>
            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                    <Typography variant="h5">Items</Typography>
                    <Typography variant="body2" color="text.secondary">Manage your product and service catalog.</Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1}>
                    <Box sx={{ display: "flex", alignItems: "center", bgcolor: "background.paper", px: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                        <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />
                        <input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: "none", outline: "none" }} />
                    </Box>

                    <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setEditing(null); setOpenEditor(true); }}>
                        Add New Item
                    </Button>

                    <Button startIcon={<FileDownloadIcon />} variant="outlined" onClick={exportCsv}>
                        Export
                    </Button>

                    <IconButton onClick={openColMenu}>
                        <ViewColumnIcon />
                    </IconButton>

                    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeColMenu}>
                        {Object.keys(visibleCols).map(key => (
                            <MenuItem key={key} onClick={() => toggleCol(key)}>
                                <FormControlLabel control={<Checkbox checked={!!visibleCols[key]} />} label={key} />
                            </MenuItem>
                        ))}
                    </Menu>
                </Box>
            </Box>

            <Paper sx={{ height: 560, width: "100%", p: 1 }}>
                <DataGrid
                    rows={filtered}
                    columns={columns}
                    loading={loading}
                    getRowId={(r) => r.itemID}
                    pageSizeOptions={[5, 10, 25, 50]}
                    initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                    sx={{
                        ".MuiDataGrid-cell": { alignItems: "center" },
                        ".MuiDataGrid-columnHeader": { fontWeight: 600 }
                    }}
                />
            </Paper>

            <Dialog open={openEditor} onClose={() => setOpenEditor(false)} fullWidth maxWidth="sm">
                <DialogTitle>{editing ? "Edit Item" : "Add Item"}</DialogTitle>
                <DialogContent>
                    <ItemEditor open={openEditor} record={editing} onClose={() => { setOpenEditor(false); load(); }} />
                </DialogContent>
            </Dialog>
        </Box>
    );
}
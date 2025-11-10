import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  Grid,
  IconButton,
  Select,
  MenuItem,
  InputAdornment,
  Divider,
  Stack,
  CircularProgress,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  AttachMoney as MoneyIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import InvoiceService from "../services/invoice.service";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { ItemService } from "../services/item.service";

type ItemOption = { itemID: number; itemName: string; description?: string; saleRate?: number; discountPct?: number };

type LineRow = {
  _uid: string;
  itemID?: number | null;
  itemName?: string;
  description?: string;
  qty: number;
  rate: number;
  discountPct: number;
  amount: number;
  errors?: { [k: string]: string };
};

const uid = (n = 6) => Math.random().toString(36).slice(2, 2 + n);
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export default function InvoiceEditor() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { isAuthenticated, authInfo } = useContext(AuthContext);
  const currencySymbol = (authInfo?._raw?.company?.currencySymbol) ?? "$";
  const navigate = useNavigate();
  const params = useParams();
  const editingId = params?.id ? Number(params.id) : 0;

  // Header fields
  const [invoiceNo, setInvoiceNo] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [customerName, setCustomerName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [updatedOnPrev, setUpdatedOnPrev] = useState<string | null>(null);

  const [itemsLoading, setItemsLoading] = useState<boolean>(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // Lines state
  const [lines, setLines] = useState<LineRow[]>([
    { _uid: uid(), itemID: null, itemName: "", description: "", qty: 0, rate: 0, discountPct: 0, amount: 0, errors: {} },
  ]);
  const [selectedLineUid, setSelectedLineUid] = useState<string | null>(null);

  // Totals + saving
  const [subTotal, setSubTotal] = useState<number>(0);
  const [taxPct, setTaxPct] = useState<number>(0);
  const [taxAmt, setTaxAmt] = useState<number>(0);
  const [invoiceAmount, setInvoiceAmount] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Item options
  const [itemsOptions, setItemsOptions] = useState<ItemOption[]>([]);

  // --- Fetch items on mount ---
  useEffect(() => {
    let mounted = true;
    const loadItems = async () => {
      setItemsLoading(true);
      setItemsError(null);
      try {
        const res = await ItemService.getList();
        const raw = res?.data ?? [];
        const opts: ItemOption[] = (raw || []).map((r: any) => ({
          itemID: Number(r.itemID ?? r.ItemID ?? r.primaryKeyID ?? 0),
          itemName: r.itemName ?? r.ItemName ?? r.item ?? "Unnamed item",
          description: r.description ?? r.Description ?? "",
          saleRate: Number(r.salesRate ?? r.saleRate ?? r.SaleRate ?? 0),
          discountPct: Number(r.discountPct ?? r.DiscountPct ?? 0),
        }));
        if (mounted) setItemsOptions(opts);
      } catch (err: any) {
        console.error("Failed to load items", err);
        if (mounted) setItemsError("Failed to load items.");
      } finally {
        if (mounted) setItemsLoading(false);
      }
    };
    loadItems();
    return () => { mounted = false; };
  }, []);

  // --- Load invoice when editing ---
  useEffect(() => {
    if (!editingId) return;

    let mounted = true;
    const loadInvoice = async () => {
      try {
        const res = await InvoiceService.getById(editingId);
        const data = Array.isArray(res?.data) ? res.data[0] : res?.data;
        if (!data) {
          console.warn("Invoice not found", editingId);
          return;
        }
        if (!mounted) return;

        setInvoiceNo(String(data.invoiceNo ?? data.invoiceNumber ?? data.invoiceID ?? ""));
        setInvoiceDate(dayjs(data.invoiceDate ?? data.invoiceDateString ?? new Date()).format("YYYY-MM-DD"));
        setCustomerName(data.customerName ?? data.customer ?? "");
        setAddress(data.address ?? data.Address ?? "");
        setCity(data.city ?? data.City ?? "");
        setNotes(data.notes ?? data.Notes ?? "");
        setUpdatedOnPrev(data.updatedOn ?? null);

        const loadedLines: LineRow[] = (data.lines ?? data.lineItems ?? []).map((l: any, idx: number) => {
          const qty = Number(l.qty ?? l.quantity ?? 0);
          const rate = Number(l.rate ?? l.saleRate ?? 0);
          const disc = Number(l.discountPct ?? l.discountPct ?? 0);
          const amount = round2(qty * rate - qty * rate * (disc / 100));
          return {
            _uid: uid(),
            itemID: l.itemID ?? l.ItemID ?? null,
            itemName: l.itemName ?? l.ItemName ?? "",
            description: l.description ?? l.Description ?? "",
            qty,
            rate,
            discountPct: disc,
            amount,
            errors: {},
          };
        });
        setLines(loadedLines.length ? loadedLines : [{ _uid: uid(), itemID: null, itemName: "", description: "", qty: 0, rate: 0, discountPct: 0, amount: 0 }]);
      } catch (err) {
        console.error("Failed loading invoice", err);
        setServerError("Failed to load invoice.");
      }
    };

    loadInvoice();
    return () => { mounted = false; };
  }, [editingId]);

  // --- Auto-generate invoice number for new invoices ---
  useEffect(() => {
    if (editingId) return;

    let mounted = true;
    const fetchNext = async () => {
      try {
        if (typeof InvoiceService.getNextNumber === "function") {
          const r = await (InvoiceService as any).getNextNumber();
          const next = r?.data?.nextNumber ?? r?.data?.invoiceNo ?? r?.data;
          if (mounted && next) {
            setInvoiceNo(String(next));
            return;
          }
        }
      } catch (err) {
        console.debug("getNextNumber not available or failed, falling back", err);
      }

      const fallback = `INV-${dayjs().format("YYYY")}-001`;
      if (mounted) setInvoiceNo(fallback);
    };

    fetchNext();
    return () => { mounted = false; };
  }, [editingId]);

  // --- Totals recalculation ---
  useEffect(() => {
    const subtotal = round2(lines.reduce((s, r) => s + (Number(r.amount) || 0), 0));
    setSubTotal(subtotal);
    const newTaxAmt = round2((subtotal * Number(taxPct || 0)) / 100);
    setTaxAmt(newTaxAmt);
    setInvoiceAmount(round2(subtotal + newTaxAmt));
  }, [lines, taxPct]);

  const computeRowAmount = (qty: number, rate: number, discPct: number) => {
    const a = qty * rate;
    const amt = a - (a * (discPct || 0)) / 100;
    return round2(Math.max(0, amt));
  };

  const updateLine = (uid: string, patch: Partial<LineRow>) => {
    setLines((prev) =>
      prev.map((r) => {
        if (r._uid !== uid) return r;
        const updated = { ...r, ...patch } as LineRow;
        if (patch.qty !== undefined || patch.rate !== undefined || patch.discountPct !== undefined) {
          updated.amount = computeRowAmount(Number(updated.qty || 0), Number(updated.rate || 0), Number(updated.discountPct || 0));
        }
        return updated;
      })
    );
  };

  const addRow = (afterUid?: string | null) => {
    const newRow: LineRow = { _uid: uid(), itemID: null, itemName: "", description: "", qty: 0, rate: 0, discountPct: 0, amount: 0, errors: {} };
    setLines((prev) => {
      if (!afterUid) return [...prev, newRow];
      const idx = prev.findIndex((r) => r._uid === afterUid);
      if (idx === -1) return [...prev, newRow];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newRow);
      return copy;
    });
    setSelectedLineUid(newRow._uid);
  };

  const copyRow = (uidToCopy: string) => {
    const src = lines.find((r) => r._uid === uidToCopy);
    if (!src) return;
    const copy: LineRow = { ...src, _uid: uid() };
    setLines((prev) => {
      const idx = prev.findIndex((r) => r._uid === uidToCopy);
      const arr = [...prev];
      arr.splice(idx + 1, 0, copy);
      return arr;
    });
    setSelectedLineUid(copy._uid);
  };

  const deleteRow = (uidToDelete: string) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r._uid !== uidToDelete);
    });
    setSelectedLineUid(null);
  };

  const onPickItem = (uid: string, itemID?: number | null) => {
    const item = itemsOptions.find((i) => i.itemID === Number(itemID));
    updateLine(uid, {
      itemID: itemID ?? null,
      itemName: item?.itemName ?? "",
      description: item?.description ?? "",
      rate: item?.saleRate ?? 0,
      discountPct: item?.discountPct ?? 0,
    });
  };

  const validateAll = (): boolean => {
    let ok = true;
    const next = lines.map((r) => {
      const errors: any = {};
      if (!r.itemID) { errors.itemID = "Pick an item."; ok = false; }
      if (Number(r.qty) <= 0) { errors.qty = "Qty must be > 0"; ok = false; }
      if (Number(r.rate) < 0) { errors.rate = "Rate must be ≥ 0"; ok = false; }
      if (Number(r.discountPct) < 0 || Number(r.discountPct) > 100) { errors.discountPct = "Disc 0–100"; ok = false; }
      return { ...r, errors };
    });

    setLines(next);

    if (!(next.some((r) => Number(r.qty) > 0))) {
      setServerError("Add at least one line with Qty > 0.");
      ok = false;
    } else {
      setServerError(null);
    }

    if (!customerName.trim()) {
      setServerError((s) => (s ? s + " Customer is required." : "Customer is required."));
      ok = false;
    }

    return ok;
  };

  const onTaxAmountChange = (val: number) => {
    setTaxAmt(round2(Math.max(0, val || 0)));
    if (subTotal > 0) {
      const pct = round2((val / subTotal) * 100);
      setTaxPct(isFinite(pct) ? pct : 0);
    } else {
      setTaxPct(0);
    }
    setInvoiceAmount(round2(subTotal + (val || 0)));
  };

  const onSave = async () => {
    setServerError(null);

    const trimmedCustomer = (customerName ?? "").trim();
    if (!trimmedCustomer) {
      setServerError("Customer Name is required. Please enter customer name.");
      return;
    }
    if (!invoiceDate) {
      setServerError("Invoice Date is required. Please pick a date.");
      return;
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      setServerError("Add at least one line.");
      return;
    }

    const invalidLine = lines.find((r) =>
      !r.itemID ||
      Number(r.qty || 0) <= 0 ||
      Number(r.rate || 0) < 0 ||
      Number(r.discountPct || 0) < 0 ||
      Number(r.discountPct || 0) > 100
    );

    if (invalidLine) {
      setServerError("Each line must have an item, qty > 0, rate ≥ 0 and discount 0–100.");
      setLines((prev) =>
        prev.map((r) => {
          if (r._uid !== invalidLine._uid) return r;
          return {
            ...r,
            errors: {
              itemID: !r.itemID ? "Pick an item." : "",
              qty: Number(r.qty) <= 0 ? "Qty must be > 0" : "",
              rate: Number(r.rate) < 0 ? "Rate must be ≥ 0" : "",
              discountPct: Number(r.discountPct) < 0 || Number(r.discountPct) > 100 ? "Disc 0–100" : ""
            }
          };
        })
      );
      return;
    }

    const uiPayload: any = {
      ...(editingId ? { invoiceID: editingId } : {}),
      ...(editingId && invoiceNo ? { invoiceNo: Number(invoiceNo) || 0 } : {}),
      invoiceDate,
      customerName: trimmedCustomer,
      address: address.trim(),
      city: city.trim(),
      notes: notes.trim(),
      taxPercentage: round2(Number(taxPct || 0)),
      taxAmount: round2(Number(taxAmt || 0)),
      subTotal: round2(Number(subTotal || 0)),
      invoiceAmount: round2(Number(invoiceAmount || 0)),
      updatedOnPrev: updatedOnPrev ?? null,
      lines: lines.map((r, idx) => ({
        lineNo: idx + 1,
        itemID: r.itemID,
        description: r.description?.trim() ?? "",
        qty: round2(Number(r.qty || 0)),
        rate: round2(Number(r.rate || 0)),
        discountPct: round2(Number(r.discountPct || 0)),
      })),
    };

    setSaving(true);
    try {
      const res = await InvoiceService.insertUpdate(uiPayload);
      const data = res?.data ?? {};
      const savedId = data.invoiceID ?? data.invoiceId ?? data.id ?? editingId ?? 0;
      const savedInvoiceNo = data.invoiceNo ?? data.InvoiceNo ?? null;
      const updatedOn = data.updatedOn ?? data.updatedOnOn ?? null;

      if (savedId) {
        setUpdatedOnPrev(updatedOn);
        if (savedInvoiceNo !== null && savedInvoiceNo !== undefined) {
          setInvoiceNo(String(savedInvoiceNo));
        }
      }

      alert("Saved.");
      navigate("/invoices");
    } catch (err: any) {
      console.error("Save failed", err);
      const sd = err?.response?.data;
      if (sd?.errors) {
        const messages = Object.entries(sd.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join("\n");
        setServerError(messages);
      } else if (sd?.message) {
        setServerError(sd.message);
      } else {
        setServerError("Save failed. Please check details.");
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); onSave(); }
      if (e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); addRow(selectedLineUid ?? null); }
      if (e.key === "Delete") { if (selectedLineUid) { deleteRow(selectedLineUid); setSelectedLineUid(null); } }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedLineUid, lines, invoiceNo, customerName, subTotal, taxPct, taxAmt]);

  const formatMoney = (v: number) => `${currencySymbol}${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!isAuthenticated) return <Typography>Not authenticated</Typography>;

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, pb: 6, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: "bold" }}>
          {editingId ? "Edit Invoice" : "New Invoice"}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={() => navigate(-1)}
            size={isSmallMobile ? "small" : "medium"}
          >
            {isSmallMobile ? "Cancel" : "Cancel"}
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={onSave}
            disabled={saving}
            size={isSmallMobile ? "small" : "medium"}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </Stack>
      </Box>

      {/* Invoice Details Card */}
      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 3, color: "primary.main" }}>
            Invoice Details
          </Typography>

          <Grid container spacing={3}>
            {/* Left Column */}
            <Grid item xs={12} md={6}>
              <Stack spacing={3}>
                {/* Invoice No */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Invoice No
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="INV-001"
                    sx={{ mb: 0.5 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Auto next available number
                  </Typography>
                </Box>

                {/* Customer Name */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Customer Name *
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    required
                  />
                </Box>

                {/* Address */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Address
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter address"
                  />
                </Box>
              </Stack>
            </Grid>

            {/* Right Column */}
            <Grid item xs={12} md={6}>
              <Stack spacing={3}>
                {/* Invoice Date */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Invoice Date *
                  </Typography>
                  <TextField
                    fullWidth
                    type="date"
                    size="small"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>

                {/* City */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    City
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Enter city"
                  />
                </Box>

                {/* Notes */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Notes
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes"
                  />
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Line Items Card */}
      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: "bold", color: "primary.main" }}>
              Line Items
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => addRow(selectedLineUid ?? null)}
              >
                Add Row
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CopyIcon />}
                onClick={() => selectedLineUid && copyRow(selectedLineUid)}
                disabled={!selectedLineUid}
              >
                Copy
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => selectedLineUid && deleteRow(selectedLineUid)}
                disabled={!selectedLineUid}
              >
                Delete
              </Button>
            </Stack>
          </Box>

          {/* Table for Line Items */}
          <TableContainer component={Paper} variant="outlined">
            <Table sx={{ minWidth: 650 }} size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 'bold', width: '5%' }}>S.No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Item *</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '10%', textAlign: 'right' }}>Qty *</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '10%', textAlign: 'right' }}>Rate *</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '10%', textAlign: 'right' }}>Disc %</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '15%', textAlign: 'right' }}>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((row, idx) => (
                  <TableRow
                    key={row._uid}
                    sx={{
                      backgroundColor: selectedLineUid === row._uid ? 'action.selected' : 'transparent',
                      '&:hover': { backgroundColor: 'action.hover' },
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedLineUid(row._uid)}
                  >
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <FormControl fullWidth size="small">
                        <Select
                          value={row.itemID ?? ""}
                          onChange={(e) => onPickItem(row._uid, e.target.value ? Number(e.target.value) : null)}
                          displayEmpty
                          error={!!row.errors?.itemID}
                        >
                          <MenuItem value="">Select Item...</MenuItem>
                          {itemsOptions.map((it) => (
                            <MenuItem key={it.itemID} value={it.itemID}>
                              {it.itemName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {row.errors?.itemID && (
                        <Typography variant="caption" color="error">
                          {row.errors.itemID}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        value={row.description}
                        onChange={(e) => updateLine(row._uid, { description: e.target.value })}
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        inputProps={{ step: "0.01", min: 0 }}
                        value={row.qty}
                        onChange={(e) => updateLine(row._uid, { qty: Number(e.target.value) })}
                        sx={{ textAlign: 'right' }}
                        error={!!row.errors?.qty}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        inputProps={{ step: "0.01", min: 0 }}
                        value={row.rate}
                        onChange={(e) => updateLine(row._uid, { rate: Number(e.target.value) })}
                        sx={{ textAlign: 'right' }}
                        error={!!row.errors?.rate}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        inputProps={{ step: "0.01", min: 0, max: 100 }}
                        value={row.discountPct}
                        onChange={(e) => updateLine(row._uid, { discountPct: Number(e.target.value) })}
                        sx={{ textAlign: 'right' }}
                        error={!!row.errors?.discountPct}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {formatMoney(row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Subtotal */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Box sx={{ textAlign: 'right', minWidth: 200 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Subtotal: {formatMoney(subTotal)}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Invoice Totals Card */}
      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 3, color: "primary.main" }}>
            Invoice Totals
          </Typography>

          <Grid container spacing={3} alignItems="flex-end">
            <Grid item xs={12} md={6}>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                  <Typography variant="body1">Sub Total</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {formatMoney(subTotal)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                  <Typography variant="body1">Tax</Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{ step: "0.01", min: 0, max: 100 }}
                      value={taxPct}
                      onChange={(e) => setTaxPct(round2(Number(e.target.value || 0)))}
                      sx={{ width: 80 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      %
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{ step: "0.01", min: 0 }}
                      value={taxAmt}
                      onChange={(e) => onTaxAmountChange(Number(e.target.value || 0))}
                      sx={{ width: 100 }}
                    />
                  </Box>
                </Box>
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{
                textAlign: 'center',
                p: 3,
                backgroundColor: 'primary.light',
                borderRadius: 2,
                border: '2px solid',
                borderColor: 'primary.main'
              }}>
                <Typography variant="body2" color="primary.dark" sx={{ mb: 1 }}>
                  Invoice Amount
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>
                  {formatMoney(invoiceAmount)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {serverError && (
        <Typography color="error" sx={{ mt: 2, p: 2, backgroundColor: 'error.light', borderRadius: 1 }}>
          {serverError}
        </Typography>
      )}
    </Box>
  );
}
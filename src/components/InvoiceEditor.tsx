import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, MenuItem, IconButton, Typography
} from "@mui/material";
import { ItemService } from "../services/item.service";
import { InvoiceService } from "../services/invoice.service";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

type Line = {
  invoiceLineID?: number | null;
  itemID?: number | null;
  description?: string;
  qty: number;
  rate: number;
  discountPct: number;
  amount: number;
};

type Props = {
  open?: boolean;
  record?: any | null;
  onClose?: () => void;
};

export default function InvoiceEditor({ open = true, record = null, onClose }: Props) {
  const isEdit = !!record;
  const [itemsLookup, setItemsLookup] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const initial = {
    invoiceID: record?.invoiceID ?? 0,
    invoiceNumber: record?.invoiceNumber ?? "NEW",
    date: record?.date ?? new Date().toISOString().substring(0,10),
    customerName: record?.customerName ?? "",
    taxPct: record?.taxPct ?? 0,
    taxAmount: record?.taxAmount ?? 0,
    subTotal: 0,
    invoiceAmount: 0,
    updatedOnPrev: record?.updatedOn ?? null,
    lines: (record?.lines ?? []).map((l:any) => ({
      invoiceLineID: l.invoiceLineID,
      itemID: l.itemID,
      description: l.description,
      qty: l.qty,
      rate: l.rate,
      discountPct: l.discountPct,
      amount: l.amount
    })) as Line[]
  };

  const [state, setState] = useState<any>(initial);

  useEffect(()=> {
    setState(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  useEffect(() => {
    (async () => {
      try {
        const res = await ItemService.getLookup();
        setItemsLookup(res.data ?? []);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Recompute amounts whenever lines or tax changes
  const recompute = useCallback((s:any) => {
    const lines: Line[] = (s.lines ?? []).map((ln:Line) => {
      const amt = Math.max(0, ln.qty) * Math.max(0, ln.rate) * (1 - Math.max(0, Math.min(100, ln.discountPct))/100);
      return { ...ln, amount: Math.round(amt*100)/100 };
    });
    const subTotal = Math.round((lines.reduce((a,b)=>a + (b.amount || 0), 0))*100)/100;
    let taxAmount = s.taxAmount ?? 0;
    const taxPct = s.taxPct ?? 0;

    // If taxPct has changed, compute taxAmount; if taxAmount changed externally we'll handle via UI interactions
    // Rule: if taxPct provided and taxAmount is not manually edited (we don't track manual edit separately here)
    taxAmount = Math.round((subTotal * (taxPct/100))*100)/100;
    const invoiceAmount = Math.round((subTotal + taxAmount)*100)/100;

    return { ...s, lines, subTotal, taxAmount, invoiceAmount };
  }, []);

  useEffect(()=> {
    setState(prev => recompute(prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lines?.length, state.taxPct]);

  const updateLine = (index:number, patch:Partial<Line>) => {
    setState((s:any) => {
      const lines = [...(s.lines ?? [])];
      lines[index] = { ...lines[index], ...patch };
      // auto-fill description, rate, discount when itemID set
      if (patch.itemID && patch.itemID !== lines[index].itemID) {
        const it = itemsLookup.find(i => i.itemID === patch.itemID);
        if (it) {
          lines[index].description = it.description ?? it.itemName;
          lines[index].rate = it.saleRate ?? lines[index].rate;
          lines[index].discountPct = it.discountPct ?? lines[index].discountPct ?? 0;
        }
      }
      return recompute({ ...s, lines });
    });
  };

  const addLine = () => {
    setState((s:any) => recompute({
      ...s,
      lines: [...(s.lines ?? []), { invoiceLineID: null, itemID: null, description: "", qty: 1, rate: 0, discountPct: 0, amount: 0 }]
    }));
  };

  const removeLine = (index:number) => {
    setState((s:any) => {
      const lines = [...(s.lines ?? [])];
      lines.splice(index,1);
      return recompute({ ...s, lines });
    });
  };

  // Keyboard shortcuts
  useEffect(()=> {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault(); addLine();
      } else if (e.key === "Delete") {
        // delete last line
        if ((state.lines ?? []).length > 0) {
          removeLine((state.lines ?? []).length - 1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const validate = () => {
    if (!state.customerName || !state.customerName.trim()) return "Customer name is required.";
    if (!state.lines || state.lines.length === 0) return "Add at least one line.";
    for (const ln of state.lines) {
      if (!ln.itemID) return "Each line must have an item selected.";
      if (ln.qty <= 0) return "Qty must be > 0.";
    }
    return null;
  };

  const handleSave = async () => {
    setErr(null);
    const v = validate();
    if (v) { setErr(v); return; }
    setSaving(true);
    try {
      const payload = {
        invoiceID: state.invoiceID || 0,
        invoiceNumber: state.invoiceNumber,
        date: state.date,
        customerName: state.customerName,
        taxPct: state.taxPct,
        taxAmount: state.taxAmount,
        subTotal: state.subTotal,
        invoiceAmount: state.invoiceAmount,
        updatedOnPrev: state.updatedOnPrev,
        lines: state.lines.map((l: Line) => ({
          invoiceLineID: l.invoiceLineID,
          itemID: l.itemID,
          description: l.description,
          qty: l.qty,
          rate: l.rate,
          discountPct: l.discountPct
        }))
      };

      let res;
      if (isEdit) res = await InvoiceService.update(payload);
      else res = await InvoiceService.insert(payload);

      // server should return updated invoice and updatedOn
      onClose && onClose();
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) setErr("Duplicate invoice/number conflict.");
      else if (status === 412) setErr("Invoice was modified by another user; reload and try again.");
      else setErr(e?.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  // Small UI to render lines
  return (
    <Dialog open={open} onClose={() => onClose && onClose()} fullWidth maxWidth="md">
      <DialogTitle>{isEdit ? "Edit Invoice" : "New Invoice"}</DialogTitle>
      <DialogContent>
        <Box display="grid" gridTemplateColumns="1fr 200px" gap={2} mb={2}>
          <TextField label="Customer" value={state.customerName} onChange={(e)=>setState((s:any)=>({ ...s, customerName: e.target.value }))} />
          <TextField label="Date" type="date" value={state.date} onChange={(e)=>setState((s:any)=>({ ...s, date: e.target.value }))} InputLabelProps={{ shrink: true }} />
        </Box>

        <Box mb={1} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1">Lines</Typography>
          <Button startIcon={<AddIcon />} onClick={addLine}>Add line</Button>
        </Box>

        <Box>
          {state.lines && state.lines.map((ln:Line, idx:number) => (
            <Box key={idx} display="grid" gridTemplateColumns="200px 1fr 100px 100px 100px 40px" gap={1} alignItems="center" mb={1}>
              <TextField select label="Item" value={ln.itemID ?? ""} onChange={(e) => updateLine(idx, { itemID: Number(e.target.value) })}>
                <MenuItem value="">-- select --</MenuItem>
                {itemsLookup.map(it => <MenuItem key={it.itemID} value={it.itemID}>{it.itemName}</MenuItem>)}
              </TextField>
              <TextField label="Description" value={ln.description} onChange={(e)=>updateLine(idx, { description: e.target.value })} />
              <TextField label="Qty" type="number" value={ln.qty} onChange={(e)=>updateLine(idx, { qty: Math.max(0, Number(e.target.value)) })} />
              <TextField label="Rate" type="number" value={ln.rate} onChange={(e)=>updateLine(idx, { rate: Math.max(0, Number(e.target.value)) })} />
              <TextField label="Disc %" type="number" value={ln.discountPct} onChange={(e)=>updateLine(idx, { discountPct: Math.max(0, Math.min(100, Number(e.target.value))) })} />
              <Box display="flex" alignItems="center">
                <Typography>{ln.amount?.toFixed(2) ?? "0.00"}</Typography>
                <IconButton size="small" onClick={()=>removeLine(idx)}><DeleteIcon fontSize="small" /></IconButton>
              </Box>
            </Box>
          ))}
        </Box>

        <Box display="flex" justifyContent="flex-end" gap={2} mt={2} alignItems="center">
          <TextField label="SubTotal" value={state.subTotal?.toFixed(2) ?? "0.00"} InputProps={{ readOnly: true }} />
          <TextField label="Tax %" type="number" value={state.taxPct} onChange={(e)=>setState((s:any)=>recompute({ ...s, taxPct: Number(e.target.value) }))} />
          <TextField label="Tax amount" value={state.taxAmount?.toFixed(2) ?? "0.00"} InputProps={{ readOnly: true }} />
          <TextField label="Invoice amount" value={state.invoiceAmount?.toFixed(2) ?? "0.00"} InputProps={{ readOnly: true }} />
        </Box>

        {err && <Typography color="error" mt={2}>{err}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose && onClose()}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save (Ctrl+Enter)"}</Button>
      </DialogActions>
    </Dialog>
  );
}
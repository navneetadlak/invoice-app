import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
  FormHelperText,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import UploadIcon from "@mui/icons-material/UploadFile";
import { ItemService } from "../services/item.service";

type Props = {
  open: boolean;
  record?: any | null; // when editing: shape should include itemID, itemName, description, saleRate, discountPct, updatedOn, hasPicture
  onClose: () => void;
  onSaved?: (itemID: number) => void; // callback so parent can refresh single row
};

export default function ItemEditor({ open, record = null, onClose, onSaved }: Props) {
  const isEdit = !!record?.itemID;

  const [form, setForm] = useState({
    itemID: record?.itemID ?? 0,
    itemName: record?.itemName ?? "",
    description: record?.description ?? "",
    saleRate: record?.saleRate ?? 0,
    discountPct: record?.discountPct ?? 0,
  });

  // track updatedOn for concurrency (backend returns updatedOn)
  const [updatedOnPrev, setUpdatedOnPrev] = useState<string | null>(record?.updatedOn ?? null);

  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({
        itemID: record.itemID ?? 0,
        itemName: record.itemName ?? "",
        description: record.description ?? "",
        saleRate: record.saleRate ?? 0,
        discountPct: record.discountPct ?? 0,
      });
      setUpdatedOnPrev(record.updatedOn ?? null);
      // if record has image thumbnail endpoint, parent can set preview via record.thumbnailUrl
      if (record.hasPicture && record.itemID) {
        // assemble thumbnail URL (adjust if your backend differs)
        const url = `${import.meta.env.VITE_API_BASE_URL}/Item/PictureThumbnail/${record.itemID}`;
        setPicturePreview(url);
      } else {
        setPicturePreview(null);
      }
    } else {
      // new
      setForm({ itemID: 0, itemName: "", description: "", saleRate: 0, discountPct: 0 });
      setUpdatedOnPrev(null);
      setPictureFile(null);
      setPicturePreview(null);
      setErrors({});
    }
  }, [record, open]);

  // Image change
  const onFileChange = (f: File | null) => {
    if (!f) {
      setPictureFile(null);
      setPicturePreview(null);
      return;
    }
    if (!["image/png", "image/jpeg"].includes(f.type)) {
      setErrors((s) => ({ ...s, Picture: "Only PNG or JPG files are allowed." }));
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErrors((s) => ({ ...s, Picture: "Max file size is 5 MB." }));
      return;
    }
    setErrors((s) => ({ ...s, Picture: "" }));
    setPictureFile(f);
    setPicturePreview(URL.createObjectURL(f));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.itemName.trim()) e.itemName = "Please enter item name.";
    else if (form.itemName.trim().length > 50) e.itemName = "Item name must be 50 characters or less.";
    if ((form.description ?? "").length > 500) e.description = "Description must be 500 characters or less.";
    if (Number.isNaN(Number(form.saleRate)) || Number(form.saleRate) < 0) e.saleRate = "Enter a valid rate (≥ 0).";
    if (Number.isNaN(Number(form.discountPct)) || Number(form.discountPct) < 0 || Number(form.discountPct) > 100)
      e.discountPct = "Discount must be between 0 and 100.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mapServerErrors = (data: any) => {
    const mapped: Record<string, string> = {};
    if (!data) return mapped;
    if (data.errors && typeof data.errors === "object") {
      for (const k of Object.keys(data.errors)) {
        const val = data.errors[k];
        mapped[k] = Array.isArray(val) ? val.join(" ") : String(val);
      }
    } else if (data.message) {
      mapped._global = String(data.message);
    }
    return mapped;
  };

  const handleSave = async () => {
    if (!validate()) return;

    // Build FormData (backend expects multipart when picture included)
    const fd = new FormData();
    // IMPORTANT: use the exact field names your backend expects; adjust keys below if necessary.
    fd.append("ItemID", String(form.itemID ?? 0));
    fd.append("ItemName", form.itemName.trim());
    fd.append("Description", form.description ?? "");
    // For numeric fields append as string to preserve format
    fd.append("SaleRate", String(Number(form.saleRate || 0)));
    fd.append("DiscountPct", String(Number(form.discountPct || 0)));
    // updatedOnPrev is required for update concurrency; null for new
    if (updatedOnPrev) fd.append("updatedOnPrev", updatedOnPrev);
    else fd.append("updatedOnPrev", "");

    if (pictureFile) {
      // key name depends on backend; "picture" or "itemPicture" etc — change if needed
      fd.append("picture", pictureFile);
    }

    setSaving(true);
    setErrors({});

    try {
      let res;
      // call insert or update endpoint depending on itemID
      if (isEdit && form.itemID) {
        // try to call an "insertupdate" if your ItemService exposes it; otherwise call update
        if ((ItemService as any).insertUpdate) {
          res = await (ItemService as any).insertUpdate(fd);
        } else if ((ItemService as any).updateWithForm) {
          // hypothetical
          res = await (ItemService as any).updateWithForm(fd);
        } else {
          // fallback: hit update endpoint with FormData (your ItemService.update must accept FormData)
          res = await ItemService.update(fd as any);
        }
      } else {
        // insert
        if ((ItemService as any).insertForm) {
          res = await (ItemService as any).insertForm(fd);
        } else {
          res = await ItemService.insert(fd as any);
        }
      }

      // Expect success { itemID, updatedOn } or similar
      const newId = res?.data?.itemID ?? res?.data?.id ?? form.itemID;
      if (onSaved) onSaved(Number(newId));
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        // duplicate
        setErrors((s) => ({ ...s, itemName: "Name already exists." }));
      } else if (status === 412) {
        setErrors((s) => ({ ...s, _global: "Item updated by another user. Please reload and try again." }));
      } else if (err?.response?.data) {
        const mapped = mapServerErrors(err.response.data);
        setErrors((s) => ({ ...s, ...mapped }));
      } else {
        setErrors((s) => ({ ...s, _global: "Save failed. Please try again." }));
      }
    } finally {
      setSaving(false);
    }
  };

  // small helpers
  const handleChange = (key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
        <Typography variant="h6">{isEdit ? "Edit Item" : "New Item"}</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "220px 1fr" }} gap={3} alignItems="start">
          {/* Left: picture & upload */}
          <Box>
            <Box
              sx={{
                width: 180,
                height: 120,
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1,
                bgcolor: "background.paper",
                overflow: "hidden"
              }}
            >
              {picturePreview ? (
                <img src={picturePreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Typography variant="caption" color="text.secondary">Preview</Typography>
              )}
            </Box>

            <Button variant="outlined" component="label" startIcon={<UploadIcon />}>
              Choose picture
              <input hidden type="file" accept="image/png,image/jpeg" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
              PNG or JPG, max 5MB
            </Typography>
            {errors.Picture && <FormHelperText error>{errors.Picture}</FormHelperText>}
          </Box>

          {/* Right: fields */}
          <Box>
            <TextField
              label="Item Name*"
              fullWidth
              value={form.itemName}
              onChange={(e) => handleChange("itemName", e.target.value)}
              error={!!errors.itemName}
              helperText={errors.itemName}
              inputProps={{ maxLength: 50 }}
              sx={{ mb: 1 }}
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={4}
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              error={!!errors.description}
              helperText={errors.description ?? `${(form.description ?? "").length}/500`}
              inputProps={{ maxLength: 500 }}
              sx={{ mb: 1 }}
            />

            <Box display="flex" gap={2} alignItems="center" sx={{ mt: 1 }}>
              <TextField
                label="Sale Rate*"
                value={form.saleRate}
                onChange={(e) => handleChange("saleRate", e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end" sx={{ pr: 1 }}><Typography variant="body2"> </Typography></InputAdornment>,
                }}
                type="number"
                inputProps={{ step: "0.01", min: 0 }}
                error={!!errors.saleRate}
                helperText={errors.saleRate}
                sx={{ flex: 1 }}
              />

              <TextField
                label="Discount %"
                value={form.discountPct}
                onChange={(e) => {
                  const val = e.target.value;
                  handleChange("discountPct", val);
                }}
                InputProps={{
                  endAdornment: <InputAdornment position="end"><Typography variant="body2">%</Typography></InputAdornment>
                }}
                type="number"
                inputProps={{ step: "0.01", min: 0, max: 100 }}
                error={!!errors.discountPct}
                helperText={errors.discountPct}
                sx={{ width: 160 }}
              />
            </Box>

            {errors._global && <Typography color="error" sx={{ mt: 1 }}>{errors._global}</Typography>}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
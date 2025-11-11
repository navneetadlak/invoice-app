import api from "../api";

const normalizeItem = (r: any) => ({
  primaryKeyID: r.primaryKeyID ?? r.PrimaryKeyID ?? null,
  itemID: r.itemID ?? r.ItemID ?? r.primaryKeyID ?? null,
  itemName: r.itemName ?? r.ItemName ?? "",
  description: r.description ?? r.Description ?? "",
  saleRate: Number(r.saleRate ?? r.SaleRate ?? r.salesRate ?? r.SalesRate ?? 0) || 0,
  discountPct: Number(r.discountPct ?? r.DiscountPct ?? r.discount ?? 0) || 0,
  hasPicture: !!(r.hasPicture ?? r.HasPicture ?? r.pictureExists ?? false),
  __raw: r
});

export const ItemService = {
  getList: async () => {
    const res = await api.get("/Item/GetList");
    console.warn("[DEBUG] ItemService.getList raw response:", res.data);
    const data = (res.data ?? []).map(normalizeItem);
    return { ...res, data };
  },

  getLookup: () => api.get("/Item/GetLookupList"),
  insert: (payload: any) => api.post("/Item", payload),
  update: (payload: any) => api.put("/Item", payload),
  delete: (id: number) => api.delete(`/Item/${id}`),
  getPictureThumbnail: (id: number) =>
    api.get(`/Item/PictureThumbnail/${id}`, { responseType: "blob" }),

  insertForm: (fd: FormData) =>
    api.post("/Item", fd, { headers: { "Content-Type": "multipart/form-data" } }),

  updateForm: (fd: FormData) =>
    api.put("/Item", fd, { headers: { "Content-Type": "multipart/form-data" } }),

  insertUpdateForm: (fd: FormData) =>
    api.post("/Item/InsertUpdate", fd, { headers: { "Content-Type": "multipart/form-data" } }),

};

const router = require('express').Router();
const { StockItem } = require('../models');
const { asyncHandler, HttpError, escapeRegex, qstr } = require('../utils/http');
const { validate, validId, z, text, reqText } = require('../middleware/validate');
const { requireAccess } = require('../middleware/auth');

// GET /api/stock?q=&status=ok|low|out
router.get('/', requireAccess('stock'), asyncHandler(async (req, res) => {
  const filter = { clinicId: req.clinicId };
  const q = qstr(req.query.q);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { category: rx }];
  }
  let items = (await StockItem.find(filter).sort({ nameKey: 1 }).limit(1000)).map((d) => d.toJSON());
  const status = qstr(req.query.status);
  if (['ok', 'low', 'out'].includes(status)) items = items.filter((i) => i.stockStatus === status);
  const summary = { total: items.length, low: items.filter((i) => i.stockStatus === 'low').length, out: items.filter((i) => i.stockStatus === 'out').length };
  res.json({ items, summary });
}));

// POST /api/stock — add a new item, or restock (adds quantity) if the name exists
router.post('/', requireAccess('stock', 'edit'), validate(z.object({
  name: reqText('Item name', 120),
  category: text(80).optional().default(''),
  quantity: z.coerce.number().min(0, 'Quantity cannot be negative').max(1e7),
  unit: text(30).optional().default('Units'),
  lowThreshold: z.coerce.number().min(0).max(1e6).optional(),
})), asyncHandler(async (req, res) => {
  const { name, quantity, ...rest } = req.body;
  const existing = await StockItem.findOne({ clinicId: req.clinicId, nameKey: StockItem.keyOf(name) });
  if (existing) {
    existing.quantity += quantity;
    if (rest.category) existing.category = rest.category;
    if (rest.unit) existing.unit = rest.unit;
    if (rest.lowThreshold !== undefined) existing.lowThreshold = rest.lowThreshold;
    existing.updatedByName = req.user.name;
    await existing.save();
    return res.json({ item: existing.toJSON(), restocked: true });
  }
  const item = await StockItem.create({ ...rest, name, quantity, clinicId: req.clinicId, updatedByName: req.user.name });
  return res.status(201).json({ item: item.toJSON(), restocked: false });
}));

// PATCH /api/stock/:id — set exact values
router.patch('/:id', validId('id'), requireAccess('stock', 'edit'), validate(z.object({
  name: reqText('Item name', 120).optional(),
  category: text(80).optional(),
  quantity: z.coerce.number().min(0, 'Quantity cannot be negative').max(1e7).optional(),
  unit: text(30).optional(),
  lowThreshold: z.coerce.number().min(0).max(1e6).optional(),
})), asyncHandler(async (req, res) => {
  const set = { ...req.body, updatedByName: req.user.name };
  Object.keys(set).forEach((k) => set[k] === undefined && delete set[k]);
  if (set.name) set.nameKey = StockItem.keyOf(set.name);
  const item = await StockItem.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, { $set: set }, { new: true, runValidators: true });
  if (!item) throw new HttpError(404, 'Item not found.');
  res.json(item.toJSON());
}));

// DELETE /api/stock/:id
router.delete('/:id', validId('id'), requireAccess('stock', 'edit'), asyncHandler(async (req, res) => {
  const r = await StockItem.deleteOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!r.deletedCount) throw new HttpError(404, 'Item not found.');
  res.json({ message: 'Item removed.' });
}));

module.exports = router;

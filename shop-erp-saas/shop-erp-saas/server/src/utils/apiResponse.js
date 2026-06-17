export const ok = (res, data = {}, message = 'Success', status = 200) =>
  res.status(status).json({ success: true, message, data });

export const created = (res, data = {}, message = 'Created') =>
  res.status(201).json({ success: true, message, data });

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { asyncHandler, authenticate, internalOnly, signToken, validate, conflict, unauthorized, notFound, cacheAside, invalidate } = require('@news/common');
const repo = require('./repository');

// POST /auth/register
router.post('/auth/register', asyncHandler(async (req, res) => {
  const { email, password, name } = validate(req.body, {
    email: { type: 'string', required: true, max: 200 }, password: { type: 'string', required: true, min: 8 }, name: { type: 'string', required: true } });
  if (await repo.findByEmail(email)) throw conflict('Email already registered');
  const user = await repo.createUser({ email, name, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ user, token: signToken(user) });
}));

// POST /auth/login
router.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = validate(req.body, { email: { type: 'string', required: true }, password: { type: 'string', required: true } });
  const user = await repo.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw unauthorized('Invalid credentials');
  res.json({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

// GET /users/me
router.get('/users/me', authenticate, asyncHandler(async (req, res) => {
  const user = await repo.findById(req.user.id);
  if (!user) throw notFound('User not found');
  res.json({ ...user, preferences: await repo.getPreferences(req.user.id) });
}));

// PUT /users/me/preferences
router.put('/users/me/preferences', authenticate, asyncHandler(async (req, res) => {
  const prefs = await repo.updatePreferences(req.user.id, req.body);
  await invalidate(`prefs:${req.user.id}`);
  res.json(prefs);
}));

// POST /users/me/devices   (register FCM/APNs token for push)
router.post('/users/me/devices', authenticate, asyncHandler(async (req, res) => {
  const { token, platform } = validate(req.body, { token: { type: 'string', required: true }, platform: { type: 'string', required: true, enum: ['ios', 'android', 'web'] } });
  await repo.addDevice(req.user.id, token, platform);
  res.status(204).end();
}));

// ---- Internal (service-to-service) ----
router.get('/internal/users/:id/preferences', internalOnly, asyncHandler(async (req, res) => {
  const prefs = await cacheAside(`prefs:${req.params.id}`, 300, () => repo.getPreferences(req.params.id));
  if (!prefs) throw notFound();
  res.json(prefs);
}));
router.post('/internal/users/delivery-profiles', internalOnly, asyncHandler(async (req, res) =>
  res.json(await repo.getDeliveryProfiles(req.body.userIds || []))));

module.exports = router;

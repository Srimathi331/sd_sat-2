const { badRequest } = require('./errors');

/** Tiny validator: rules = { field: { type:'string', required:true, min:1, max:200 } } */
function validate(body, rules) {
  const errors = [];
  for (const [field, rule] of Object.entries(rules)) {
    const v = body?.[field];
    if (v === undefined || v === null) { if (rule.required) errors.push(`${field} is required`); continue; }
    if (rule.type === 'array' ? !Array.isArray(v) : typeof v !== rule.type) { errors.push(`${field} must be ${rule.type}`); continue; }
    if (rule.min && (v.length ?? v) < rule.min) errors.push(`${field} too short/small`);
    if (rule.max && (v.length ?? v) > rule.max) errors.push(`${field} too long/large`);
    if (rule.enum && !rule.enum.includes(v)) errors.push(`${field} must be one of ${rule.enum.join(', ')}`);
  }
  if (errors.length) throw badRequest('Validation failed', errors);
  return body;
}
module.exports = { validate };

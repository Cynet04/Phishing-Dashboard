const defaults = [
  { id: 'generic', name: 'Generic Security Notice', subject: 'Action required: verify your account', body: 'We noticed unusual activity. Please verify your account to avoid interruption.', preview: 'We noticed unusual activity. Please verify your account to avoid interruption.' },
  { id: 'password-reset', name: 'Password Reset', subject: 'Password reset requested', body: 'A password reset was requested for your account. Confirm if this was you.', preview: 'A password reset was requested for your account. Confirm if this was you.' },
  { id: 'invoice', name: 'Shared Invoice', subject: 'Invoice #1842 shared with you', body: 'A document was shared with you. Review the invoice details.', preview: 'A document was shared with you. Review the invoice details.' },
];

function allTemplates(dbModule) {
  const custom = dbModule && dbModule.listCustomTemplates ? dbModule.listCustomTemplates() : [];
  return [...custom, ...defaults.filter(d => !custom.some(c => c.id === d.id))];
}

module.exports = { templates: defaults, allTemplates };

# Controller Stubs

The following controllers need to be implemented following the same pattern as `client.controller.js`:

## auth.controller.js
- login()
- logout()
- refreshToken()
- getCurrentUser()

## voucher.controller.js
- getVouchers()
- getVoucherById()
- getVoucherByCode()
- createVoucher() - with repeat voucher logic
- checkRepeatVoucher()
- updateVoucher()
- fulfillVoucher()
- cancelVoucher()
- getPrintableVoucher()

## centre.controller.js
- getCentres()
- getCentreById()
- createCentre()
- updateCentre()
- deleteCentre()

## user.controller.js
- getUsers()
- getUserById()
- createUser()
- updateUser()
- deactivateUser()
- assignCentres()

## report.controller.js
- getDashboard()
- getVoucherReport()
- getClientReport()
- exportData()

## audit.controller.js
- getAuditLogs()
- getAuditLogById()

Each controller should:
1. Use corresponding service for business logic
2. Log audit trails for sensitive operations
3. Handle errors appropriately
4. Validate input data
5. Respect user role and centre access permissions

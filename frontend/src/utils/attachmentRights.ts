// Ticket files are evidence for resolving the ticket: anyone involved can add them, but only
// Super Admin / Admin may remove one (the server enforces the same rule). Tested in attachmentRights.test.ts.
export function canRemoveAttachment(roles: string[] | undefined | null): boolean {
  return (roles || []).some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN');
}

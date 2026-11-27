// How a "department name" typed on a user (bulk import / API) is used.
//
// RULE: a department NAME never creates a Department. On 25 Nov 2026 a bulk import silently
// created six support departments (SALES, Legal, ...) with no head, teams or SLA policies.
// Departments are created only by a Super Admin on the Departments page.
//   - name matches an existing department  -> the user is linked to it (departmentId)
//   - name matches nothing                 -> nothing is created; the typed text is kept on the
//                                             user as their own ("raiser") department name
// Unit-tested in user_department_name.test.ts.
export interface DepartmentRef { id: string; name: string }

export function resolveDepartmentName(
  typedName: string | null | undefined,
  existing: DepartmentRef[],
): { departmentId: string | null; raiserDepartmentName: string | null } {
  const name = (typedName || '').trim();
  if (!name) return { departmentId: null, raiserDepartmentName: null };
  const hit = existing.find((d) => d.name.trim().toLowerCase() === name.toLowerCase());
  if (hit) return { departmentId: hit.id, raiserDepartmentName: null };
  return { departmentId: null, raiserDepartmentName: name.slice(0, 150) };
}

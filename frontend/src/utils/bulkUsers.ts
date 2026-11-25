// Bulk user import: CSV template + file reader. Unit-tested in bulkUsers.test.ts.
//
// The "Department Raiser Name" column was removed from bulk import. Old files that still have it
// keep working: with headers the column is simply ignored; without headers a row with 9 columns is
// read in the old layout (the 4th column is skipped).

export interface BulkUserFields {
  employeeId: string;
  firstName: string;
  departmentName: string;
  designations: string;
  branch: string;
  state: string;
  phone: string;
  email: string;
  role: string;
  temporaryPassword: string;
}

export const BULK_CSV_HEADER = 'employeeId,firstName,department name,desginations,BRANCH,STATE,MOBILE NO,Mail Id\n';
export const BULK_CSV_SAMPLE_ROWS =
  '1001,PUSHPENDRA PRATAP SINGH,,MANAGER,ROSHAN TOWER JAIPUR HO,RAJASTHAN,9799954635,pushpendra.gora@lifc.in\n' +
  '1002,PRIYA VERMA,IT SUPPORT,EXECUTIVE,MUMBAI HO,MAHARASHTRA,9876543211,priya.verma@lifc.in\n';
export const BULK_CSV_TEMPLATE = BULK_CSV_HEADER + BULK_CSV_SAMPLE_ROWS;

const DEFAULT_PASSWORD = 'LaxmiUser@123';

export function parseBulkUsersCsv(
  text: string,
  opts: { defaultRole: string; idPrefix: string; idStartNum: number },
): { rows: BulkUserFields[]; error?: string } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], error: 'File is empty or missing headers' };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));

  const findCol = (...aliases: string[]) => {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias.toLowerCase().replace(/[\s_-]+/g, ''));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idIdx = findCol('employeeid', 'employee', 'empid', 'id', 'emplo', 'code');
  const fnIdx = findCol('firstname', 'name', 'fullname', 'first_name', 'employeename');
  const deptIdx = findCol('departmentname', 'department', 'deptname', 'dept');
  const desigIdx = findCol('desginations', 'designations', 'designation', 'jobtitle', 'title');
  const branchIdx = findCol('branch', 'branchname', 'site', 'location');
  const stateIdx = findCol('state', 'region');
  const phoneIdx = findCol('mobileno', 'mobile', 'phone', 'phonenumber');
  const emailIdx = findCol('mailid', 'mail_id', 'email', 'emailaddress', 'mail');
  const roleIdx = findCol('role', 'userrole');
  const passIdx = findCol('temporarypassword', 'temppassword', 'password', 'pass');

  const usePositional = emailIdx === -1 && fnIdx === -1;
  const rows: BulkUserFields[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    let c: (n: number) => string;
    if (usePositional) {
      // New layout has 8 columns; an old 9-column row still carries "department raiser name" at index 3.
      const legacy = cols.length >= 9;
      c = (n) => cols[legacy && n >= 3 ? n + 1 : n] || '';
    } else {
      c = () => '';
    }
    const byHeader = (idx: number) => (idx !== -1 ? cols[idx] || '' : '');

    const employeeId = (usePositional ? c(0) : byHeader(idIdx)) || `${opts.idPrefix}${opts.idStartNum + i - 1}`;
    const firstName = usePositional ? c(1) : byHeader(fnIdx);
    const departmentName = usePositional ? c(2) : byHeader(deptIdx);
    const designations = usePositional ? c(3) : byHeader(desigIdx);
    const branch = usePositional ? c(4) : byHeader(branchIdx);
    const state = usePositional ? c(5) : byHeader(stateIdx);
    const phone = usePositional ? c(6) : byHeader(phoneIdx);
    const email = usePositional ? c(7) : byHeader(emailIdx);
    const roleVal = byHeader(roleIdx);
    const temporaryPassword = byHeader(passIdx) || DEFAULT_PASSWORD;

    if (!email && !firstName) continue;

    rows.push({
      employeeId,
      firstName,
      departmentName,
      designations,
      branch,
      state,
      phone,
      email,
      role: roleVal ? roleVal.toUpperCase().replace(/\s+/g, '_') : opts.defaultRole,
      temporaryPassword,
    });
  }

  if (rows.length === 0) return { rows: [], error: 'No valid user data found in file' };
  return { rows };
}

import { describe, it, expect } from 'vitest';
import { parseBulkUsersCsv, BULK_CSV_HEADER, BULK_CSV_TEMPLATE } from './bulkUsers';

const opts = { defaultRole: 'RAISER', idPrefix: '100', idStartNum: 1 };

describe('bulk user import template', () => {
  it('has no Department Raiser Name column', () => {
    expect(BULK_CSV_HEADER.toLowerCase()).not.toContain('raiser');
    expect(BULK_CSV_HEADER.trim().split(',')).toHaveLength(8);
  });
  it('the downloaded template loads back with every field in the right place', () => {
    const { rows, error } = parseBulkUsersCsv(BULK_CSV_TEMPLATE, opts);
    expect(error).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      employeeId: '1001', firstName: 'PUSHPENDRA PRATAP SINGH', departmentName: '', designations: 'MANAGER',
      branch: 'ROSHAN TOWER JAIPUR HO', state: 'RAJASTHAN', phone: '9799954635', email: 'pushpendra.gora@lifc.in',
    });
    expect(rows[1]).toMatchObject({ departmentName: 'IT SUPPORT', designations: 'EXECUTIVE', email: 'priya.verma@lifc.in' });
    expect(Object.keys(rows[0])).not.toContain('departmentRaiserName');
  });
});

describe('old files that still have the raiser-name column keep working', () => {
  it('with a header row: the column is ignored, other columns map by name', () => {
    const csv =
      'employeeId,firstName,department name,department raiser name,desginations,BRANCH,STATE,MOBILE NO,Mail Id\n' +
      '1001,A B,IT SUPPORT,VIKAS GUPTA,EXECUTIVE,MUMBAI HO,MAHARASHTRA,9876543211,a.b@lifc.in\n';
    const { rows } = parseBulkUsersCsv(csv, opts);
    expect(rows[0]).toMatchObject({ departmentName: 'IT SUPPORT', designations: 'EXECUTIVE', branch: 'MUMBAI HO', email: 'a.b@lifc.in' });
    expect(JSON.stringify(rows[0])).not.toContain('VIKAS GUPTA');
  });
  it('without recognisable headers: a 9-column row skips the 4th column', () => {
    const csv = 'x1,x2,x3,x4,x5,x6,x7,x8,x9\n1001,A B,IT SUPPORT,VIKAS GUPTA,EXECUTIVE,MUMBAI HO,MAHARASHTRA,9876543211,a.b@lifc.in\n';
    const { rows } = parseBulkUsersCsv(csv, opts);
    expect(rows[0]).toMatchObject({ firstName: 'A B', designations: 'EXECUTIVE', email: 'a.b@lifc.in', phone: '9876543211' });
  });
  it('without headers: an 8-column row uses the new layout', () => {
    const csv = 'x1,x2,x3,x4,x5,x6,x7,x8\n1001,A B,IT SUPPORT,EXECUTIVE,MUMBAI HO,MAHARASHTRA,9876543211,a.b@lifc.in\n';
    const { rows } = parseBulkUsersCsv(csv, opts);
    expect(rows[0]).toMatchObject({ designations: 'EXECUTIVE', email: 'a.b@lifc.in' });
  });
});

describe('other import behaviour is unchanged', () => {
  it('fills a missing employee id, role and password with the defaults', () => {
    const { rows } = parseBulkUsersCsv('firstName,Mail Id\nA B,a.b@lifc.in\n', opts);
    expect(rows[0]).toMatchObject({ employeeId: '1001', role: 'RAISER', temporaryPassword: 'LaxmiUser@123' });
  });
  it('reads a role column', () => {
    const { rows } = parseBulkUsersCsv('firstName,Mail Id,role\nA B,a.b@lifc.in,team lead\n', opts);
    expect(rows[0].role).toBe('TEAM_LEAD');
  });
  it('reports empty files and files with no users', () => {
    expect(parseBulkUsersCsv('', opts).error).toBeTruthy();
    expect(parseBulkUsersCsv('firstName,Mail Id\n,\n', opts).error).toBe('No valid user data found in file');
  });
});

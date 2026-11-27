import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolveDepartmentName } from '../utils/userDepartment';

const depts = [{ id: 'd1', name: 'IT Application' }, { id: 'd2', name: 'Legal' }];

describe('department name on a user never creates a department', () => {
  it('links to an existing department, ignoring case and spaces', () => {
    expect(resolveDepartmentName('  it application ', depts)).toEqual({ departmentId: 'd1', raiserDepartmentName: null });
  });
  it('keeps an unknown name as the raiser department text and links nothing', () => {
    expect(resolveDepartmentName('Collection', depts)).toEqual({ departmentId: null, raiserDepartmentName: 'Collection' });
  });
  it('blank gives nothing', () => {
    expect(resolveDepartmentName('   ', depts)).toEqual({ departmentId: null, raiserDepartmentName: null });
    expect(resolveDepartmentName(undefined, depts)).toEqual({ departmentId: null, raiserDepartmentName: null });
  });
  it('user.service never calls department.create', () => {
    const src = readFileSync(new URL('../services/user.service.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/department\.create\(/);
    expect(src).toMatch(/resolveDepartmentName\(/);
  });
});

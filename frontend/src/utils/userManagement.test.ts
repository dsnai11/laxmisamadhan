import { describe, it, expect } from 'vitest';
import { canDeleteUserAccount, creatableRoles, hasManageUsersRight, usersPageHref, canOpenUsersPage, MANAGED_BY_RIGHT_ROLES } from './userManagement';

const holder = { id: 'hr', role: 'AGENT', roles: ['AGENT'], canManageUsers: true };
const plainAgent = { id: 'a', role: 'AGENT', roles: ['AGENT'] };
const ALL = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT', 'RAISER', 'VIEWER'];

describe('Delete button', () => {
  it('a holder can delete Raiser / Agent / Viewer accounts, not senior ones, not themselves', () => {
    for (const r of MANAGED_BY_RIGHT_ROLES) expect(canDeleteUserAccount(holder, { id: 'x', role: r, roles: [r] })).toBe(true);
    for (const r of ['TEAM_LEAD', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN']) expect(canDeleteUserAccount(holder, { id: 'x', role: r, roles: [r] })).toBe(false);
    expect(canDeleteUserAccount(holder, { id: 'x', role: 'AGENT', roles: ['AGENT', 'TEAM_LEAD'] })).toBe(false);
    expect(canDeleteUserAccount(holder, { id: 'hr', role: 'AGENT', roles: ['AGENT'] })).toBe(false);
  });
  it('without the right only Admin / Super Admin see Delete', () => {
    expect(canDeleteUserAccount(plainAgent, { id: 'x', role: 'RAISER', roles: ['RAISER'] })).toBe(false);
    expect(canDeleteUserAccount({ id: 'dh', role: 'DEPARTMENT_HEAD', roles: ['DEPARTMENT_HEAD'] }, { id: 'x', role: 'RAISER' })).toBe(false);
    expect(canDeleteUserAccount({ id: 'ad', role: 'ADMIN', roles: ['ADMIN'] }, { id: 'x', role: 'RAISER' })).toBe(true);
    expect(canDeleteUserAccount({ id: 'sa', role: 'SUPER_ADMIN' }, { id: 'sa', role: 'SUPER_ADMIN' })).toBe(false);
  });
  it('the right is only on when exactly true', () => {
    expect(hasManageUsersRight({ canManageUsers: true })).toBe(true);
    expect(hasManageUsersRight({})).toBe(false);
    expect(hasManageUsersRight(null)).toBe(false);
  });
});

describe('creatableRoles', () => {
  it('adds Raiser / Agent / Viewer for a holder, keeping the usual roles', () => {
    expect(creatableRoles(['RAISER'], holder, ALL)).toEqual(['AGENT', 'RAISER', 'VIEWER']);
    expect(creatableRoles(['TEAM_LEAD', 'AGENT', 'RAISER'], { ...holder, role: 'DEPARTMENT_HEAD' }, ALL)).toEqual(['TEAM_LEAD', 'AGENT', 'RAISER', 'VIEWER']);
  });
  it('never adds senior roles', () => {
    expect(creatableRoles([], holder, ALL)).not.toContain('ADMIN');
    expect(creatableRoles([], holder, ALL)).not.toContain('TEAM_LEAD');
  });
  it('is unchanged without the right', () => {
    expect(creatableRoles(['RAISER'], plainAgent, ALL)).toEqual(['RAISER']);
  });
});

describe('Users page access', () => {
  it('holders of the right get the Users page in their own area', () => {
    expect(usersPageHref(['AGENT'])).toBe('/agent/users');
    expect(usersPageHref(['TEAM_LEAD'])).toBe('/agent/users');
    expect(usersPageHref(['RAISER'])).toBe('/raiser/users');
    expect(usersPageHref(['ADMIN'])).toBe('/admin/users');
  });
  it('only admins, department heads and holders may open it', () => {
    expect(canOpenUsersPage(holder)).toBe(true);
    expect(canOpenUsersPage({ role: 'DEPARTMENT_HEAD', roles: ['DEPARTMENT_HEAD'] })).toBe(true);
    expect(canOpenUsersPage(plainAgent)).toBe(false);
    expect(canOpenUsersPage({ role: 'RAISER' })).toBe(false);
  });
});

import { canEditUserAccount } from './userManagement';

describe('canEditUserAccount — which rows open the edit page', () => {
  it('a holder opens Raiser / Agent / Viewer rows, not senior ones', () => {
    for (const r of ['RAISER', 'AGENT', 'VIEWER']) expect(canEditUserAccount(holder, { id: 'x', role: r, roles: [r] })).toBe(true);
    for (const r of ['ADMIN', 'SUPER_ADMIN']) expect(canEditUserAccount(holder, { id: 'x', role: r, roles: [r] })).toBe(false);
  });
  it('everyone can open their own page; admins open any; a plain agent opens nobody else', () => {
    expect(canEditUserAccount(plainAgent, { id: 'a', role: 'AGENT' })).toBe(true);
    expect(canEditUserAccount({ id: 'ad', role: 'ADMIN', roles: ['ADMIN'] }, { id: 'x', role: 'ADMIN' })).toBe(true);
    expect(canEditUserAccount(plainAgent, { id: 'x', role: 'RAISER', roles: ['RAISER'] })).toBe(false);
  });
  it('department heads and team leads keep what they had (the server applies rank / department rules)', () => {
    expect(canEditUserAccount({ id: 'dh', role: 'DEPARTMENT_HEAD', roles: ['DEPARTMENT_HEAD'] }, { id: 'x', role: 'AGENT' })).toBe(true);
  });
});

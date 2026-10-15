import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { logActivity } from '@middleware/audit.middleware';
import { Prisma, TicketCategory } from '@prisma/client';

const logger = createLogger('custom-field-service');

interface CustomFieldData {
  name: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'SELECT' | 'MULTISELECT' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'EMAIL' | 'URL' | 'FILE';
  departmentId?: string;
  category?: TicketCategory;
  isRequired?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: { minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string };
  defaultValue?: any;
  order?: number;
}

class CustomFieldService {
  async createField(data: CustomFieldData, createdById: string): Promise<any> {
    const existing = await prisma.customField.findFirst({
      where: { name: data.name, departmentId: data.departmentId, category: data.category },
    });
    if (existing) throw new Error('Field name already exists for this department/category');

    const field = await prisma.customField.create({
      data: {
        name: data.name,
        label: data.label,
        type: data.type,
        departmentId: data.departmentId,
        category: data.category,
        isRequired: data.isRequired ?? false,
        options: data.options,
        validation: data.validation,
        defaultValue: data.defaultValue,
        order: data.order ?? 0,
      },
    });

    await logActivity(createdById, 'CUSTOM_FIELD_CREATED', `Created custom field ${field.name}`, undefined, { fieldId: field.id });

    return field;
  }

  async getFields(departmentId?: string, category?: TicketCategory): Promise<any[]> {
    return prisma.customField.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async getFieldById(id: string): Promise<any> {
    const field = await prisma.customField.findUnique({ where: { id } });
    if (!field) throw new Error('Custom field not found');
    return field;
  }

  async updateField(id: string, data: Partial<CustomFieldData>, updatedById: string): Promise<any> {
    const field = await prisma.customField.update({
      where: { id },
      data,
    });

    await logActivity(updatedById, 'CUSTOM_FIELD_UPDATED', `Updated custom field`, undefined, { fieldId: id, changes: data });

    return field;
  }

  async deleteField(id: string, deletedById: string): Promise<void> {
    await prisma.customField.delete({ where: { id } });
    await logActivity(deletedById, 'CUSTOM_FIELD_DELETED', `Deleted custom field`, undefined, { fieldId: id });
  }

  async setFieldValue(fieldId: string, ticketId: string | null, userId: string, value: any): Promise<any> {
    const field = await prisma.customField.findUnique({ where: { id: fieldId } });
    if (!field) throw new Error('Custom field not found');

    const validatedValue = this.validateValue(field, value);
    if (!validatedValue.valid) throw new Error(validatedValue.error);

    const record = await prisma.customFieldValue.upsert({
      where: { fieldId_ticketId_userId: { fieldId, ticketId: ticketId || '', userId } },
      create: { fieldId, ticketId, userId, value: validatedValue.value },
      update: { value: validatedValue.value },
    });

    return record;
  }

  async getFieldValues(ticketId: string): Promise<any[]> {
    return prisma.customFieldValue.findMany({
      where: { ticketId },
      include: { field: true },
    });
  }

  async getUserFieldValues(userId: string): Promise<any[]> {
    return prisma.customFieldValue.findMany({
      where: { userId, ticketId: null },
      include: { field: true },
    });
  }

  private validateValue(field: any, value: any): { valid: boolean; value: any; error?: string } {
    if (field.isRequired && (value === null || value === undefined || value === '')) {
      return { valid: false, value: null, error: `${field.label} is required` };
    }

    if (value === null || value === undefined || value === '') {
      return { valid: true, value: field.defaultValue };
    }

    switch (field.type) {
      case 'NUMBER':
        const num = Number(value);
        if (isNaN(num)) return { valid: false, value: null, error: 'Must be a number' };
        if (field.validation?.min !== undefined && num < field.validation.min) return { valid: false, value: null, error: `Minimum value is ${field.validation.min}` };
        if (field.validation?.max !== undefined && num > field.validation.max) return { valid: false, value: null, error: `Maximum value is ${field.validation.max}` };
        return { valid: true, value: num };

      case 'BOOLEAN':
        return { valid: true, value: Boolean(value) };

      case 'SELECT':
        if (field.options && !field.options.some((o: any) => o.value === value)) {
          return { valid: false, value: null, error: 'Invalid option selected' };
        }
        return { valid: true, value };

      case 'MULTISELECT':
        if (!Array.isArray(value)) return { valid: false, value: null, error: 'Must be an array' };
        if (field.options) {
          const validOptions = field.options.map((o: any) => o.value);
          const invalid = value.filter(v => !validOptions.includes(v));
          if (invalid.length > 0) return { valid: false, value: null, error: `Invalid options: ${invalid.join(', ')}` };
        }
        return { valid: true, value };

      case 'DATE':
      case 'DATETIME':
        const date = new Date(value);
        if (isNaN(date.getTime())) return { valid: false, value: null, error: 'Invalid date format' };
        return { valid: true, value: date.toISOString() };

      case 'EMAIL':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { valid: false, value: null, error: 'Invalid email format' };
        return { valid: true, value };

      case 'URL':
        try { new URL(value); } catch { return { valid: false, value: null, error: 'Invalid URL format' }; }
        return { valid: true, value };

      case 'TEXT':
      case 'TEXTAREA':
        if (field.validation?.minLength && value.length < field.validation.minLength) return { valid: false, value: null, error: `Minimum length is ${field.validation.minLength}` };
        if (field.validation?.maxLength && value.length > field.validation.maxLength) return { valid: false, value: null, error: `Maximum length is ${field.validation.maxLength}` };
        if (field.validation?.pattern && !new RegExp(field.validation.pattern).test(value)) return { valid: false, value: null, error: 'Invalid format' };
        return { valid: true, value };

      default:
        return { valid: true, value };
    }
  }
}

export const customFieldService = new CustomFieldService();
export default customFieldService;
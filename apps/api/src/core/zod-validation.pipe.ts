import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Validates request input against a shared @expense-saas/validation Zod
 * schema. Schemas use `.strict()` so unexpected extra fields are rejected
 * outright (mass-assignment protection) instead of silently dropped.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".") || "_";
        details[key] = [...(details[key] ?? []), issue.message];
      }
      throw new BadRequestException({
        message: "Validation failed",
        details,
      });
    }
    return result.data;
  }
}

import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { memoryStorage } from "multer";
import { z } from "zod";
import { CSV_IMPORT, RATE_LIMITS } from "@expense-saas/config";
import { cuidSchema } from "@expense-saas/validation";
import type { CsvImportJobDto } from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { ImportService } from "./import.service";
import type { UploadedCsvFile } from "./csv-file-guard";

const importFormSchema = z.object({ accountId: cuidSchema });

@Controller("import")
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Throttle({
    default: { limit: RATE_LIMITS.CSV_IMPORT.limit, ttl: RATE_LIMITS.CSV_IMPORT.ttlSeconds * 1000 },
  })
  @Post("csv")
  @UseInterceptors(
    FileInterceptor("file", {
      // Never touch disk with an uploaded file — parsed entirely in memory,
      // then handed straight to object storage.
      storage: memoryStorage(),
      limits: { fileSize: CSV_IMPORT.MAX_FILE_SIZE_BYTES },
    }),
  )
  createImportJob(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(importFormSchema)) body: { accountId: string },
    @UploadedFile() file: UploadedCsvFile | undefined,
  ): Promise<CsvImportJobDto> {
    return this.importService.createImportJob(user.id, body.accountId, file);
  }

  @Get(":jobId/status")
  getStatus(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("jobId") jobId: string,
  ): Promise<CsvImportJobDto> {
    return this.importService.getStatus(user.id, jobId);
  }
}

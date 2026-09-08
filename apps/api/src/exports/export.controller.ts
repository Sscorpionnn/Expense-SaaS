import { Controller, Get, HttpCode, Param, Post, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { RATE_LIMITS } from "@expense-saas/config";
import type { DataExportRequestDto } from "@expense-saas/types";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ExportService } from "./export.service";

@Controller("exports")
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Throttle({
    default: { limit: RATE_LIMITS.DATA_EXPORT.limit, ttl: RATE_LIMITS.DATA_EXPORT.ttlSeconds * 1000 },
  })
  @HttpCode(201)
  @Post()
  create(@CurrentUser() user: AuthenticatedRequestUser): Promise<DataExportRequestDto> {
    return this.exportService.createExportRequest(user.id);
  }

  @Get(":id")
  getStatus(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
  ): Promise<DataExportRequestDto> {
    return this.exportService.getStatus(user.id, id);
  }

  @Get(":id/download")
  async download(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.exportService.getDownloadUrl(user.id, id);
    res.redirect(302, url);
  }
}

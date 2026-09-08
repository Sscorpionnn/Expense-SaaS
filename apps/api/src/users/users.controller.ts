import { Body, Controller, Patch } from "@nestjs/common";
import { updatePrivacySettingsSchema, type UpdatePrivacySettingsInput } from "@expense-saas/validation";
import { CurrentUser, type AuthenticatedRequestUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../core/zod-validation.pipe";
import { UsersService } from "./users.service";

@Controller("users/me")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch("privacy")
  updatePrivacy(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body(new ZodValidationPipe(updatePrivacySettingsSchema)) dto: UpdatePrivacySettingsInput,
  ): Promise<{ shareUsageAnalytics: boolean }> {
    return this.usersService.updatePrivacySettings(user.id, dto);
  }
}

import { IsBoolean } from "class-validator";

export class ToggleAutomationRuleDto {
  @IsBoolean()
  enabled!: boolean;
}

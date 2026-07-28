import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminSupportController } from "./admin-support.controller";
import { AdminSupportService } from "./admin-support.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminSupportController],
  providers: [AdminSupportService],
})
export class AdminSupportModule {}

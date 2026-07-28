import { IsEnum, IsOptional, IsString } from "class-validator";
import { JobStatus } from "@prisma/client";

export class ListJobsQueryDto {
  @IsOptional()
  @IsString()
  queueName?: string;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsString()
  type?: string;
}

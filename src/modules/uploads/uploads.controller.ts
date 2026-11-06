
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { memoryStorage } from 'multer';

import {
  JwtAuthGuard,
} from '../../common/guards/jwt-auth.guard.js';

import {
  RolesGuard,
} from '../../common/guards/roles.guard.js';

import {
  Roles,
} from '../../common/decorators/roles.decorator.js';

import {
  UserRole,
} from '../users/schemas/users.schema.js';

import {
  UploadsService,
} from './uploads.service.js';

import type {
  UploadActor,
} from './uploads.service.js';

import {
  CreateUploadsDto,
} from './dto/create-uploads.dto.js';

import {
  UpdateUploadsDto,
} from './dto/update-uploads.dto.js';

type AuthRequest = {
  user: UploadActor;
};

@ApiTags('Uploads & Task Attachments')
@ApiBearerAuth()
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
  ) {}

  @Post('tasks/:taskId')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Upload attachment to accessible task',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'PDF, PNG, JPG/JPEG, WebP or DOCX, max 10 MB',
        },
        description: {
          type: 'string',
          maxLength: 1000,
          example: 'Design reference',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
        fields: 1,
        parts: 2,
      },
    }),
  )
  upload(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateUploadsDto,
  ) {
    return this.uploadsService.uploadTaskFile(
      taskId,
      req.user,
      file,
      dto,
    );
  }

  @Get('tasks/:taskId')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'List attachments for accessible task',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
  })
  findTaskFiles(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,

    @Query(
      'page',
      new DefaultValuePipe(1),
      ParseIntPipe,
    )
    page: number,

    @Query(
      'limit',
      new DefaultValuePipe(20),
      ParseIntPipe,
    )
    limit: number,
  ) {
    return this.uploadsService.findTaskFiles(
      taskId,
      req.user,
      page,
      limit,
    );
  }

  @Get(':id/download')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({
    summary: 'Download authorized task attachment',
  })
  @ApiProduces('application/octet-stream')
  async download(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    const file = await this.uploadsService.download(
      id,
      req.user,
    );

    const encodedName = encodeURIComponent(
      file.name,
    );

    return new StreamableFile(file.buffer, {
      type: 'application/octet-stream',
      disposition:
        `attachment; filename="attachment-${id}"; ` +
        `filename*=UTF-8''${encodedName}`,
      length: file.buffer.length,
    });
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Get attachment metadata',
  })
  findOne(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.uploadsService.findOne(
      id,
      req.user,
    );
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Update attachment description',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUploadsDto,
    @Req() req: AuthRequest,
  ) {
    return this.uploadsService.update(
      id,
      dto,
      req.user,
    );
  }

  @Delete(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({
    summary: 'Delete permitted task attachment',
  })
  remove(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.uploadsService.remove(
      id,
      req.user,
    );
  }
}

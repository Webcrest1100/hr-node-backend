
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { randomUUID, createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { resolve, win32 } from 'node:path';

import { fileTypeFromBuffer } from 'file-type';

import { Task } from '../tasks/schemas/tasks.schema.js';
import { UserRole } from '../users/schemas/users.schema.js';
import { Upload } from './schemas/uploads.schema.js';

import { CreateUploadsDto } from './dto/create-uploads.dto.js';
import { UpdateUploadsDto } from './dto/update-uploads.dto.js';

export type UploadActor = {
  id: string;
  role: UserRole;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES: Record<
  string,
  { extension: string; mime: string }
> = {
  pdf: {
    extension: '.pdf',
    mime: 'application/pdf',
  },
  png: {
    extension: '.png',
    mime: 'image/png',
  },
  jpg: {
    extension: '.jpg',
    mime: 'image/jpeg',
  },
  jpeg: {
    extension: '.jpg',
    mime: 'image/jpeg',
  },
  webp: {
    extension: '.webp',
    mime: 'image/webp',
  },
  docx: {
    extension: '.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
};

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  private readonly storageDirectory = resolve(
    process.cwd(),
    'storage',
    'task-attachments',
  );

  constructor(
    @InjectModel(Upload.name)
    private readonly uploadModel: Model<Upload>,

    @InjectModel(Task.name)
    private readonly taskModel: Model<Task>,
  ) {}

  private oid(id: string): Types.ObjectId {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      throw new BadRequestException(
        'Invalid MongoDB ID',
      );
    }

    return new Types.ObjectId(id);
  }

  private isStaff(actor: UploadActor): boolean {
    return (
      actor.role === UserRole.ADMIN ||
      actor.role === UserRole.HR
    );
  }

  private async verifyTaskAccess(
    taskId: string,
    actor: UploadActor,
  ): Promise<void> {
    const taskObjectId = this.oid(taskId);

    const filter = this.isStaff(actor)
      ? { _id: taskObjectId }
      : {
          _id: taskObjectId,
          assigneeUserIds: this.oid(actor.id),
        };

    const task = await this.taskModel.exists(filter);

    if (!task) {
      throw new NotFoundException(
        'Task not found or access denied',
      );
    }
  }

  private async getUploadOrFail(id: string) {
    const upload = await this.uploadModel
      .findById(this.oid(id))
      .lean();

    if (!upload) {
      throw new NotFoundException(
        'Attachment not found',
      );
    }

    return upload;
  }

  private async getAuthorizedUpload(
    id: string,
    actor: UploadActor,
  ) {
    const upload = await this.getUploadOrFail(id);

    await this.verifyTaskAccess(
      String(upload.taskId),
      actor,
    );

    return upload;
  }

  private publicUpload(upload: Upload | Record<string, any>) {
    const data = upload as Record<string, any>;

    return {
      id: String(data._id),
      taskId: String(data.taskId),
      uploadedBy: String(data.uploadedBy),
      originalName: data.originalName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      sha256: data.sha256,
      description: data.description,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      downloadPath:
        `/api/uploads/${String(data._id)}/download`,
    };
  }

  private safeOriginalName(name: string): string {
    const filename = win32
      .basename(name.replace(/\//g, '\\'))
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();

    if (
      !filename ||
      filename === '.' ||
      filename === '..' ||
      filename.length > 255
    ) {
      throw new BadRequestException(
        'Invalid attachment filename',
      );
    }

    return filename;
  }

  private async inspectFile(file: Express.Multer.File) {
    if (
      !file ||
      !Buffer.isBuffer(file.buffer) ||
      file.size < 1 ||
      file.size > MAX_FILE_SIZE
    ) {
      throw new BadRequestException(
        'A non-empty file up to 10 MB is required',
      );
    }

    const originalName = this.safeOriginalName(
      file.originalname,
    );

    const detected = await fileTypeFromBuffer(
      file.buffer,
    );

    if (!detected) {
      throw new BadRequestException(
        'Unsupported or unrecognized file type',
      );
    }

    const allowed = ALLOWED_TYPES[detected.ext];

    if (
      !allowed ||
      detected.mime !== allowed.mime
    ) {
      throw new BadRequestException(
        'Only PDF, PNG, JPEG, WebP and DOCX files are supported',
      );
    }

    const lowerName = originalName.toLowerCase();

    const acceptedExtensions =
      detected.ext === 'jpg' ||
      detected.ext === 'jpeg'
        ? ['.jpg', '.jpeg']
        : [allowed.extension];

    if (
      !acceptedExtensions.some((ext) =>
        lowerName.endsWith(ext),
      )
    ) {
      throw new BadRequestException(
        'Filename extension does not match actual file type',
      );
    }

    const sha256 = createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    return {
      originalName,
      mimeType: allowed.mime,
      extension: allowed.extension,
      sha256,
    };
  }

  private filePath(storageKey: string): string {
    // Never use a filename supplied by an API client.
    if (
      !/^[a-f0-9-]{36}\.(pdf|png|jpg|webp|docx)$/.test(
        storageKey,
      )
    ) {
      throw new BadRequestException(
        'Invalid stored attachment key',
      );
    }

    return resolve(
      this.storageDirectory,
      storageKey,
    );
  }

  async uploadTaskFile(
    taskId: string,
    actor: UploadActor,
    file: Express.Multer.File,
    dto: CreateUploadsDto,
  ) {
    await this.verifyTaskAccess(taskId, actor);

    const inspected = await this.inspectFile(file);

    const description = dto.description?.trim() ?? '';

    const storageKey =
      `${randomUUID()}${inspected.extension}`;

    const path = this.filePath(storageKey);

    await mkdir(this.storageDirectory, {
      recursive: true,
    });

    // wx ensures a generated key never overwrites a file.
    await writeFile(path, file.buffer, {
      flag: 'wx',
      mode: 0o600,
    });

    try {
      const upload = await this.uploadModel.create({
        taskId: this.oid(taskId),
        uploadedBy: this.oid(actor.id),
        originalName: inspected.originalName,
        storageKey,
        mimeType: inspected.mimeType,
        sizeBytes: file.size,
        sha256: inspected.sha256,
        description,
      });

      return {
        message: 'Task attachment uploaded successfully',
        attachment: this.publicUpload(
          upload.toObject(),
        ),
      };
    } catch (error) {
      // Remove file when MongoDB metadata creation fails.
      await unlink(path).catch((cleanupError: unknown) => {
        this.logger.error(
          `Failed to clean up upload ${storageKey}`,
          cleanupError instanceof Error
            ? cleanupError.stack
            : String(cleanupError),
        );
      });

      throw error;
    }
  }

  async findTaskFiles(
    taskId: string,
    actor: UploadActor,
    page = 1,
    limit = 20,
  ) {
    await this.verifyTaskAccess(taskId, actor);

    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'Invalid pagination parameters',
      );
    }

    const filter = {
      taskId: this.oid(taskId),
    };

    const [uploads, total] = await Promise.all([
      this.uploadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      this.uploadModel.countDocuments(filter),
    ]);

    return {
      data: uploads.map((upload) =>
        this.publicUpload(upload),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, actor: UploadActor) {
    const upload = await this.getAuthorizedUpload(
      id,
      actor,
    );

    return {
      attachment: this.publicUpload(upload),
    };
  }

  async update(
    id: string,
    dto: UpdateUploadsDto,
    actor: UploadActor,
  ) {
    const existing = await this.getAuthorizedUpload(
      id,
      actor,
    );

    if (
      !this.isStaff(actor) &&
      String(existing.uploadedBy) !== actor.id
    ) {
      throw new ForbiddenException(
        'Only the uploader or Admin/HR can edit this attachment',
      );
    }

    const filter = {
      _id: existing._id,
      ...(!this.isStaff(actor)
        ? { uploadedBy: this.oid(actor.id) }
        : {}),
    };

    const updated = await this.uploadModel
      .findOneAndUpdate(
        filter,
        {
          $set: {
            description: dto.description.trim(),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .lean();

    if (!updated) {
      throw new NotFoundException(
        'Attachment no longer available',
      );
    }

    return {
      message: 'Attachment description updated',
      attachment: this.publicUpload(updated),
    };
  }

  async download(
    id: string,
    actor: UploadActor,
  ) {
    const upload = await this.getAuthorizedUpload(
      id,
      actor,
    );

    let buffer: Buffer;

    try {
      buffer = await readFile(
        this.filePath(upload.storageKey),
      );
    } catch (error) {
      this.logger.error(
        'Attachment file missing or unreadable',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new NotFoundException(
        'Attachment file is unavailable',
      );
    }

    return {
      buffer,
      name: upload.originalName,
      mimeType: upload.mimeType,
    };
  }

  async remove(
    id: string,
    actor: UploadActor,
  ) {
    const existing = await this.getAuthorizedUpload(
      id,
      actor,
    );

    if (
      !this.isStaff(actor) &&
      String(existing.uploadedBy) !== actor.id
    ) {
      throw new ForbiddenException(
        'Only uploader or Admin/HR can delete this attachment',
      );
    }

    const filter = {
      _id: existing._id,
      ...(!this.isStaff(actor)
        ? { uploadedBy: this.oid(actor.id) }
        : {}),
    };

    const deleted = await this.uploadModel
      .findOneAndDelete(filter)
      .lean();

    if (!deleted) {
      throw new NotFoundException(
        'Attachment no longer available',
      );
    }

    try {
      await unlink(this.filePath(deleted.storageKey));
    } catch (error) {
      this.logger.warn(
        `Attachment metadata deleted but file cleanup failed: ${deleted.storageKey}`,
      );
    }

    return {
      message: 'Attachment removed successfully',
      attachmentId: String(deleted._id),
    };
  }
}

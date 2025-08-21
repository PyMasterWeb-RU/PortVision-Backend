import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

// Entities
import { File } from './entities/file.entity';

// Services
import { FileService } from './services/file.service';

// Controllers
import { FileController } from './controllers/file.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Files module entities
      File,
    ]),
    EventEmitterModule,
    MulterModule.register({
      storage: diskStorage({
        destination: process.env.UPLOAD_DIRECTORY || './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB default
      },
    }),
  ],
  controllers: [
    FileController,
  ],
  providers: [
    FileService,
  ],
  exports: [
    FileService,
    TypeOrmModule,
  ],
})
export class FilesModule {}
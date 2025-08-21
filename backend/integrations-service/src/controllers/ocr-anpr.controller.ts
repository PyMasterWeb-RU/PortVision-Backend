import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { OcrProcessor, OcrProcessingRequest } from '../processors/ocr.processor';
import { IntegrationEndpointService } from '../services/integration-endpoint.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { IntegrationType } from '../entities/integration-endpoint.entity';

@ApiTags('OCR/ANPR Processing')
@Controller('ocr-anpr')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class OcrAnprController {
  private readonly logger = new Logger(OcrAnprController.name);

  constructor(
    private readonly ocrProcessor: OcrProcessor,
    private readonly integrationEndpointService: IntegrationEndpointService,
  ) {}

  @Post(':endpointId/process-image')
  @ApiOperation({ 
    summary: 'Обработать изображение через OCR',
    description: 'Выполняет OCR распознавание номера контейнера с изображения'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Изображение успешно обработано',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        requestId: { type: 'string' },
        containerNumber: { type: 'string' },
        confidence: { type: 'number' },
        isValid: { type: 'boolean' },
        rawOcrResult: { type: 'object' },
        transformedData: { type: 'object' },
        routingResult: { type: 'object' },
        errors: { type: 'array', items: { type: 'string' } },
        processingTime: { type: 'number' },
        metadata: { type: 'object' }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Некорректные данные запроса' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Интеграция не найдена' 
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции OCR/ANPR' })
  @ApiBody({
    description: 'Данные для OCR обработки',
    examples: {
      urlImage: {
        summary: 'Изображение по URL',
        value: {
          imageSource: {
            type: 'url',
            source: 'https://example.com/container-image.jpg',
            metadata: {
              cameraId: 'gate_cam_01',
              location: 'Main Gate',
              timestamp: '2024-01-20T10:30:00Z'
            }
          },
          requestId: 'req_20240120_001',
          metadata: {
            gateId: 'GATE_01',
            laneNumber: 1,
            direction: 'in',
            vehicleType: 'truck',
            operatorId: 'OP_001'
          }
        }
      },
      base64Image: {
        summary: 'Изображение в Base64',
        value: {
          imageSource: {
            type: 'base64',
            source: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
            metadata: {
              cameraId: 'mobile_cam_01',
              location: 'Mobile Scanner'
            }
          },
          metadata: {
            gateId: 'MOBILE_01',
            direction: 'in',
            operatorId: 'OP_002'
          }
        }
      },
      fileImage: {
        summary: 'Файл изображения',
        value: {
          imageSource: {
            type: 'file',
            source: '/tmp/uploads/container_20240120_001.jpg'
          },
          metadata: {
            gateId: 'GATE_02',
            direction: 'out'
          }
        }
      }
    }
  })
  async processImage(
    @Param('endpointId') endpointId: string,
    @Body() request: OcrProcessingRequest,
  ) {
    try {
      // Проверяем существование интеграции
      const endpoint = await this.integrationEndpointService.findOne(endpointId);
      
      if (endpoint.type !== IntegrationType.OCR_ANPR) {
        throw new BadRequestException(`Интеграция ${endpoint.name} не является OCR/ANPR интеграцией`);
      }

      if (!endpoint.isActive) {
        throw new BadRequestException(`Интеграция ${endpoint.name} неактивна`);
      }

      // Устанавливаем endpointId из параметра URL
      request.endpointId = endpointId;

      this.logger.log(`🔍 Получен запрос на OCR обработку для интеграции ${endpoint.name}`);

      // Обрабатываем изображение
      const result = await this.ocrProcessor.processOcrRequest(request, endpoint);

      return result;

    } catch (error) {
      this.logger.error(`❌ Ошибка обработки OCR запроса для ${endpointId}:`, error.message);
      throw error;
    }
  }

  @Post(':endpointId/upload-and-process')
  @UseInterceptors(FileInterceptor('image', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|bmp|tiff)$/)) {
        return callback(new BadRequestException('Поддерживаются только изображения'), false);
      }
      callback(null, true);
    },
  }))
  @ApiOperation({ 
    summary: 'Загрузить и обработать изображение',
    description: 'Загружает файл изображения и выполняет OCR распознавание'
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Файл загружен и обработан',
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции OCR/ANPR' })
  async uploadAndProcess(
    @Param('endpointId') endpointId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata?: any,
  ) {
    if (!file) {
      throw new BadRequestException('Файл изображения не предоставлен');
    }

    try {
      const endpoint = await this.integrationEndpointService.findOne(endpointId);
      
      if (endpoint.type !== IntegrationType.OCR_ANPR) {
        throw new BadRequestException(`Интеграция ${endpoint.name} не является OCR/ANPR интеграцией`);
      }

      // Создаем запрос с файлом
      const request: OcrProcessingRequest = {
        endpointId,
        imageSource: {
          type: 'buffer',
          source: file.buffer,
          metadata: {
            cameraId: 'file_upload',
            location: 'File Upload',
            timestamp: new Date(),
          },
        },
        requestId: `upload_${Date.now()}`,
        metadata: metadata ? JSON.parse(metadata) : {
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      };

      this.logger.log(
        `📤 Получен файл для OCR обработки: ${file.originalname} ` +
        `(${(file.size / 1024).toFixed(1)}KB, ${file.mimetype})`
      );

      const result = await this.ocrProcessor.processOcrRequest(request, endpoint);

      return {
        ...result,
        fileInfo: {
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        },
      };

    } catch (error) {
      this.logger.error(`❌ Ошибка обработки загруженного файла:`, error.message);
      throw error;
    }
  }

  @Post(':endpointId/batch-process')
  @ApiOperation({ 
    summary: 'Пакетная обработка изображений',
    description: 'Обрабатывает несколько изображений одновременно'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Пакетная обработка завершена',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          requestId: { type: 'string' },
          containerNumber: { type: 'string' },
          confidence: { type: 'number' },
          processingTime: { type: 'number' }
        }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции OCR/ANPR' })
  @ApiBody({
    description: 'Массив запросов для пакетной обработки',
    schema: {
      type: 'object',
      properties: {
        requests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              imageSource: { type: 'object' },
              requestId: { type: 'string' },
              metadata: { type: 'object' }
            }
          }
        }
      }
    },
    examples: {
      batchUrls: {
        summary: 'Пакет URL изображений',
        value: {
          requests: [
            {
              imageSource: {
                type: 'url',
                source: 'https://example.com/image1.jpg'
              },
              requestId: 'batch_001',
              metadata: { gateId: 'GATE_01', direction: 'in' }
            },
            {
              imageSource: {
                type: 'url',
                source: 'https://example.com/image2.jpg'
              },
              requestId: 'batch_002',
              metadata: { gateId: 'GATE_01', direction: 'out' }
            }
          ]
        }
      }
    }
  })
  async batchProcess(
    @Param('endpointId') endpointId: string,
    @Body('requests') requests: OcrProcessingRequest[],
  ) {
    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      throw new BadRequestException('Необходимо предоставить массив запросов');
    }

    if (requests.length > 10) {
      throw new BadRequestException('Максимальный размер пакета: 10 запросов');
    }

    try {
      const endpoint = await this.integrationEndpointService.findOne(endpointId);
      
      if (endpoint.type !== IntegrationType.OCR_ANPR) {
        throw new BadRequestException(`Интеграция ${endpoint.name} не является OCR/ANPR интеграцией`);
      }

      // Устанавливаем endpointId для всех запросов
      requests.forEach(request => {
        request.endpointId = endpointId;
      });

      this.logger.log(`📋 Запуск пакетной OCR обработки ${requests.length} запросов для ${endpoint.name}`);

      const results = await this.ocrProcessor.processBatchOcrRequests(requests, endpoint);

      return {
        totalRequests: requests.length,
        successfulRequests: results.filter(r => r.success).length,
        failedRequests: results.filter(r => !r.success).length,
        results,
      };

    } catch (error) {
      this.logger.error(`❌ Ошибка пакетной OCR обработки:`, error.message);
      throw error;
    }
  }

  @Get(':endpointId/stats')
  @ApiOperation({ 
    summary: 'Получить статистику OCR обработки',
    description: 'Возвращает статистику обработки для OCR интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Статистика получена',
    schema: {
      type: 'object',
      properties: {
        ocr: {
          type: 'object',
          properties: {
            activeWorkers: { type: 'number' },
            queuedRequests: { type: 'number' },
            totalProcessed: { type: 'number' }
          }
        },
        metrics: { type: 'object' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции OCR/ANPR' })
  async getStats(@Param('endpointId') endpointId: string) {
    const endpoint = await this.integrationEndpointService.findOne(endpointId);
    
    if (endpoint.type !== IntegrationType.OCR_ANPR) {
      throw new BadRequestException(`Интеграция ${endpoint.name} не является OCR/ANPR интеграцией`);
    }

    return await this.ocrProcessor.getProcessingStats(endpointId);
  }

  @Get(':endpointId/health')
  @ApiOperation({ 
    summary: 'Проверить здоровье OCR обработки',
    description: 'Возвращает статус здоровья OCR интеграции'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Статус здоровья получен',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        details: { type: 'object' }
      }
    }
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции OCR/ANPR' })
  async getHealth(@Param('endpointId') endpointId: string) {
    const endpoint = await this.integrationEndpointService.findOne(endpointId);
    
    if (endpoint.type !== IntegrationType.OCR_ANPR) {
      throw new BadRequestException(`Интеграция ${endpoint.name} не является OCR/ANPR интеграцией`);
    }

    return await this.ocrProcessor.healthCheck();
  }

  @Post(':endpointId/clear-cache')
  @ApiOperation({ 
    summary: 'Очистить кеш OCR',
    description: 'Очищает кеш и перезапускает OCR workers'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Кеш очищен'
  })
  @ApiParam({ name: 'endpointId', description: 'UUID интеграции OCR/ANPR' })
  async clearCache(@Param('endpointId') endpointId: string) {
    const endpoint = await this.integrationEndpointService.findOne(endpointId);
    
    if (endpoint.type !== IntegrationType.OCR_ANPR) {
      throw new BadRequestException(`Интеграция ${endpoint.name} не является OCR/ANPR интеграцией`);
    }

    await this.ocrProcessor.clearCache();
    
    this.logger.log(`🧹 Кеш OCR очищен для интеграции ${endpoint.name}`);

    return {
      message: 'Кеш OCR успешно очищен',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('validate-container-number')
  @ApiOperation({ 
    summary: 'Валидировать номер контейнера',
    description: 'Проверяет корректность номера контейнера по стандарту ISO'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Результат валидации',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        normalizedNumber: { type: 'string' },
        formattedNumber: { type: 'string' }
      }
    }
  })
  @ApiBody({
    description: 'Номер контейнера для валидации',
    schema: {
      type: 'object',
      properties: {
        containerNumber: { 
          type: 'string',
          description: 'Номер контейнера для проверки',
          example: 'TCLU1234567'
        }
      },
      required: ['containerNumber']
    }
  })
  async validateContainerNumber(@Body('containerNumber') containerNumber: string) {
    if (!containerNumber) {
      throw new BadRequestException('Номер контейнера не указан');
    }

    const validation = this.ocrProcessor.validateContainerNumber(containerNumber);
    const formatted = this.ocrProcessor.formatContainerNumber(containerNumber);

    return {
      ...validation,
      formattedNumber: formatted,
    };
  }

  @Get('supported-formats')
  @ApiOperation({ 
    summary: 'Получить поддерживаемые форматы',
    description: 'Возвращает список поддерживаемых форматов изображений и OCR движков'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Список поддерживаемых форматов',
    schema: {
      type: 'object',
      properties: {
        imageFormats: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Поддерживаемые форматы изображений'
        },
        ocrEngines: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Доступные OCR движки'
        },
        sourceTypes: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Поддерживаемые типы источников изображений'
        },
        maxImageSize: { 
          type: 'number',
          description: 'Максимальный размер изображения в байтах'
        },
        containerFormats: {
          type: 'array',
          items: { type: 'string' },
          description: 'Поддерживаемые форматы номеров контейнеров'
        }
      }
    }
  })
  async getSupportedFormats() {
    return {
      imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'],
      ocrEngines: ['tesseract', 'cloud_vision', 'azure_cv', 'custom'],
      sourceTypes: ['file', 'url', 'base64', 'buffer'],
      maxImageSize: 10 * 1024 * 1024, // 10MB
      containerFormats: [
        'ABCD1234567 (стандартный ISO)',
        'ABCU1234567 (с буквой U)',
        'ABCD-1234567 (с дефисом)',
        'ABCD 123456 7 (с пробелами)'
      ],
      preprocessingSteps: [
        'grayscale',
        'contrast', 
        'sharpen',
        'denoise',
        'resize',
        'enhance_text'
      ],
      languages: ['eng', 'rus'],
    };
  }
}
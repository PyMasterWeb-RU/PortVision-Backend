import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as chokidar from 'chokidar';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

export interface FileMonitorConfig {
  watchPaths: Array<{
    path: string;
    pattern: string;
    recursive: boolean;
    enabled: boolean;
  }>;
  processingRules: {
    fileTypes: Array<{
      extension: string;
      processor: string;
      encoding: 'utf8' | 'binary' | 'base64';
      maxSize: number; // bytes
    }>;
    naming: {
      requirePattern?: string;
      excludePattern?: string;
      timestampFormat?: string;
    };
    processing: {
      moveAfterProcessing: boolean;
      processedPath?: string;
      errorPath?: string;
      backupOriginal: boolean;
      deleteAfterProcessing: boolean;
    };
  };
  settings: {
    pollInterval: number;
    ignoreInitial: boolean;
    usePolling: boolean;
    stabilityThreshold: number; // ms to wait before processing
    maxConcurrentFiles: number;
    retryAttempts: number;
    retryDelay: number;
  };
}

export interface FileEvent {
  eventId: string;
  eventType: 'added' | 'changed' | 'removed' | 'error';
  filePath: string;
  fileName: string;
  fileSize: number;
  timestamp: Date;
  checksum?: string;
  metadata?: {
    extension: string;
    directory: string;
    relativePath: string;
    isDirectory: boolean;
    lastModified: Date;
    permissions?: string;
  };
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface FileContent {
  filePath: string;
  content: string | Buffer;
  encoding: string;
  size: number;
  checksum: string;
  metadata: {
    createdAt: Date;
    modifiedAt: Date;
    accessedAt: Date;
    permissions: string;
    mimeType?: string;
  };
}

export interface ProcessingJob {
  jobId: string;
  fileEvent: FileEvent;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  attempts: number;
  result?: any;
  error?: string;
}

@Injectable()
export class FileMonitorAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileMonitorAdapter.name);
  private readonly watchers = new Map<string, chokidar.FSWatcher>();
  private readonly fileEvents = new Map<string, FileEvent>();
  private readonly processingQueue = new Map<string, ProcessingJob>();
  private readonly activeProcessing = new Set<string>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async onModuleInit() {
    this.logger.log('📁 Инициализация File Monitor адаптера...');
  }

  async onModuleDestroy() {
    this.logger.log('🔄 Завершение работы File Monitor адаптера...');
    
    // Останавливаем все watchers
    for (const [endpointId, watcher] of this.watchers) {
      try {
        await watcher.close();
        this.logger.log(`📁 Watcher ${endpointId} остановлен`);
      } catch (error) {
        this.logger.error(`❌ Ошибка остановки watcher ${endpointId}:`, error.message);
      }
    }
    
    this.watchers.clear();
  }

  async startMonitoring(endpoint: IntegrationEndpoint): Promise<boolean> {
    const endpointId = endpoint.id;
    const config = endpoint.connectionConfig.fileMonitorConfig as FileMonitorConfig;

    try {
      this.logger.log(`📂 Запуск мониторинга файлов для ${endpoint.name}...`);

      if (this.watchers.has(endpointId)) {
        this.logger.warn(`⚠️ Мониторинг файлов ${endpointId} уже запущен`);
        return true;
      }

      // Создаем watcher с конфигурацией
      const watcher = this.createFileWatcher(config, endpoint);
      
      // Настраиваем обработчики событий
      this.setupWatcherEvents(watcher, config, endpoint);

      // Запускаем мониторинг
      await this.initializeWatcher(watcher, config);

      this.watchers.set(endpointId, watcher);

      this.logger.log(`✅ Мониторинг файлов ${endpoint.name} запущен`);

      this.eventEmitter.emit('file-monitor.started', {
        endpointId,
        endpointName: endpoint.name,
        watchPaths: config.watchPaths.filter(p => p.enabled),
        timestamp: new Date(),
      });

      return true;

    } catch (error) {
      this.logger.error(`❌ Ошибка запуска мониторинга файлов ${endpoint.name}:`, error.stack);
      return false;
    }
  }

  async stopMonitoring(endpointId: string): Promise<void> {
    const watcher = this.watchers.get(endpointId);
    
    if (watcher) {
      await watcher.close();
      this.watchers.delete(endpointId);
      this.logger.log(`📂 Мониторинг файлов ${endpointId} остановлен`);
    }
  }

  private createFileWatcher(
    config: FileMonitorConfig,
    endpoint: IntegrationEndpoint,
  ): chokidar.FSWatcher {
    const watchPaths = config.watchPaths
      .filter(p => p.enabled)
      .map(p => p.path);

    const options: chokidar.WatchOptions = {
      ignored: this.buildIgnorePatterns(config),
      persistent: true,
      ignoreInitial: config.settings.ignoreInitial,
      usePolling: config.settings.usePolling,
      interval: config.settings.pollInterval || 1000,
      binaryInterval: config.settings.pollInterval || 1000,
      awaitWriteFinish: {
        stabilityThreshold: config.settings.stabilityThreshold || 2000,
        pollInterval: 100,
      },
      depth: this.getMaxDepth(config),
    };

    return chokidar.watch(watchPaths, options);
  }

  private buildIgnorePatterns(config: FileMonitorConfig): string[] {
    const patterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/temp/**',
      '**/tmp/**',
    ];

    // Добавляем паттерны исключения из конфигурации
    if (config.processingRules.naming.excludePattern) {
      patterns.push(config.processingRules.naming.excludePattern);
    }

    return patterns;
  }

  private getMaxDepth(config: FileMonitorConfig): number | undefined {
    const hasRecursive = config.watchPaths.some(p => p.recursive);
    return hasRecursive ? undefined : 1;
  }

  private setupWatcherEvents(
    watcher: chokidar.FSWatcher,
    config: FileMonitorConfig,
    endpoint: IntegrationEndpoint,
  ): void {
    watcher
      .on('add', async (filePath, stats) => {
        await this.handleFileEvent('added', filePath, stats, config, endpoint);
      })
      .on('change', async (filePath, stats) => {
        await this.handleFileEvent('changed', filePath, stats, config, endpoint);
      })
      .on('unlink', async (filePath) => {
        await this.handleFileEvent('removed', filePath, null, config, endpoint);
      })
      .on('error', (error) => {
        this.logger.error(`❌ Ошибка file watcher для ${endpoint.name}:`, error.message);
        this.eventEmitter.emit('file-monitor.error', {
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          error: error.message,
          timestamp: new Date(),
        });
      });
  }

  private async initializeWatcher(
    watcher: chokidar.FSWatcher,
    config: FileMonitorConfig,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for watcher initialization'));
      }, 10000);

      watcher.on('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      watcher.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async handleFileEvent(
    eventType: FileEvent['eventType'],
    filePath: string,
    stats: fs.Stats | null,
    config: FileMonitorConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<void> {
    try {
      // Проверяем соответствие файла правилам обработки
      if (!this.shouldProcessFile(filePath, config)) {
        return;
      }

      const fileEvent = await this.createFileEvent(
        eventType,
        filePath,
        stats,
        config,
      );

      // Сохраняем событие
      this.fileEvents.set(fileEvent.eventId, fileEvent);

      this.logger.log(
        `📄 Файловое событие ${eventType}: ${path.basename(filePath)} ` +
        `(${fileEvent.fileSize} bytes)`
      );

      // Отправляем событие
      this.eventEmitter.emit('file-monitor.file.detected', {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        fileEvent,
        timestamp: new Date(),
      });

      // Добавляем в очередь обработки
      if (eventType === 'added' || eventType === 'changed') {
        await this.queueFileForProcessing(fileEvent, config, endpoint);
      }

    } catch (error) {
      this.logger.error(`❌ Ошибка обработки файлового события ${eventType}:`, error.message);
    }
  }

  private shouldProcessFile(filePath: string, config: FileMonitorConfig): boolean {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();

    // Проверяем расширение файла
    const supportedExtensions = config.processingRules.fileTypes.map(ft => ft.extension);
    if (supportedExtensions.length > 0 && !supportedExtensions.includes(extension)) {
      return false;
    }

    // Проверяем паттерн имени файла
    if (config.processingRules.naming.requirePattern) {
      const regex = new RegExp(config.processingRules.naming.requirePattern);
      if (!regex.test(fileName)) {
        return false;
      }
    }

    // Проверяем паттерн исключения
    if (config.processingRules.naming.excludePattern) {
      const regex = new RegExp(config.processingRules.naming.excludePattern);
      if (regex.test(fileName)) {
        return false;
      }
    }

    return true;
  }

  private async createFileEvent(
    eventType: FileEvent['eventType'],
    filePath: string,
    stats: fs.Stats | null,
    config: FileMonitorConfig,
  ): Promise<FileEvent> {
    const eventId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileName = path.basename(filePath);
    const directory = path.dirname(filePath);
    const extension = path.extname(filePath).toLowerCase();

    let fileSize = 0;
    let checksum: string | undefined;
    let lastModified = new Date();

    if (stats) {
      fileSize = stats.size;
      lastModified = stats.mtime;

      // Вычисляем checksum для небольших файлов
      if (fileSize > 0 && fileSize < 10 * 1024 * 1024) { // < 10MB
        try {
          const content = await fs.readFile(filePath);
          checksum = crypto.createHash('md5').update(content).digest('hex');
        } catch (error) {
          this.logger.warn(`⚠️ Не удалось вычислить checksum для ${fileName}:`, error.message);
        }
      }
    }

    return {
      eventId,
      eventType,
      filePath,
      fileName,
      fileSize,
      timestamp: new Date(),
      checksum,
      metadata: {
        extension,
        directory,
        relativePath: path.relative(process.cwd(), filePath),
        isDirectory: stats?.isDirectory() || false,
        lastModified,
        permissions: stats ? `${(stats.mode & parseInt('777', 8)).toString(8)}` : undefined,
      },
      processingStatus: 'pending',
    };
  }

  private async queueFileForProcessing(
    fileEvent: FileEvent,
    config: FileMonitorConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<void> {
    // Проверяем лимит одновременной обработки
    if (this.activeProcessing.size >= config.settings.maxConcurrentFiles) {
      this.logger.debug(`⏳ Файл ${fileEvent.fileName} добавлен в очередь (лимит обработки)`);
      return;
    }

    const jobId = `job_${fileEvent.eventId}`;
    const job: ProcessingJob = {
      jobId,
      fileEvent,
      status: 'queued',
      attempts: 0,
    };

    this.processingQueue.set(jobId, job);

    // Запускаем обработку асинхронно
    setImmediate(() => this.processFile(job, config, endpoint));
  }

  private async processFile(
    job: ProcessingJob,
    config: FileMonitorConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<void> {
    const { fileEvent } = job;
    
    try {
      job.status = 'processing';
      job.startTime = new Date();
      job.attempts++;

      this.activeProcessing.add(job.jobId);
      fileEvent.processingStatus = 'processing';

      this.logger.log(`⚙️ Обработка файла ${fileEvent.fileName} (попытка ${job.attempts})`);

      // Читаем содержимое файла
      const fileContent = await this.readFileContent(fileEvent, config);

      // Отправляем событие об обработке
      this.eventEmitter.emit('file-monitor.file.processing', {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        fileEvent,
        fileContent,
        timestamp: new Date(),
      });

      // Обрабатываем файл согласно типу
      const result = await this.processFileByType(fileEvent, fileContent, config);

      // Перемещаем файл после обработки
      await this.handlePostProcessing(fileEvent, config, true);

      job.status = 'completed';
      job.endTime = new Date();
      job.result = result;
      fileEvent.processingStatus = 'completed';

      this.logger.log(`✅ Файл ${fileEvent.fileName} обработан успешно`);

      // Отправляем событие о завершении
      this.eventEmitter.emit('file-monitor.file.processed', {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        fileEvent,
        result,
        processingTime: job.endTime.getTime() - job.startTime!.getTime(),
        timestamp: new Date(),
      });

    } catch (error) {
      await this.handleProcessingError(job, error, config, endpoint);
    } finally {
      this.activeProcessing.delete(job.jobId);
      
      // Обрабатываем следующий файл из очереди
      this.processNextQueuedFile(config, endpoint);
    }
  }

  private async readFileContent(
    fileEvent: FileEvent,
    config: FileMonitorConfig,
  ): Promise<FileContent> {
    const fileType = config.processingRules.fileTypes.find(
      ft => ft.extension === fileEvent.metadata!.extension
    );

    if (!fileType) {
      throw new Error(`Неподдерживаемый тип файла: ${fileEvent.metadata!.extension}`);
    }

    // Проверяем размер файла
    if (fileEvent.fileSize > fileType.maxSize) {
      throw new Error(
        `Файл слишком большой: ${fileEvent.fileSize} > ${fileType.maxSize} bytes`
      );
    }

    const stats = await fs.stat(fileEvent.filePath);
    let content: string | Buffer;

    if (fileType.encoding === 'binary') {
      content = await fs.readFile(fileEvent.filePath);
    } else if (fileType.encoding === 'base64') {
      const buffer = await fs.readFile(fileEvent.filePath);
      content = buffer.toString('base64');
    } else {
      content = await fs.readFile(fileEvent.filePath, { encoding: fileType.encoding });
    }

    return {
      filePath: fileEvent.filePath,
      content,
      encoding: fileType.encoding,
      size: fileEvent.fileSize,
      checksum: fileEvent.checksum || '',
      metadata: {
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        accessedAt: stats.atime,
        permissions: `${(stats.mode & parseInt('777', 8)).toString(8)}`,
        mimeType: this.getMimeType(fileEvent.metadata!.extension),
      },
    };
  }

  private async processFileByType(
    fileEvent: FileEvent,
    fileContent: FileContent,
    config: FileMonitorConfig,
  ): Promise<any> {
    const fileType = config.processingRules.fileTypes.find(
      ft => ft.extension === fileEvent.metadata!.extension
    );

    if (!fileType) {
      throw new Error(`Процессор не найден для типа файла: ${fileEvent.metadata!.extension}`);
    }

    // Здесь должна быть логика обработки в зависимости от processor
    switch (fileType.processor) {
      case 'csv':
        return this.processCSVFile(fileContent);
      case 'xml':
        return this.processXMLFile(fileContent);
      case 'json':
        return this.processJSONFile(fileContent);
      case 'txt':
        return this.processTextFile(fileContent);
      case 'image':
        return this.processImageFile(fileContent);
      default:
        return this.processGenericFile(fileContent);
    }
  }

  private async processCSVFile(fileContent: FileContent): Promise<any> {
    // Простой CSV парсер
    const lines = fileContent.content.toString().split('\n');
    const headers = lines[0]?.split(',').map(h => h.trim()) || [];
    const rows = lines.slice(1).filter(line => line.trim()).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    return {
      type: 'csv',
      headers,
      rows,
      totalRows: rows.length,
    };
  }

  private async processXMLFile(fileContent: FileContent): Promise<any> {
    // Заглушка для XML обработки
    return {
      type: 'xml',
      content: fileContent.content.toString(),
      size: fileContent.size,
    };
  }

  private async processJSONFile(fileContent: FileContent): Promise<any> {
    try {
      const data = JSON.parse(fileContent.content.toString());
      return {
        type: 'json',
        data,
        keys: Object.keys(data),
      };
    } catch (error) {
      throw new Error(`Некорректный JSON: ${error.message}`);
    }
  }

  private async processTextFile(fileContent: FileContent): Promise<any> {
    const content = fileContent.content.toString();
    return {
      type: 'text',
      content,
      lineCount: content.split('\n').length,
      wordCount: content.split(/\s+/).length,
      charCount: content.length,
    };
  }

  private async processImageFile(fileContent: FileContent): Promise<any> {
    return {
      type: 'image',
      size: fileContent.size,
      base64: fileContent.content instanceof Buffer 
        ? fileContent.content.toString('base64')
        : fileContent.content,
    };
  }

  private async processGenericFile(fileContent: FileContent): Promise<any> {
    return {
      type: 'generic',
      size: fileContent.size,
      encoding: fileContent.encoding,
      checksum: fileContent.checksum,
    };
  }

  private async handlePostProcessing(
    fileEvent: FileEvent,
    config: FileMonitorConfig,
    success: boolean,
  ): Promise<void> {
    const settings = config.processingRules.processing;

    try {
      if (settings.moveAfterProcessing) {
        const targetPath = success ? settings.processedPath : settings.errorPath;
        if (targetPath) {
          await this.moveFile(fileEvent.filePath, targetPath, fileEvent.fileName);
        }
      } else if (settings.deleteAfterProcessing && success) {
        await fs.unlink(fileEvent.filePath);
        this.logger.debug(`🗑️ Файл ${fileEvent.fileName} удален после обработки`);
      }

      if (settings.backupOriginal && success) {
        await this.createBackup(fileEvent);
      }

    } catch (error) {
      this.logger.error(`❌ Ошибка пост-обработки файла ${fileEvent.fileName}:`, error.message);
    }
  }

  private async moveFile(sourcePath: string, targetDir: string, fileName: string): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, fileName);
    await fs.rename(sourcePath, targetPath);
    this.logger.debug(`📤 Файл перемещен: ${sourcePath} → ${targetPath}`);
  }

  private async createBackup(fileEvent: FileEvent): Promise<void> {
    const backupDir = path.join(path.dirname(fileEvent.filePath), 'backup');
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${timestamp}_${fileEvent.fileName}`;
    const backupPath = path.join(backupDir, backupFileName);
    
    await fs.copyFile(fileEvent.filePath, backupPath);
    this.logger.debug(`💾 Создана резервная копия: ${backupPath}`);
  }

  private async handleProcessingError(
    job: ProcessingJob,
    error: Error,
    config: FileMonitorConfig,
    endpoint: IntegrationEndpoint,
  ): Promise<void> {
    const { fileEvent } = job;

    job.error = error.message;
    fileEvent.errorMessage = error.message;
    fileEvent.processingStatus = 'error';

    this.logger.error(`❌ Ошибка обработки файла ${fileEvent.fileName}:`, error.message);

    // Проверяем, нужна ли повторная попытка
    if (job.attempts < config.settings.retryAttempts) {
      this.logger.log(`🔄 Повторная попытка обработки файла ${fileEvent.fileName} через ${config.settings.retryDelay}ms`);
      
      setTimeout(() => {
        this.processFile(job, config, endpoint);
      }, config.settings.retryDelay);
      
      return;
    }

    // Исчерпаны попытки
    job.status = 'failed';
    job.endTime = new Date();

    // Перемещаем в папку ошибок
    await this.handlePostProcessing(fileEvent, config, false);

    // Отправляем событие об ошибке
    this.eventEmitter.emit('file-monitor.file.error', {
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      fileEvent,
      error: error.message,
      attempts: job.attempts,
      timestamp: new Date(),
    });
  }

  private processNextQueuedFile(
    config: FileMonitorConfig,
    endpoint: IntegrationEndpoint,
  ): void {
    if (this.activeProcessing.size >= config.settings.maxConcurrentFiles) {
      return;
    }

    const queuedJob = Array.from(this.processingQueue.values())
      .find(job => job.status === 'queued');

    if (queuedJob) {
      setImmediate(() => this.processFile(queuedJob, config, endpoint));
    }
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.zip': 'application/zip',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  // Публичные методы для внешнего использования
  async getFileEvents(endpointId?: string): Promise<FileEvent[]> {
    const events = Array.from(this.fileEvents.values());
    
    if (endpointId) {
      // Фильтруем по endpointId (нужно добавить эту информацию в события)
      return events;
    }
    
    return events;
  }

  async getFileEvent(eventId: string): Promise<FileEvent | undefined> {
    return this.fileEvents.get(eventId);
  }

  async getProcessingJobs(endpointId?: string): Promise<ProcessingJob[]> {
    return Array.from(this.processingQueue.values());
  }

  async getProcessingJob(jobId: string): Promise<ProcessingJob | undefined> {
    return this.processingQueue.get(jobId);
  }

  async getMonitoringStats(endpointId?: string) {
    const events = await this.getFileEvents(endpointId);
    const jobs = await this.getProcessingJobs(endpointId);

    const stats = {
      totalWatchers: this.watchers.size,
      totalEvents: events.length,
      eventsByType: events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      eventsByStatus: events.reduce((acc, event) => {
        acc[event.processingStatus] = (acc[event.processingStatus] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      processingQueue: {
        total: jobs.length,
        queued: jobs.filter(job => job.status === 'queued').length,
        processing: jobs.filter(job => job.status === 'processing').length,
        completed: jobs.filter(job => job.status === 'completed').length,
        failed: jobs.filter(job => job.status === 'failed').length,
      },
      activeProcessing: this.activeProcessing.size,
    };

    return stats;
  }

  async testConnection(endpoint: IntegrationEndpoint): Promise<boolean> {
    try {
      const config = endpoint.connectionConfig.fileMonitorConfig as FileMonitorConfig;
      
      // Проверяем доступность всех путей для мониторинга
      for (const watchPath of config.watchPaths.filter(p => p.enabled)) {
        try {
          await fs.access(watchPath.path);
        } catch (error) {
          throw new Error(`Путь недоступен: ${watchPath.path}`);
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`❌ Тест file monitor соединения неудачен для ${endpoint.name}:`, error.message);
      return false;
    }
  }

  async clearEventData(eventId?: string): Promise<void> {
    if (eventId) {
      this.fileEvents.delete(eventId);
      
      // Удаляем связанные jobs
      for (const [jobId, job] of this.processingQueue) {
        if (job.fileEvent.eventId === eventId) {
          this.processingQueue.delete(jobId);
        }
      }
      
      this.logger.log(`🧹 Данные файлового события ${eventId} очищены`);
    } else {
      this.fileEvents.clear();
      this.processingQueue.clear();
      this.logger.log('🧹 Все данные файловых событий очищены');
    }
  }
}
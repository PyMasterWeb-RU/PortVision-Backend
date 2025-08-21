import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  MoveTask, 
  MoveTaskType, 
  MoveTaskStatus, 
  MoveTaskPriority, 
  EquipmentType 
} from '../entities/move-task.entity';
import { Container } from '../../common/entities/container.entity';

export interface CreateMoveTaskDto {
  taskName: string;
  type: MoveTaskType;
  priority?: MoveTaskPriority;
  description?: string;
  containerId?: string;
  containerNumber?: string;
  orderId?: string;
  parentTaskId?: string;
  sequenceNumber?: number;
  fromLocation: {
    type: 'yard' | 'gate' | 'vessel' | 'rail' | 'truck' | 'external';
    yardId?: string;
    yardCode?: string;
    zoneId?: string;
    zoneCode?: string;
    slotId?: string;
    slotAddress?: string;
    vesselId?: string;
    vesselName?: string;
    bayRow?: string;
    tierLevel?: string;
    railCarId?: string;
    truckId?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    description?: string;
  };
  toLocation: {
    type: 'yard' | 'gate' | 'vessel' | 'rail' | 'truck' | 'external';
    yardId?: string;
    yardCode?: string;
    zoneId?: string;
    zoneCode?: string;
    slotId?: string;
    slotAddress?: string;
    vesselId?: string;
    vesselName?: string;
    bayRow?: string;
    tierLevel?: string;
    railCarId?: string;
    truckId?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    description?: string;
  };
  requiredEquipmentType: EquipmentType;
  scheduledAt?: Date;
  deadlineAt?: Date;
  estimatedDurationMinutes?: number;
  specialRequirements?: any;
  timeConstraints?: any;
  resourcePlanning?: any;
  automation?: any;
}

export interface UpdateMoveTaskDto {
  taskName?: string;
  status?: MoveTaskStatus;
  priority?: MoveTaskPriority;
  description?: string;
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  assignedEquipmentId?: string;
  assignedEquipmentNumber?: string;
  scheduledAt?: Date;
  deadlineAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDurationMinutes?: number;
  actualDurationMinutes?: number;
  dependencies?: any;
  specialRequirements?: any;
  timeConstraints?: any;
  tracking?: any;
  results?: any;
  cancellationReason?: string;
  notes?: string;
}

export interface MoveTaskSearchFilters {
  type?: MoveTaskType;
  status?: MoveTaskStatus;
  priority?: MoveTaskPriority;
  containerId?: string;
  containerNumber?: string;
  orderId?: string;
  assignedOperatorId?: string;
  assignedEquipmentId?: string;
  requiredEquipmentType?: EquipmentType;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
  deadlineAfter?: Date;
  deadlineBefore?: Date;
  fromLocationYardId?: string;
  toLocationYardId?: string;
  hasDeadline?: boolean;
  overdue?: boolean;
  hasParent?: boolean;
  parentTaskId?: string;
}

@Injectable()
export class MoveTaskService {
  private readonly logger = new Logger(MoveTaskService.name);

  constructor(
    @InjectRepository(MoveTask)
    private readonly moveTaskRepository: Repository<MoveTask>,
    @InjectRepository(Container)
    private readonly containerRepository: Repository<Container>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createMoveTask(createMoveTaskDto: CreateMoveTaskDto): Promise<MoveTask> {
    this.logger.log(`Creating move task: ${createMoveTaskDto.taskName}`);

    // Generate task number
    const taskNumber = await this.generateTaskNumber(createMoveTaskDto.type);

    // Validate container if specified
    if (createMoveTaskDto.containerId) {
      const container = await this.containerRepository.findOne({
        where: { id: createMoveTaskDto.containerId },
      });
      if (!container) {
        throw new NotFoundException(`Container ${createMoveTaskDto.containerId} not found`);
      }
    }

    // Validate parent task if specified
    if (createMoveTaskDto.parentTaskId) {
      const parentTask = await this.moveTaskRepository.findOne({
        where: { id: createMoveTaskDto.parentTaskId },
      });
      if (!parentTask) {
        throw new NotFoundException(`Parent task ${createMoveTaskDto.parentTaskId} not found`);
      }
    }

    const moveTask = this.moveTaskRepository.create({
      ...createMoveTaskDto,
      taskNumber,
      status: MoveTaskStatus.PLANNED,
      priority: createMoveTaskDto.priority || MoveTaskPriority.NORMAL,
      sequenceNumber: createMoveTaskDto.sequenceNumber || 1,
      dependencies: {
        prerequisiteTasks: [],
        blockedTasks: [],
        parallelTasks: [],
        conflictingTasks: [],
      },
    });

    const savedTask = await this.moveTaskRepository.save(moveTask);

    this.eventEmitter.emit('move_task.created', {
      taskId: savedTask.id,
      taskNumber: savedTask.taskNumber,
      type: savedTask.type,
      priority: savedTask.priority,
      containerId: savedTask.containerId,
      fromLocation: savedTask.fromLocation,
      toLocation: savedTask.toLocation,
    });

    this.logger.log(`Move task created: ${savedTask.taskNumber}`);
    return savedTask;
  }

  async getAllMoveTasks(): Promise<MoveTask[]> {
    return this.moveTaskRepository.find({
      relations: ['container', 'order', 'parentTask'],
      order: { createdAt: 'DESC' },
    });
  }

  async getMoveTaskById(id: string): Promise<MoveTask> {
    const moveTask = await this.moveTaskRepository.findOne({
      where: { id },
      relations: ['container', 'order', 'parentTask'],
    });

    if (!moveTask) {
      throw new NotFoundException(`Move task with ID ${id} not found`);
    }

    return moveTask;
  }

  async getMoveTaskByNumber(taskNumber: string): Promise<MoveTask> {
    const moveTask = await this.moveTaskRepository.findOne({
      where: { taskNumber },
      relations: ['container', 'order', 'parentTask'],
    });

    if (!moveTask) {
      throw new NotFoundException(`Move task with number ${taskNumber} not found`);
    }

    return moveTask;
  }

  async updateMoveTask(id: string, updateMoveTaskDto: UpdateMoveTaskDto): Promise<MoveTask> {
    const moveTask = await this.getMoveTaskById(id);

    // Calculate actual duration if completed
    if (updateMoveTaskDto.status === MoveTaskStatus.COMPLETED && moveTask.startedAt) {
      const endTime = updateMoveTaskDto.completedAt || new Date();
      updateMoveTaskDto.actualDurationMinutes = Math.floor(
        (endTime.getTime() - moveTask.startedAt.getTime()) / (1000 * 60)
      );
    }

    Object.assign(moveTask, updateMoveTaskDto);
    const updatedTask = await this.moveTaskRepository.save(moveTask);

    this.eventEmitter.emit('move_task.updated', {
      taskId: updatedTask.id,
      taskNumber: updatedTask.taskNumber,
      status: updatedTask.status,
      changes: updateMoveTaskDto,
    });

    this.logger.log(`Move task updated: ${updatedTask.taskNumber}`);
    return updatedTask;
  }

  async deleteMoveTask(id: string): Promise<void> {
    const moveTask = await this.getMoveTaskById(id);

    // Check if task has dependent tasks
    const dependentTasks = await this.moveTaskRepository.find({
      where: { parentTaskId: id },
    });

    if (dependentTasks.length > 0) {
      throw new BadRequestException(`Cannot delete task ${moveTask.taskNumber} - has ${dependentTasks.length} dependent tasks`);
    }

    // Check if task is in progress
    if (moveTask.status === MoveTaskStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot delete task ${moveTask.taskNumber} - task is in progress`);
    }

    await this.moveTaskRepository.remove(moveTask);

    this.eventEmitter.emit('move_task.deleted', {
      taskId: id,
      taskNumber: moveTask.taskNumber,
    });

    this.logger.log(`Move task deleted: ${moveTask.taskNumber}`);
  }

  async searchMoveTasks(filters: MoveTaskSearchFilters): Promise<MoveTask[]> {
    const query = this.moveTaskRepository.createQueryBuilder('task')
      .leftJoinAndSelect('task.container', 'container')
      .leftJoinAndSelect('task.order', 'order')
      .leftJoinAndSelect('task.parentTask', 'parentTask');

    if (filters.type) {
      query.andWhere('task.type = :type', { type: filters.type });
    }

    if (filters.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }

    if (filters.priority) {
      query.andWhere('task.priority = :priority', { priority: filters.priority });
    }

    if (filters.containerId) {
      query.andWhere('task.containerId = :containerId', { containerId: filters.containerId });
    }

    if (filters.containerNumber) {
      query.andWhere('(container.number = :containerNumber OR task.containerNumber = :containerNumber)', 
        { containerNumber: filters.containerNumber });
    }

    if (filters.orderId) {
      query.andWhere('task.orderId = :orderId', { orderId: filters.orderId });
    }

    if (filters.assignedOperatorId) {
      query.andWhere('task.assignedOperatorId = :assignedOperatorId', { assignedOperatorId: filters.assignedOperatorId });
    }

    if (filters.assignedEquipmentId) {
      query.andWhere('task.assignedEquipmentId = :assignedEquipmentId', { assignedEquipmentId: filters.assignedEquipmentId });
    }

    if (filters.requiredEquipmentType) {
      query.andWhere('task.requiredEquipmentType = :requiredEquipmentType', { requiredEquipmentType: filters.requiredEquipmentType });
    }

    if (filters.scheduledAfter) {
      query.andWhere('task.scheduledAt >= :scheduledAfter', { scheduledAfter: filters.scheduledAfter });
    }

    if (filters.scheduledBefore) {
      query.andWhere('task.scheduledAt <= :scheduledBefore', { scheduledBefore: filters.scheduledBefore });
    }

    if (filters.deadlineAfter) {
      query.andWhere('task.deadlineAt >= :deadlineAfter', { deadlineAfter: filters.deadlineAfter });
    }

    if (filters.deadlineBefore) {
      query.andWhere('task.deadlineAt <= :deadlineBefore', { deadlineBefore: filters.deadlineBefore });
    }

    if (filters.fromLocationYardId) {
      query.andWhere("task.fromLocation->>'yardId' = :fromLocationYardId", { fromLocationYardId: filters.fromLocationYardId });
    }

    if (filters.toLocationYardId) {
      query.andWhere("task.toLocation->>'yardId' = :toLocationYardId", { toLocationYardId: filters.toLocationYardId });
    }

    if (filters.hasDeadline !== undefined) {
      if (filters.hasDeadline) {
        query.andWhere('task.deadlineAt IS NOT NULL');
      } else {
        query.andWhere('task.deadlineAt IS NULL');
      }
    }

    if (filters.overdue) {
      query.andWhere('task.deadlineAt < :now', { now: new Date() });
      query.andWhere('task.status NOT IN (:...completedStatuses)', { 
        completedStatuses: [MoveTaskStatus.COMPLETED, MoveTaskStatus.CANCELLED] 
      });
    }

    if (filters.hasParent !== undefined) {
      if (filters.hasParent) {
        query.andWhere('task.parentTaskId IS NOT NULL');
      } else {
        query.andWhere('task.parentTaskId IS NULL');
      }
    }

    if (filters.parentTaskId) {
      query.andWhere('task.parentTaskId = :parentTaskId', { parentTaskId: filters.parentTaskId });
    }

    query.orderBy('task.priority', 'DESC')
         .addOrderBy('task.scheduledAt', 'ASC')
         .addOrderBy('task.createdAt', 'ASC');

    return query.getMany();
  }

  async startTask(id: string, operatorId: string, equipmentId?: string): Promise<MoveTask> {
    const task = await this.getMoveTaskById(id);

    if (task.status !== MoveTaskStatus.ASSIGNED && task.status !== MoveTaskStatus.QUEUED) {
      throw new BadRequestException(`Cannot start task ${task.taskNumber} - status is ${task.status}`);
    }

    // Check prerequisites
    await this.validatePrerequisites(task);

    const updateData: UpdateMoveTaskDto = {
      status: MoveTaskStatus.IN_PROGRESS,
      startedAt: new Date(),
      assignedOperatorId: operatorId,
    };

    if (equipmentId) {
      updateData.assignedEquipmentId = equipmentId;
    }

    const updatedTask = await this.updateMoveTask(id, updateData);

    this.eventEmitter.emit('move_task.started', {
      taskId: id,
      taskNumber: task.taskNumber,
      operatorId,
      equipmentId,
      startedAt: updateData.startedAt,
    });

    return updatedTask;
  }

  async completeTask(id: string, results: any): Promise<MoveTask> {
    const task = await this.getMoveTaskById(id);

    if (task.status !== MoveTaskStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot complete task ${task.taskNumber} - status is ${task.status}`);
    }

    const completedAt = new Date();
    const actualDurationMinutes = task.startedAt 
      ? Math.floor((completedAt.getTime() - task.startedAt.getTime()) / (1000 * 60))
      : null;

    const updatedTask = await this.updateMoveTask(id, {
      status: MoveTaskStatus.COMPLETED,
      completedAt,
      actualDurationMinutes,
      results: {
        success: true,
        completionRate: 100,
        ...results,
      },
    });

    // Update blocked tasks
    await this.updateBlockedTasks(task);

    this.eventEmitter.emit('move_task.completed', {
      taskId: id,
      taskNumber: task.taskNumber,
      completedAt,
      duration: actualDurationMinutes,
      results,
    });

    return updatedTask;
  }

  async cancelTask(id: string, reason: string): Promise<MoveTask> {
    const task = await this.getMoveTaskById(id);

    if (task.status === MoveTaskStatus.COMPLETED) {
      throw new BadRequestException(`Cannot cancel completed task ${task.taskNumber}`);
    }

    const updatedTask = await this.updateMoveTask(id, {
      status: MoveTaskStatus.CANCELLED,
      cancellationReason: reason,
      completedAt: new Date(),
    });

    this.eventEmitter.emit('move_task.cancelled', {
      taskId: id,
      taskNumber: task.taskNumber,
      reason,
    });

    return updatedTask;
  }

  async assignTask(id: string, operatorId: string, operatorName: string, equipmentId?: string, equipmentNumber?: string): Promise<MoveTask> {
    const task = await this.getMoveTaskById(id);

    if (task.status !== MoveTaskStatus.PLANNED && task.status !== MoveTaskStatus.QUEUED) {
      throw new BadRequestException(`Cannot assign task ${task.taskNumber} - status is ${task.status}`);
    }

    const updatedTask = await this.updateMoveTask(id, {
      status: MoveTaskStatus.ASSIGNED,
      assignedOperatorId: operatorId,
      assignedOperatorName: operatorName,
      assignedEquipmentId: equipmentId,
      assignedEquipmentNumber: equipmentNumber,
    });

    this.eventEmitter.emit('move_task.assigned', {
      taskId: id,
      taskNumber: task.taskNumber,
      operatorId,
      operatorName,
      equipmentId,
      equipmentNumber,
    });

    return updatedTask;
  }

  async addDependency(taskId: string, prerequisiteTaskId: string): Promise<MoveTask> {
    const task = await this.getMoveTaskById(taskId);
    const prerequisiteTask = await this.getMoveTaskById(prerequisiteTaskId);

    // Prevent circular dependencies
    if (await this.hasCircularDependency(taskId, prerequisiteTaskId)) {
      throw new BadRequestException('Cannot add dependency - would create circular dependency');
    }

    const dependencies = task.dependencies || {
      prerequisiteTasks: [],
      blockedTasks: [],
      parallelTasks: [],
      conflictingTasks: [],
    };

    if (!dependencies.prerequisiteTasks.includes(prerequisiteTaskId)) {
      dependencies.prerequisiteTasks.push(prerequisiteTaskId);
    }

    // Update blocked tasks for prerequisite
    const prerequisiteDependencies = prerequisiteTask.dependencies || {
      prerequisiteTasks: [],
      blockedTasks: [],
      parallelTasks: [],
      conflictingTasks: [],
    };

    if (!prerequisiteDependencies.blockedTasks.includes(taskId)) {
      prerequisiteDependencies.blockedTasks.push(taskId);
    }

    await Promise.all([
      this.updateMoveTask(taskId, { dependencies }),
      this.updateMoveTask(prerequisiteTaskId, { dependencies: prerequisiteDependencies }),
    ]);

    return this.getMoveTaskById(taskId);
  }

  async getTasksByContainer(containerId: string): Promise<MoveTask[]> {
    return this.searchMoveTasks({ containerId });
  }

  async getTasksByOrder(orderId: string): Promise<MoveTask[]> {
    return this.searchMoveTasks({ orderId });
  }

  async getTasksByOperator(operatorId: string): Promise<MoveTask[]> {
    return this.searchMoveTasks({ assignedOperatorId: operatorId });
  }

  async getOverdueTasks(): Promise<MoveTask[]> {
    return this.searchMoveTasks({ overdue: true });
  }

  async getTaskStatistics(filters?: { 
    period?: number; 
    operatorId?: string; 
    equipmentType?: EquipmentType;
    yardId?: string;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('created_at >= NOW() - INTERVAL \'' + filters.period + ' days\'');
    }

    if (filters?.operatorId) {
      whereClause.push('assigned_operator_id = $' + (params.length + 1));
      params.push(filters.operatorId);
    }

    if (filters?.equipmentType) {
      whereClause.push('required_equipment_type = $' + (params.length + 1));
      params.push(filters.equipmentType);
    }

    if (filters?.yardId) {
      whereClause.push('(from_location->\'yardId\' = $' + (params.length + 1) + ' OR to_location->\'yardId\' = $' + (params.length + 1) + ')');
      params.push(`"${filters.yardId}"`);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalTasks,
      tasksByType,
      tasksByStatus,
      tasksByPriority,
      avgDuration,
      completionRate,
    ] = await Promise.all([
      this.moveTaskRepository.query(`
        SELECT COUNT(*) as count
        FROM moves.move_tasks
        ${whereSQL}
      `, params),
      this.moveTaskRepository.query(`
        SELECT type, COUNT(*) as count
        FROM moves.move_tasks
        ${whereSQL}
        GROUP BY type
        ORDER BY count DESC
      `, params),
      this.moveTaskRepository.query(`
        SELECT status, COUNT(*) as count
        FROM moves.move_tasks
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.moveTaskRepository.query(`
        SELECT priority, COUNT(*) as count
        FROM moves.move_tasks
        ${whereSQL}
        GROUP BY priority
        ORDER BY count DESC
      `, params),
      this.moveTaskRepository.query(`
        SELECT AVG(actual_duration_minutes) as avg_minutes
        FROM moves.move_tasks
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} actual_duration_minutes IS NOT NULL
      `, params),
      this.moveTaskRepository.query(`
        SELECT 
          COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as completion_rate
        FROM moves.move_tasks
        ${whereSQL}
      `, params),
    ]);

    return {
      totals: {
        totalTasks: parseInt(totalTasks[0].count),
        avgDurationMinutes: parseFloat(avgDuration[0].avg_minutes || 0),
        completionRate: parseFloat(completionRate[0].completion_rate || 0),
      },
      breakdown: {
        byType: tasksByType,
        byStatus: tasksByStatus,
        byPriority: tasksByPriority,
      },
    };
  }

  private async generateTaskNumber(type: MoveTaskType): Promise<string> {
    const prefix = this.getTaskNumberPrefix(type);
    const year = new Date().getFullYear();
    
    const lastTask = await this.moveTaskRepository.findOne({
      where: { taskNumber: new RegExp(`^${prefix}-${year}-`) as any },
      order: { taskNumber: 'DESC' },
    });

    let sequence = 1;
    if (lastTask) {
      const lastSequence = parseInt(lastTask.taskNumber.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }

    return `${prefix}-${year}-${sequence.toString().padStart(6, '0')}`;
  }

  private getTaskNumberPrefix(type: MoveTaskType): string {
    const prefixes = {
      [MoveTaskType.GATE_IN]: 'GI',
      [MoveTaskType.GATE_OUT]: 'GO',
      [MoveTaskType.YARD_TO_YARD]: 'YY',
      [MoveTaskType.VESSEL_LOADING]: 'VL',
      [MoveTaskType.VESSEL_DISCHARGE]: 'VD',
      [MoveTaskType.RAIL_LOADING]: 'RL',
      [MoveTaskType.RAIL_DISCHARGE]: 'RD',
      [MoveTaskType.TRUCK_LOADING]: 'TL',
      [MoveTaskType.TRUCK_DISCHARGE]: 'TD',
      [MoveTaskType.RESTOW]: 'RS',
      [MoveTaskType.INSPECTION]: 'IN',
      [MoveTaskType.WEIGHING]: 'WG',
      [MoveTaskType.REPAIR]: 'RP',
      [MoveTaskType.CUSTOMS_EXAM]: 'CE',
      [MoveTaskType.REEFER_CONNECT]: 'RC',
      [MoveTaskType.REEFER_DISCONNECT]: 'RX',
      [MoveTaskType.TRANSHIPMENT]: 'TS',
    };
    return prefixes[type] || 'MT';
  }

  private async validatePrerequisites(task: MoveTask): Promise<void> {
    if (!task.dependencies?.prerequisiteTasks?.length) {
      return;
    }

    const prerequisites = await this.moveTaskRepository.find({
      where: { id: { $in: task.dependencies.prerequisiteTasks } as any },
    });

    const incompletePrerequisites = prerequisites.filter(
      prereq => prereq.status !== MoveTaskStatus.COMPLETED
    );

    if (incompletePrerequisites.length > 0) {
      const taskNumbers = incompletePrerequisites.map(t => t.taskNumber).join(', ');
      throw new BadRequestException(
        `Cannot start task ${task.taskNumber} - prerequisite tasks not completed: ${taskNumbers}`
      );
    }
  }

  private async updateBlockedTasks(completedTask: MoveTask): Promise<void> {
    if (!completedTask.dependencies?.blockedTasks?.length) {
      return;
    }

    for (const blockedTaskId of completedTask.dependencies.blockedTasks) {
      const blockedTask = await this.getMoveTaskById(blockedTaskId);
      
      // Check if all prerequisites are completed
      const allPrerequisitesCompleted = await this.areAllPrerequisitesCompleted(blockedTask);
      
      if (allPrerequisitesCompleted && blockedTask.status === MoveTaskStatus.PLANNED) {
        await this.updateMoveTask(blockedTaskId, { status: MoveTaskStatus.QUEUED });
      }
    }
  }

  private async areAllPrerequisitesCompleted(task: MoveTask): Promise<boolean> {
    if (!task.dependencies?.prerequisiteTasks?.length) {
      return true;
    }

    const prerequisites = await this.moveTaskRepository.find({
      where: { id: { $in: task.dependencies.prerequisiteTasks } as any },
    });

    return prerequisites.every(prereq => prereq.status === MoveTaskStatus.COMPLETED);
  }

  private async hasCircularDependency(taskId: string, prerequisiteTaskId: string): Promise<boolean> {
    // Simple circular dependency check - in production, implement full graph traversal
    const prerequisiteTask = await this.getMoveTaskById(prerequisiteTaskId);
    
    return prerequisiteTask.dependencies?.prerequisiteTasks?.includes(taskId) || false;
  }
}
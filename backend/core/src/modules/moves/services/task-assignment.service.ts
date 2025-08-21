import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  TaskAssignment, 
  AssignmentStatus, 
  AssignmentType 
} from '../entities/task-assignment.entity';
import { MoveTask, MoveTaskStatus } from '../entities/move-task.entity';
import { MoveTaskService } from './move-task.service';

export interface CreateTaskAssignmentDto {
  taskId: string;
  workOrderId?: string;
  operatorId: string;
  operatorName: string;
  equipmentId?: string;
  equipmentNumber?: string;
  equipmentType?: string;
  assignmentType?: AssignmentType;
  assignedBy: string;
  assignedByName: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  assignmentCriteria?: any;
  operatorQualifications: {
    skills: string[];
    certifications: Array<{
      type: string;
      level: string;
      validUntil: Date;
      issuer: string;
    }>;
    experience: {
      totalHours: number;
      taskTypeExperience: Record<string, number>;
      equipmentExperience: Record<string, number>;
    };
    performanceHistory: {
      completionRate: number;
      onTimeRate: number;
      qualityScore: number;
      safetyRecord: {
        incidents: number;
        lastIncidentDate?: Date;
        safetyTrainingDate: Date;
      };
    };
    availability: {
      shiftPattern: string;
      workingHours: { from: string; to: string }[];
      overtimeAvailable: boolean;
      currentWorkload: number;
    };
  };
  equipmentSpecifications?: any;
  instructions?: any;
}

export interface UpdateTaskAssignmentDto {
  status?: AssignmentStatus;
  acceptedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  executionTracking?: any;
  results?: any;
  rejectionReason?: string;
  notes?: string;
}

export interface AssignmentSearchFilters {
  taskId?: string;
  workOrderId?: string;
  operatorId?: string;
  equipmentId?: string;
  status?: AssignmentStatus;
  assignmentType?: AssignmentType;
  assignedAfter?: Date;
  assignedBefore?: Date;
  scheduledStartAfter?: Date;
  scheduledStartBefore?: Date;
  assignedBy?: string;
}

export interface AutoAssignmentCriteria {
  minimizeCost: boolean;
  minimizeTime: boolean;
  balanceWorkload: boolean;
  preferredOperators?: string[];
  preferredEquipment?: string[];
  maxDistance?: number; // km
  requireCertifications?: string[];
  minExperienceHours?: number;
  minQualityScore?: number;
  maxCurrentWorkload?: number; // percentage
}

export interface AssignmentRecommendation {
  operatorId: string;
  operatorName: string;
  equipmentId?: string;
  equipmentNumber?: string;
  score: number;
  reasoning: {
    skillMatch: number;
    experienceMatch: number;
    availabilityMatch: number;
    proximityMatch: number;
    workloadBalance: number;
    costEfficiency: number;
    totalScore: number;
  };
  estimatedStartTime: Date;
  estimatedCompletionTime: Date;
  estimatedCost: number;
  notes: string[];
}

@Injectable()
export class TaskAssignmentService {
  private readonly logger = new Logger(TaskAssignmentService.name);

  constructor(
    @InjectRepository(TaskAssignment)
    private readonly taskAssignmentRepository: Repository<TaskAssignment>,
    @InjectRepository(MoveTask)
    private readonly moveTaskRepository: Repository<MoveTask>,
    private readonly moveTaskService: MoveTaskService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTaskAssignment(createTaskAssignmentDto: CreateTaskAssignmentDto): Promise<TaskAssignment> {
    this.logger.log(`Creating task assignment for task ${createTaskAssignmentDto.taskId}`);

    // Validate task exists and is assignable
    const task = await this.moveTaskService.getMoveTaskById(createTaskAssignmentDto.taskId);
    
    if (task.status !== MoveTaskStatus.PLANNED && task.status !== MoveTaskStatus.QUEUED) {
      throw new BadRequestException(`Cannot assign task ${task.taskNumber} - status is ${task.status}`);
    }

    // Check for existing active assignment
    const existingAssignment = await this.taskAssignmentRepository.findOne({
      where: { 
        taskId: createTaskAssignmentDto.taskId,
        status: AssignmentStatus.ACCEPTED,
      },
    });

    if (existingAssignment) {
      throw new BadRequestException(`Task ${task.taskNumber} already has an active assignment`);
    }

    const assignment = this.taskAssignmentRepository.create({
      ...createTaskAssignmentDto,
      status: AssignmentStatus.PENDING,
      assignedAt: new Date(),
      assignmentType: createTaskAssignmentDto.assignmentType || AssignmentType.MANUAL,
    });

    const savedAssignment = await this.taskAssignmentRepository.save(assignment);

    // Update task status
    await this.moveTaskService.updateMoveTask(task.id, {
      status: MoveTaskStatus.ASSIGNED,
      assignedOperatorId: createTaskAssignmentDto.operatorId,
      assignedOperatorName: createTaskAssignmentDto.operatorName,
      assignedEquipmentId: createTaskAssignmentDto.equipmentId,
      assignedEquipmentNumber: createTaskAssignmentDto.equipmentNumber,
    });

    this.eventEmitter.emit('task_assignment.created', {
      assignmentId: savedAssignment.id,
      taskId: task.id,
      taskNumber: task.taskNumber,
      operatorId: createTaskAssignmentDto.operatorId,
      operatorName: createTaskAssignmentDto.operatorName,
      assignedBy: createTaskAssignmentDto.assignedBy,
    });

    this.logger.log(`Task assignment created: ${savedAssignment.id}`);
    return savedAssignment;
  }

  async getAllTaskAssignments(): Promise<TaskAssignment[]> {
    return this.taskAssignmentRepository.find({
      relations: ['task', 'workOrder'],
      order: { assignedAt: 'DESC' },
    });
  }

  async getTaskAssignmentById(id: string): Promise<TaskAssignment> {
    const assignment = await this.taskAssignmentRepository.findOne({
      where: { id },
      relations: ['task', 'workOrder'],
    });

    if (!assignment) {
      throw new NotFoundException(`Task assignment with ID ${id} not found`);
    }

    return assignment;
  }

  async updateTaskAssignment(id: string, updateTaskAssignmentDto: UpdateTaskAssignmentDto): Promise<TaskAssignment> {
    const assignment = await this.getTaskAssignmentById(id);

    Object.assign(assignment, updateTaskAssignmentDto);
    const updatedAssignment = await this.taskAssignmentRepository.save(assignment);

    this.eventEmitter.emit('task_assignment.updated', {
      assignmentId: updatedAssignment.id,
      taskId: assignment.taskId,
      changes: updateTaskAssignmentDto,
    });

    this.logger.log(`Task assignment updated: ${updatedAssignment.id}`);
    return updatedAssignment;
  }

  async acceptAssignment(id: string, operatorId: string): Promise<TaskAssignment> {
    const assignment = await this.getTaskAssignmentById(id);

    if (assignment.status !== AssignmentStatus.PENDING) {
      throw new BadRequestException(`Cannot accept assignment ${id} - status is ${assignment.status}`);
    }

    if (assignment.operatorId !== operatorId) {
      throw new BadRequestException(`Assignment ${id} is not assigned to operator ${operatorId}`);
    }

    const updatedAssignment = await this.updateTaskAssignment(id, {
      status: AssignmentStatus.ACCEPTED,
      acceptedAt: new Date(),
    });

    this.eventEmitter.emit('task_assignment.accepted', {
      assignmentId: id,
      taskId: assignment.taskId,
      operatorId,
      acceptedAt: updatedAssignment.acceptedAt,
    });

    return updatedAssignment;
  }

  async rejectAssignment(id: string, operatorId: string, reason: string): Promise<TaskAssignment> {
    const assignment = await this.getTaskAssignmentById(id);

    if (assignment.status !== AssignmentStatus.PENDING) {
      throw new BadRequestException(`Cannot reject assignment ${id} - status is ${assignment.status}`);
    }

    if (assignment.operatorId !== operatorId) {
      throw new BadRequestException(`Assignment ${id} is not assigned to operator ${operatorId}`);
    }

    const updatedAssignment = await this.updateTaskAssignment(id, {
      status: AssignmentStatus.REJECTED,
      rejectionReason: reason,
    });

    // Revert task status back to queued
    await this.moveTaskService.updateMoveTask(assignment.taskId, {
      status: MoveTaskStatus.QUEUED,
      assignedOperatorId: null,
      assignedOperatorName: null,
      assignedEquipmentId: null,
      assignedEquipmentNumber: null,
    });

    this.eventEmitter.emit('task_assignment.rejected', {
      assignmentId: id,
      taskId: assignment.taskId,
      operatorId,
      reason,
    });

    return updatedAssignment;
  }

  async startAssignment(id: string): Promise<TaskAssignment> {
    const assignment = await this.getTaskAssignmentById(id);

    if (assignment.status !== AssignmentStatus.ACCEPTED) {
      throw new BadRequestException(`Cannot start assignment ${id} - status is ${assignment.status}`);
    }

    const updatedAssignment = await this.updateTaskAssignment(id, {
      status: AssignmentStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    // Update task status
    await this.moveTaskService.startTask(
      assignment.taskId, 
      assignment.operatorId, 
      assignment.equipmentId
    );

    this.eventEmitter.emit('task_assignment.started', {
      assignmentId: id,
      taskId: assignment.taskId,
      operatorId: assignment.operatorId,
      startedAt: updatedAssignment.startedAt,
    });

    return updatedAssignment;
  }

  async completeAssignment(id: string, results: any): Promise<TaskAssignment> {
    const assignment = await this.getTaskAssignmentById(id);

    if (assignment.status !== AssignmentStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot complete assignment ${id} - status is ${assignment.status}`);
    }

    const completedAt = new Date();
    const updatedAssignment = await this.updateTaskAssignment(id, {
      status: AssignmentStatus.COMPLETED,
      completedAt,
      results: {
        completion: {
          successful: true,
          completionTime: completedAt,
          durationMinutes: assignment.startedAt 
            ? Math.floor((completedAt.getTime() - assignment.startedAt.getTime()) / (1000 * 60))
            : null,
          qualityScore: results.qualityScore || 8,
        },
        performance: {
          timeEfficiency: results.timeEfficiency || 100,
          qualityMeasures: results.qualityMeasures || {},
          safetyCompliance: results.safetyCompliance !== false,
          costEfficiency: results.costEfficiency || 100,
        },
        feedback: results.feedback || {},
        documentation: results.documentation || {},
      },
    });

    // Complete the task
    await this.moveTaskService.completeTask(assignment.taskId, results);

    this.eventEmitter.emit('task_assignment.completed', {
      assignmentId: id,
      taskId: assignment.taskId,
      operatorId: assignment.operatorId,
      completedAt,
      results,
    });

    return updatedAssignment;
  }

  async reassignTask(taskId: string, newOperatorId: string, newOperatorName: string, reason: string): Promise<TaskAssignment> {
    // Cancel current assignment
    const currentAssignment = await this.taskAssignmentRepository.findOne({
      where: { 
        taskId,
        status: { $in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED] } as any,
      },
    });

    if (currentAssignment) {
      await this.updateTaskAssignment(currentAssignment.id, {
        status: AssignmentStatus.REASSIGNED,
        rejectionReason: reason,
      });
    }

    // Create new assignment (this would need operator qualifications and other data)
    // This is a simplified version - in practice, you'd need to fetch operator data
    const newAssignment = await this.createTaskAssignment({
      taskId,
      operatorId: newOperatorId,
      operatorName: newOperatorName,
      assignmentType: AssignmentType.MANUAL,
      assignedBy: 'system', // Should be actual user ID
      assignedByName: 'System',
      scheduledStartAt: new Date(),
      scheduledEndAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      operatorQualifications: {
        skills: [],
        certifications: [],
        experience: {
          totalHours: 0,
          taskTypeExperience: {},
          equipmentExperience: {},
        },
        performanceHistory: {
          completionRate: 100,
          onTimeRate: 100,
          qualityScore: 8,
          safetyRecord: {
            incidents: 0,
            safetyTrainingDate: new Date(),
          },
        },
        availability: {
          shiftPattern: '8-hour',
          workingHours: [{ from: '08:00', to: '16:00' }],
          overtimeAvailable: true,
          currentWorkload: 50,
        },
      },
    });

    this.eventEmitter.emit('task_assignment.reassigned', {
      taskId,
      previousAssignmentId: currentAssignment?.id,
      newAssignmentId: newAssignment.id,
      newOperatorId,
      reason,
    });

    return newAssignment;
  }

  async searchTaskAssignments(filters: AssignmentSearchFilters): Promise<TaskAssignment[]> {
    const query = this.taskAssignmentRepository.createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.task', 'task')
      .leftJoinAndSelect('assignment.workOrder', 'workOrder');

    if (filters.taskId) {
      query.andWhere('assignment.taskId = :taskId', { taskId: filters.taskId });
    }

    if (filters.workOrderId) {
      query.andWhere('assignment.workOrderId = :workOrderId', { workOrderId: filters.workOrderId });
    }

    if (filters.operatorId) {
      query.andWhere('assignment.operatorId = :operatorId', { operatorId: filters.operatorId });
    }

    if (filters.equipmentId) {
      query.andWhere('assignment.equipmentId = :equipmentId', { equipmentId: filters.equipmentId });
    }

    if (filters.status) {
      query.andWhere('assignment.status = :status', { status: filters.status });
    }

    if (filters.assignmentType) {
      query.andWhere('assignment.assignmentType = :assignmentType', { assignmentType: filters.assignmentType });
    }

    if (filters.assignedAfter) {
      query.andWhere('assignment.assignedAt >= :assignedAfter', { assignedAfter: filters.assignedAfter });
    }

    if (filters.assignedBefore) {
      query.andWhere('assignment.assignedAt <= :assignedBefore', { assignedBefore: filters.assignedBefore });
    }

    if (filters.scheduledStartAfter) {
      query.andWhere('assignment.scheduledStartAt >= :scheduledStartAfter', { scheduledStartAfter: filters.scheduledStartAfter });
    }

    if (filters.scheduledStartBefore) {
      query.andWhere('assignment.scheduledStartAt <= :scheduledStartBefore', { scheduledStartBefore: filters.scheduledStartBefore });
    }

    if (filters.assignedBy) {
      query.andWhere('assignment.assignedBy = :assignedBy', { assignedBy: filters.assignedBy });
    }

    query.orderBy('assignment.assignedAt', 'DESC');

    return query.getMany();
  }

  async getAssignmentsByOperator(operatorId: string): Promise<TaskAssignment[]> {
    return this.searchTaskAssignments({ operatorId });
  }

  async getActiveAssignmentsByOperator(operatorId: string): Promise<TaskAssignment[]> {
    return this.searchTaskAssignments({ 
      operatorId,
      status: AssignmentStatus.IN_PROGRESS,
    });
  }

  async getAssignmentsByTask(taskId: string): Promise<TaskAssignment[]> {
    return this.searchTaskAssignments({ taskId });
  }

  async getAssignmentRecommendations(
    taskId: string,
    criteria: AutoAssignmentCriteria
  ): Promise<AssignmentRecommendation[]> {
    // This is a simplified implementation
    // In practice, this would involve complex algorithms to score operators
    // based on availability, skills, location, workload, etc.

    const task = await this.moveTaskService.getMoveTaskById(taskId);
    
    // Mock operator data - in practice, this would come from personnel service
    const availableOperators = [
      {
        operatorId: 'op1',
        operatorName: 'Operator 1',
        skills: ['crane_operation', 'container_handling'],
        experience: { totalHours: 5000 },
        currentWorkload: 60,
        location: { latitude: 55.7558, longitude: 37.6176 },
        qualityScore: 8.5,
      },
      {
        operatorId: 'op2',
        operatorName: 'Operator 2',
        skills: ['reach_stacker', 'forklift'],
        experience: { totalHours: 3000 },
        currentWorkload: 40,
        location: { latitude: 55.7500, longitude: 37.6200 },
        qualityScore: 7.8,
      },
    ];

    const recommendations: AssignmentRecommendation[] = availableOperators.map(operator => {
      const skillMatch = this.calculateSkillMatch(operator.skills, task.requiredEquipmentType);
      const experienceMatch = this.calculateExperienceMatch(operator.experience.totalHours, criteria.minExperienceHours || 0);
      const availabilityMatch = this.calculateAvailabilityMatch(operator.currentWorkload, criteria.maxCurrentWorkload || 80);
      const proximityMatch = this.calculateProximityMatch(operator.location, task.fromLocation);
      const workloadBalance = this.calculateWorkloadBalance(operator.currentWorkload);
      const costEfficiency = this.calculateCostEfficiency(operator.qualityScore, operator.currentWorkload);

      const totalScore = (
        skillMatch * 0.25 +
        experienceMatch * 0.20 +
        availabilityMatch * 0.20 +
        proximityMatch * 0.15 +
        workloadBalance * 0.10 +
        costEfficiency * 0.10
      );

      return {
        operatorId: operator.operatorId,
        operatorName: operator.operatorName,
        score: totalScore,
        reasoning: {
          skillMatch,
          experienceMatch,
          availabilityMatch,
          proximityMatch,
          workloadBalance,
          costEfficiency,
          totalScore,
        },
        estimatedStartTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        estimatedCompletionTime: new Date(Date.now() + (task.estimatedDurationMinutes || 60) * 60 * 1000),
        estimatedCost: this.calculateEstimatedCost(task, operator),
        notes: this.generateRecommendationNotes(operator, totalScore),
      };
    });

    return recommendations.sort((a, b) => b.score - a.score);
  }

  private calculateSkillMatch(operatorSkills: string[], requiredEquipment: string): number {
    // Simplified skill matching logic
    const equipmentSkillMap = {
      'crane': ['crane_operation'],
      'reach_stacker': ['reach_stacker', 'container_handling'],
      'forklift': ['forklift', 'warehouse_operations'],
    };

    const requiredSkills = equipmentSkillMap[requiredEquipment] || [];
    const matchedSkills = operatorSkills.filter(skill => requiredSkills.includes(skill));
    
    return requiredSkills.length > 0 ? matchedSkills.length / requiredSkills.length : 0.5;
  }

  private calculateExperienceMatch(operatorHours: number, minRequired: number): number {
    if (minRequired === 0) return 1;
    return Math.min(operatorHours / minRequired, 1);
  }

  private calculateAvailabilityMatch(currentWorkload: number, maxWorkload: number): number {
    if (currentWorkload >= maxWorkload) return 0;
    return (maxWorkload - currentWorkload) / maxWorkload;
  }

  private calculateProximityMatch(operatorLocation: any, taskLocation: any): number {
    // Simplified distance calculation - in practice, use proper geospatial calculations
    if (!operatorLocation || !taskLocation.coordinates) return 0.5;
    
    const distance = Math.sqrt(
      Math.pow(operatorLocation.latitude - taskLocation.coordinates.latitude, 2) +
      Math.pow(operatorLocation.longitude - taskLocation.coordinates.longitude, 2)
    );
    
    return Math.max(0, 1 - distance / 0.1); // Within 0.1 degrees = full score
  }

  private calculateWorkloadBalance(currentWorkload: number): number {
    // Prefer operators with moderate workload (not too high, not too low)
    const idealWorkload = 60;
    return 1 - Math.abs(currentWorkload - idealWorkload) / 100;
  }

  private calculateCostEfficiency(qualityScore: number, workload: number): number {
    // Balance quality vs cost (higher workload = higher cost)
    return qualityScore / 10 * (1 - workload / 200);
  }

  private calculateEstimatedCost(task: any, operator: any): number {
    // Simplified cost calculation
    const baseRate = 50; // per hour
    const duration = (task.estimatedDurationMinutes || 60) / 60;
    const skillMultiplier = 1 + (operator.qualityScore - 5) / 10;
    
    return baseRate * duration * skillMultiplier;
  }

  private generateRecommendationNotes(operator: any, score: number): string[] {
    const notes = [];
    
    if (score > 0.8) {
      notes.push('Excellent match for this task');
    } else if (score > 0.6) {
      notes.push('Good match with minor considerations');
    } else {
      notes.push('Acceptable match but consider alternatives');
    }
    
    if (operator.currentWorkload > 70) {
      notes.push('High current workload - may need overtime');
    }
    
    if (operator.qualityScore > 8) {
      notes.push('High quality score - reliable operator');
    }
    
    return notes;
  }

  async getAssignmentStatistics(filters?: { 
    period?: number; 
    operatorId?: string;
    equipmentType?: string;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('assigned_at >= NOW() - INTERVAL \'' + filters.period + ' days\'');
    }

    if (filters?.operatorId) {
      whereClause.push('operator_id = $' + (params.length + 1));
      params.push(filters.operatorId);
    }

    if (filters?.equipmentType) {
      whereClause.push('equipment_type = $' + (params.length + 1));
      params.push(filters.equipmentType);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalAssignments,
      assignmentsByStatus,
      assignmentsByType,
      acceptanceRate,
      avgCompletionTime,
    ] = await Promise.all([
      this.taskAssignmentRepository.query(`
        SELECT COUNT(*) as count
        FROM moves.task_assignments
        ${whereSQL}
      `, params),
      this.taskAssignmentRepository.query(`
        SELECT status, COUNT(*) as count
        FROM moves.task_assignments
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.taskAssignmentRepository.query(`
        SELECT assignment_type, COUNT(*) as count
        FROM moves.task_assignments
        ${whereSQL}
        GROUP BY assignment_type
        ORDER BY count DESC
      `, params),
      this.taskAssignmentRepository.query(`
        SELECT 
          COUNT(CASE WHEN status = 'accepted' OR status = 'in_progress' OR status = 'completed' THEN 1 END) * 100.0 / 
          COUNT(CASE WHEN status != 'reassigned' THEN 1 END) as acceptance_rate
        FROM moves.task_assignments
        ${whereSQL}
      `, params),
      this.taskAssignmentRepository.query(`
        SELECT AVG(
          EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
        ) as avg_minutes
        FROM moves.task_assignments
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} completed_at IS NOT NULL AND started_at IS NOT NULL
      `, params),
    ]);

    return {
      totals: {
        totalAssignments: parseInt(totalAssignments[0].count),
        acceptanceRate: parseFloat(acceptanceRate[0].acceptance_rate || 0),
        avgCompletionTimeMinutes: parseFloat(avgCompletionTime[0].avg_minutes || 0),
      },
      breakdown: {
        byStatus: assignmentsByStatus,
        byType: assignmentsByType,
      },
    };
  }
}
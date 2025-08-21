import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  OperationPlan, 
  PlanType, 
  PlanStatus, 
  PlanPriority 
} from '../entities/operation-plan.entity';

export interface CreateOperationPlanDto {
  planType: PlanType;
  priority?: PlanPriority;
  planTitle: string;
  description: string;
  startDate: Date;
  endDate: Date;
  planManagerId: string;
  planManagerName: string;
  departmentId: string;
  departmentName: string;
  parentPlanId?: string;
  parentPlanNumber?: string;
  objectives: any[];
  resourcePlanning: any;
  operationSchedules: any[];
  performanceTargets: any;
  riskAnalysis: any;
  approvalWorkflow?: any;
  executionTracking?: any;
  communicationPlan?: any;
  budgetInformation?: any;
  relatedDocuments?: any[];
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateOperationPlanDto {
  planType?: PlanType;
  status?: PlanStatus;
  priority?: PlanPriority;
  planTitle?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  planManagerId?: string;
  planManagerName?: string;
  departmentId?: string;
  departmentName?: string;
  parentPlanId?: string;
  parentPlanNumber?: string;
  objectives?: any[];
  resourcePlanning?: any;
  operationSchedules?: any[];
  performanceTargets?: any;
  riskAnalysis?: any;
  approvalWorkflow?: any;
  executionTracking?: any;
  communicationPlan?: any;
  budgetInformation?: any;
  relatedDocuments?: any[];
  notes?: string;
  cancellationReason?: string;
  metadata?: Record<string, any>;
}

export interface PlanSearchFilters {
  planType?: PlanType;
  status?: PlanStatus;
  priority?: PlanPriority;
  planManagerId?: string;
  departmentId?: string;
  parentPlanId?: string;
  startDateAfter?: Date;
  startDateBefore?: Date;
  endDateAfter?: Date;
  endDateBefore?: Date;
  isOverdue?: boolean;
  requiresApproval?: boolean;
  hasOpenIssues?: boolean;
  budgetVariance?: { min: number; max: number };
  progressRange?: { min: number; max: number };
  searchText?: string;
}

@Injectable()
export class OperationPlanService {
  private readonly logger = new Logger(OperationPlanService.name);

  constructor(
    @InjectRepository(OperationPlan)
    private readonly operationPlanRepository: Repository<OperationPlan>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createOperationPlan(createOperationPlanDto: CreateOperationPlanDto): Promise<OperationPlan> {
    this.logger.log(`Creating operation plan: ${createOperationPlanDto.planTitle}`);

    // Generate plan number
    const planNumber = await this.generatePlanNumber(createOperationPlanDto.planType);

    // Validate date range
    if (createOperationPlanDto.endDate <= createOperationPlanDto.startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate parent plan if specified
    if (createOperationPlanDto.parentPlanId) {
      const parentPlan = await this.getOperationPlanById(createOperationPlanDto.parentPlanId);
      createOperationPlanDto.parentPlanNumber = parentPlan.planNumber;
    }

    const operationPlan = this.operationPlanRepository.create({
      ...createOperationPlanDto,
      planNumber,
      status: PlanStatus.DRAFT,
    });

    const savedPlan = await this.operationPlanRepository.save(operationPlan);

    this.eventEmitter.emit('operation_plan.created', {
      planId: savedPlan.id,
      planNumber: savedPlan.planNumber,
      planTitle: savedPlan.planTitle,
      planType: savedPlan.planType,
      planManagerId: savedPlan.planManagerId,
      departmentId: savedPlan.departmentId,
    });

    this.logger.log(`Operation plan created: ${savedPlan.planNumber}`);
    return savedPlan;
  }

  async getAllOperationPlans(): Promise<OperationPlan[]> {
    return this.operationPlanRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getOperationPlanById(id: string): Promise<OperationPlan> {
    const plan = await this.operationPlanRepository.findOne({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Operation plan with ID ${id} not found`);
    }

    return plan;
  }

  async getOperationPlanByNumber(planNumber: string): Promise<OperationPlan> {
    const plan = await this.operationPlanRepository.findOne({
      where: { planNumber },
    });

    if (!plan) {
      throw new NotFoundException(`Operation plan with number ${planNumber} not found`);
    }

    return plan;
  }

  async updateOperationPlan(id: string, updateOperationPlanDto: UpdateOperationPlanDto): Promise<OperationPlan> {
    const plan = await this.getOperationPlanById(id);

    // Validate status transitions
    if (updateOperationPlanDto.status) {
      this.validateStatusTransition(plan.status, updateOperationPlanDto.status);
    }

    // Validate date range if dates are being updated
    if (updateOperationPlanDto.startDate || updateOperationPlanDto.endDate) {
      const startDate = updateOperationPlanDto.startDate || plan.startDate;
      const endDate = updateOperationPlanDto.endDate || plan.endDate;
      
      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    Object.assign(plan, updateOperationPlanDto);
    const updatedPlan = await this.operationPlanRepository.save(plan);

    this.eventEmitter.emit('operation_plan.updated', {
      planId: updatedPlan.id,
      planNumber: updatedPlan.planNumber,
      changes: updateOperationPlanDto,
    });

    this.logger.log(`Operation plan updated: ${updatedPlan.planNumber}`);
    return updatedPlan;
  }

  async deleteOperationPlan(id: string): Promise<void> {
    const plan = await this.getOperationPlanById(id);

    if (plan.status === PlanStatus.ACTIVE) {
      throw new BadRequestException(`Cannot delete active plan ${plan.planNumber}`);
    }

    await this.operationPlanRepository.remove(plan);

    this.eventEmitter.emit('operation_plan.deleted', {
      planId: plan.id,
      planNumber: plan.planNumber,
    });

    this.logger.log(`Operation plan deleted: ${plan.planNumber}`);
  }

  async searchOperationPlans(filters: PlanSearchFilters): Promise<OperationPlan[]> {
    const query = this.operationPlanRepository.createQueryBuilder('plan');

    if (filters.planType) {
      query.andWhere('plan.planType = :planType', { planType: filters.planType });
    }

    if (filters.status) {
      query.andWhere('plan.status = :status', { status: filters.status });
    }

    if (filters.priority) {
      query.andWhere('plan.priority = :priority', { priority: filters.priority });
    }

    if (filters.planManagerId) {
      query.andWhere('plan.planManagerId = :planManagerId', { planManagerId: filters.planManagerId });
    }

    if (filters.departmentId) {
      query.andWhere('plan.departmentId = :departmentId', { departmentId: filters.departmentId });
    }

    if (filters.parentPlanId) {
      query.andWhere('plan.parentPlanId = :parentPlanId', { parentPlanId: filters.parentPlanId });
    }

    if (filters.startDateAfter) {
      query.andWhere('plan.startDate >= :startDateAfter', { startDateAfter: filters.startDateAfter });
    }

    if (filters.startDateBefore) {
      query.andWhere('plan.startDate <= :startDateBefore', { startDateBefore: filters.startDateBefore });
    }

    if (filters.endDateAfter) {
      query.andWhere('plan.endDate >= :endDateAfter', { endDateAfter: filters.endDateAfter });
    }

    if (filters.endDateBefore) {
      query.andWhere('plan.endDate <= :endDateBefore', { endDateBefore: filters.endDateBefore });
    }

    if (filters.isOverdue) {
      query.andWhere('plan.endDate < NOW()')
        .andWhere('plan.status != :completedStatus', { completedStatus: PlanStatus.COMPLETED });
    }

    if (filters.requiresApproval) {
      query.andWhere('plan.status = :reviewStatus', { reviewStatus: PlanStatus.UNDER_REVIEW })
        .andWhere('plan.approvalWorkflow->>\'finalApproval\' = \'false\'');
    }

    if (filters.hasOpenIssues) {
      query.andWhere(`
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(plan.execution_tracking->'issuesAndChallenges') issue
          WHERE issue->>'status' IN ('open', 'in_progress')
        )
      `);
    }

    if (filters.budgetVariance) {
      query.andWhere(
        '(plan.budgetInformation->>\'actualSpending\'->>\'variance\')::numeric BETWEEN :minVariance AND :maxVariance',
        { 
          minVariance: filters.budgetVariance.min,
          maxVariance: filters.budgetVariance.max 
        }
      );
    }

    if (filters.progressRange) {
      query.andWhere(
        '(plan.executionTracking->>\'overallProgress\')::numeric BETWEEN :minProgress AND :maxProgress',
        { 
          minProgress: filters.progressRange.min,
          maxProgress: filters.progressRange.max 
        }
      );
    }

    if (filters.searchText) {
      query.andWhere(`(
        plan.planNumber ILIKE :searchText
        OR plan.planTitle ILIKE :searchText
        OR plan.description ILIKE :searchText
        OR plan.planManagerName ILIKE :searchText
        OR plan.departmentName ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('plan.startDate', 'DESC');

    return query.getMany();
  }

  async getPlansByType(planType: PlanType): Promise<OperationPlan[]> {
    return this.searchOperationPlans({ planType });
  }

  async getPlansByStatus(status: PlanStatus): Promise<OperationPlan[]> {
    return this.searchOperationPlans({ status });
  }

  async getPlansByManager(planManagerId: string): Promise<OperationPlan[]> {
    return this.searchOperationPlans({ planManagerId });
  }

  async getPlansByDepartment(departmentId: string): Promise<OperationPlan[]> {
    return this.searchOperationPlans({ departmentId });
  }

  async getActivePlans(): Promise<OperationPlan[]> {
    return this.searchOperationPlans({ status: PlanStatus.ACTIVE });
  }

  async getOverduePlans(): Promise<OperationPlan[]> {
    return this.searchOperationPlans({ isOverdue: true });
  }

  async getPlansRequiringApproval(): Promise<OperationPlan[]> {
    return this.searchOperationPlans({ requiresApproval: true });
  }

  async submitForApproval(id: string): Promise<OperationPlan> {
    const plan = await this.getOperationPlanById(id);

    if (plan.status !== PlanStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit plan ${plan.planNumber} for approval - status is ${plan.status}`);
    }

    const updatedPlan = await this.updateOperationPlan(id, {
      status: PlanStatus.UNDER_REVIEW,
    });

    this.eventEmitter.emit('operation_plan.submitted_for_approval', {
      planId: updatedPlan.id,
      planNumber: updatedPlan.planNumber,
      planManagerId: plan.planManagerId,
      submittedAt: new Date(),
    });

    return updatedPlan;
  }

  async approvePlan(
    id: string, 
    approverId: string, 
    approverName: string, 
    comments?: string
  ): Promise<OperationPlan> {
    const plan = await this.getOperationPlanById(id);

    if (plan.status !== PlanStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Cannot approve plan ${plan.planNumber} - status is ${plan.status}`);
    }

    const approvalWorkflow = {
      ...plan.approvalWorkflow,
      approvalHistory: [
        ...(plan.approvalWorkflow?.approvalHistory || []),
        {
          level: plan.approvalWorkflow?.currentApprovalLevel || 1,
          approverName,
          approverId,
          action: 'approved' as const,
          timestamp: new Date(),
          comments,
        },
      ],
      finalApproval: true,
    };

    const updatedPlan = await this.updateOperationPlan(id, {
      status: PlanStatus.APPROVED,
      approvalWorkflow,
    });

    this.eventEmitter.emit('operation_plan.approved', {
      planId: updatedPlan.id,
      planNumber: updatedPlan.planNumber,
      approverId,
      approvedAt: new Date(),
    });

    return updatedPlan;
  }

  async rejectPlan(
    id: string, 
    approverId: string, 
    approverName: string, 
    reason: string
  ): Promise<OperationPlan> {
    const plan = await this.getOperationPlanById(id);

    if (plan.status !== PlanStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Cannot reject plan ${plan.planNumber} - status is ${plan.status}`);
    }

    const approvalWorkflow = {
      ...plan.approvalWorkflow,
      approvalHistory: [
        ...(plan.approvalWorkflow?.approvalHistory || []),
        {
          level: plan.approvalWorkflow?.currentApprovalLevel || 1,
          approverName,
          approverId,
          action: 'rejected' as const,
          timestamp: new Date(),
          comments: reason,
        },
      ],
      finalApproval: false,
    };

    const updatedPlan = await this.updateOperationPlan(id, {
      status: PlanStatus.DRAFT,
      approvalWorkflow,
    });

    this.eventEmitter.emit('operation_plan.rejected', {
      planId: updatedPlan.id,
      planNumber: updatedPlan.planNumber,
      approverId,
      reason,
      rejectedAt: new Date(),
    });

    return updatedPlan;
  }

  async activatePlan(id: string): Promise<OperationPlan> {
    const plan = await this.getOperationPlanById(id);

    if (plan.status !== PlanStatus.APPROVED) {
      throw new BadRequestException(`Cannot activate plan ${plan.planNumber} - status is ${plan.status}`);
    }

    const updatedPlan = await this.updateOperationPlan(id, {
      status: PlanStatus.ACTIVE,
    });

    this.eventEmitter.emit('operation_plan.activated', {
      planId: updatedPlan.id,
      planNumber: updatedPlan.planNumber,
      activatedAt: new Date(),
    });

    return updatedPlan;
  }

  async completePlan(id: string, completionReport?: any): Promise<OperationPlan> {
    const plan = await this.getOperationPlanById(id);

    if (plan.status !== PlanStatus.ACTIVE) {
      throw new BadRequestException(`Cannot complete plan ${plan.planNumber} - status is ${plan.status}`);
    }

    const executionTracking = {
      ...plan.executionTracking,
      overallProgress: 100,
      completionReport,
      completedAt: new Date(),
    };

    const updatedPlan = await this.updateOperationPlan(id, {
      status: PlanStatus.COMPLETED,
      executionTracking,
    });

    this.eventEmitter.emit('operation_plan.completed', {
      planId: updatedPlan.id,
      planNumber: updatedPlan.planNumber,
      completedAt: new Date(),
    });

    return updatedPlan;
  }

  async updateProgress(id: string, progress: number, notes?: string): Promise<OperationPlan> {
    const plan = await this.getOperationPlanById(id);

    if (progress < 0 || progress > 100) {
      throw new BadRequestException('Progress must be between 0 and 100');
    }

    const executionTracking = {
      ...plan.executionTracking,
      overallProgress: progress,
      lastProgressUpdate: new Date(),
      progressNotes: notes,
    };

    const updatedPlan = await this.updateOperationPlan(id, {
      executionTracking,
    });

    this.eventEmitter.emit('operation_plan.progress_updated', {
      planId: updatedPlan.id,
      planNumber: updatedPlan.planNumber,
      progress,
      updatedAt: new Date(),
    });

    return updatedPlan;
  }

  async addIssue(
    id: string, 
    issue: {
      category: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      reportedBy: string;
      impact?: string;
    }
  ): Promise<OperationPlan> {
    const plan = await this.getOperationPlanById(id);

    const newIssue = {
      issueId: `issue-${Date.now()}`,
      ...issue,
      reportedAt: new Date(),
      status: 'open' as const,
    };

    const executionTracking = {
      ...plan.executionTracking,
      issuesAndChallenges: [
        ...(plan.executionTracking?.issuesAndChallenges || []),
        newIssue,
      ],
    };

    const updatedPlan = await this.updateOperationPlan(id, {
      executionTracking,
    });

    this.eventEmitter.emit('operation_plan.issue_added', {
      planId: updatedPlan.id,
      planNumber: updatedPlan.planNumber,
      issue: newIssue,
    });

    return updatedPlan;
  }

  private validateStatusTransition(currentStatus: PlanStatus, newStatus: PlanStatus): void {
    const validTransitions: Record<PlanStatus, PlanStatus[]> = {
      [PlanStatus.DRAFT]: [PlanStatus.UNDER_REVIEW, PlanStatus.CANCELLED],
      [PlanStatus.UNDER_REVIEW]: [PlanStatus.APPROVED, PlanStatus.DRAFT, PlanStatus.CANCELLED],
      [PlanStatus.APPROVED]: [PlanStatus.ACTIVE, PlanStatus.ON_HOLD, PlanStatus.CANCELLED],
      [PlanStatus.ACTIVE]: [PlanStatus.COMPLETED, PlanStatus.ON_HOLD, PlanStatus.CANCELLED],
      [PlanStatus.ON_HOLD]: [PlanStatus.ACTIVE, PlanStatus.CANCELLED],
      [PlanStatus.COMPLETED]: [PlanStatus.SUPERSEDED],
      [PlanStatus.CANCELLED]: [],
      [PlanStatus.SUPERSEDED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private async generatePlanNumber(planType: PlanType): Promise<string> {
    const typePrefix = {
      [PlanType.DAILY]: 'PLN-D',
      [PlanType.WEEKLY]: 'PLN-W',
      [PlanType.MONTHLY]: 'PLN-M',
      [PlanType.QUARTERLY]: 'PLN-Q',
      [PlanType.ANNUAL]: 'PLN-A',
      [PlanType.SEASONAL]: 'PLN-S',
      [PlanType.VESSEL_OPERATION]: 'PLN-V',
      [PlanType.MAINTENANCE]: 'PLN-MT',
      [PlanType.SPECIAL_EVENT]: 'PLN-SE',
    };

    const prefix = typePrefix[planType] || 'PLN';
    const year = new Date().getFullYear();
    
    // Find the next sequence number for this type and year
    const lastPlan = await this.operationPlanRepository
      .createQueryBuilder('plan')
      .where('plan.planNumber LIKE :pattern', { 
        pattern: `${prefix}-${year}-%` 
      })
      .orderBy('plan.planNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastPlan) {
      const lastNumber = lastPlan.planNumber.split('-')[2];
      sequence = parseInt(lastNumber) + 1;
    }

    return `${prefix}-${year}-${sequence.toString().padStart(3, '0')}`;
  }

  async getPlanStatistics(filters?: {
    period?: number;
    departmentId?: string;
    planManagerId?: string;
    planType?: PlanType;
  }) {
    const whereClause = [];
    const params = [];

    if (filters?.period) {
      whereClause.push('start_date >= NOW() - INTERVAL \\'' + filters.period + ' days\\'');
    }

    if (filters?.departmentId) {
      whereClause.push('department_id = $' + (params.length + 1));
      params.push(filters.departmentId);
    }

    if (filters?.planManagerId) {
      whereClause.push('plan_manager_id = $' + (params.length + 1));
      params.push(filters.planManagerId);
    }

    if (filters?.planType) {
      whereClause.push('plan_type = $' + (params.length + 1));
      params.push(filters.planType);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const [
      totalPlans,
      plansByStatus,
      plansByType,
      avgProgress,
      budgetUtilization,
      overdueCount,
    ] = await Promise.all([
      this.operationPlanRepository.query(`
        SELECT COUNT(*) as count
        FROM planning.operation_plans
        ${whereSQL}
      `, params),
      this.operationPlanRepository.query(`
        SELECT status, COUNT(*) as count
        FROM planning.operation_plans
        ${whereSQL}
        GROUP BY status
        ORDER BY count DESC
      `, params),
      this.operationPlanRepository.query(`
        SELECT plan_type, COUNT(*) as count
        FROM planning.operation_plans
        ${whereSQL}
        GROUP BY plan_type
        ORDER BY count DESC
      `, params),
      this.operationPlanRepository.query(`
        SELECT AVG((execution_tracking->>'overallProgress')::numeric) as avg_progress
        FROM planning.operation_plans
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} execution_tracking IS NOT NULL
      `, params),
      this.operationPlanRepository.query(`
        SELECT AVG(
          (budget_information->'actualSpending'->>'toDate')::numeric * 100.0 / 
          (budget_information->'totalBudget'->>'amount')::numeric
        ) as avg_utilization
        FROM planning.operation_plans
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} budget_information IS NOT NULL
      `, params),
      this.operationPlanRepository.query(`
        SELECT COUNT(*) as count
        FROM planning.operation_plans
        ${whereSQL ? whereSQL + ' AND' : 'WHERE'} end_date < NOW() AND status != 'completed'
      `, params),
    ]);

    return {
      totals: {
        totalPlans: parseInt(totalPlans[0].count),
        avgProgress: parseFloat(avgProgress[0].avg_progress || 0),
        avgBudgetUtilization: parseFloat(budgetUtilization[0].avg_utilization || 0),
        overdueCount: parseInt(overdueCount[0].count),
      },
      breakdown: {
        byStatus: plansByStatus,
        byType: plansByType,
      },
    };
  }
}
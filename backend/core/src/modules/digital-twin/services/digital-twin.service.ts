import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  TerminalView,
  ViewType,
  ViewStatus,
  ViewMode
} from '../entities/terminal-view.entity';
import {
  TerminalObject,
  ObjectType,
  ObjectStatus,
  RenderMode
} from '../entities/terminal-object.entity';

export interface CreateTerminalViewDto {
  viewName: string;
  description?: string;
  viewType: ViewType;
  viewMode?: ViewMode;
  isDefault?: boolean;
  isPublic?: boolean;
  cameraSettings: any;
  viewBoundaries?: any;
  lightingSettings?: any;
  displayLayers: any;
  filterSettings?: any;
  animationSettings?: any;
  interactionSettings?: any;
  performanceSettings?: any;
  notificationSettings?: any;
  createdBy: string;
  createdByName: string;
  allowedUsers?: string[];
  allowedRoles?: string[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateTerminalViewDto {
  viewName?: string;
  description?: string;
  status?: ViewStatus;
  viewMode?: ViewMode;
  isDefault?: boolean;
  isPublic?: boolean;
  cameraSettings?: any;
  viewBoundaries?: any;
  lightingSettings?: any;
  displayLayers?: any;
  filterSettings?: any;
  animationSettings?: any;
  interactionSettings?: any;
  performanceSettings?: any;
  notificationSettings?: any;
  allowedUsers?: string[];
  allowedRoles?: string[];
  tags?: string[];
  metadata?: Record<string, any>;
  lastUsedAt?: Date;
  usageCount?: number;
}

export interface CreateTerminalObjectDto {
  objectName: string;
  description?: string;
  objectType: ObjectType;
  status?: ObjectStatus;
  renderMode?: RenderMode;
  isVisible?: boolean;
  isInteractive?: boolean;
  isStatic?: boolean;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; order?: string };
  scale: { x: number; y: number; z: number };
  dimensions: any;
  boundingBox: any;
  geometryData: any;
  materialData: any;
  animationData?: any;
  physicsData?: any;
  lightingData?: any;
  entityType?: string;
  entityId?: string;
  parentObjectId?: string;
  childObjectIds?: string[];
  lodLevels?: any[];
  renderMetadata?: any;
  interactionData?: any;
  performanceData?: any;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateTerminalObjectDto {
  objectName?: string;
  description?: string;
  status?: ObjectStatus;
  renderMode?: RenderMode;
  isVisible?: boolean;
  isInteractive?: boolean;
  isStatic?: boolean;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; order?: string };
  scale?: { x: number; y: number; z: number };
  dimensions?: any;
  boundingBox?: any;
  geometryData?: any;
  materialData?: any;
  animationData?: any;
  physicsData?: any;
  lightingData?: any;
  parentObjectId?: string;
  childObjectIds?: string[];
  lodLevels?: any[];
  renderMetadata?: any;
  interactionData?: any;
  performanceData?: any;
  tags?: string[];
  metadata?: Record<string, any>;
  lastRenderedAt?: Date;
}

export interface DigitalTwinSearchFilters {
  viewType?: ViewType;
  objectType?: ObjectType;
  status?: ViewStatus | ObjectStatus;
  viewMode?: ViewMode;
  renderMode?: RenderMode;
  createdBy?: string;
  entityType?: string;
  entityId?: string;
  isVisible?: boolean;
  isInteractive?: boolean;
  isDefault?: boolean;
  isPublic?: boolean;
  hasAnimations?: boolean;
  hasPhysics?: boolean;
  tags?: string[];
  searchText?: string;
}

@Injectable()
export class DigitalTwinService {
  private readonly logger = new Logger(DigitalTwinService.name);

  constructor(
    @InjectRepository(TerminalView)
    private readonly terminalViewRepository: Repository<TerminalView>,
    @InjectRepository(TerminalObject)
    private readonly terminalObjectRepository: Repository<TerminalObject>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Terminal Views Methods
  async createTerminalView(createViewDto: CreateTerminalViewDto): Promise<TerminalView> {
    this.logger.log(`Creating terminal view: ${createViewDto.viewName}`);

    // If setting as default, unset other defaults of the same type
    if (createViewDto.isDefault) {
      await this.unsetDefaultViews(createViewDto.viewType);
    }

    const view = this.terminalViewRepository.create({
      ...createViewDto,
      status: ViewStatus.ACTIVE,
    });

    const savedView = await this.terminalViewRepository.save(view);

    this.eventEmitter.emit('terminal-view.created', {
      viewId: savedView.id,
      viewName: savedView.viewName,
      viewType: savedView.viewType,
      createdBy: savedView.createdBy,
    });

    this.logger.log(`Terminal view created: ${savedView.id}`);
    return savedView;
  }

  async getAllTerminalViews(): Promise<TerminalView[]> {
    return this.terminalViewRepository.find({
      where: { status: ViewStatus.ACTIVE },
      order: { usageCount: 'DESC', updatedAt: 'DESC' },
    });
  }

  async getTerminalViewById(id: string): Promise<TerminalView> {
    const view = await this.terminalViewRepository.findOne({
      where: { id },
    });

    if (!view) {
      throw new NotFoundException(`Terminal view with ID ${id} not found`);
    }

    return view;
  }

  async updateTerminalView(id: string, updateViewDto: UpdateTerminalViewDto): Promise<TerminalView> {
    const view = await this.getTerminalViewById(id);

    // If setting as default, unset other defaults of the same type
    if (updateViewDto.isDefault && !view.isDefault) {
      await this.unsetDefaultViews(view.viewType);
    }

    Object.assign(view, updateViewDto);
    const updatedView = await this.terminalViewRepository.save(view);

    this.eventEmitter.emit('terminal-view.updated', {
      viewId: updatedView.id,
      viewName: updatedView.viewName,
      changes: updateViewDto,
    });

    this.logger.log(`Terminal view updated: ${updatedView.id}`);
    return updatedView;
  }

  async deleteTerminalView(id: string): Promise<void> {
    const view = await this.getTerminalViewById(id);

    await this.terminalViewRepository.remove(view);

    this.eventEmitter.emit('terminal-view.deleted', {
      viewId: view.id,
      viewName: view.viewName,
    });

    this.logger.log(`Terminal view deleted: ${view.id}`);
  }

  async getViewsByType(viewType: ViewType): Promise<TerminalView[]> {
    return this.terminalViewRepository.find({
      where: { 
        viewType,
        status: ViewStatus.ACTIVE,
      },
      order: { usageCount: 'DESC' },
    });
  }

  async getDefaultView(viewType: ViewType): Promise<TerminalView | null> {
    return this.terminalViewRepository.findOne({
      where: { 
        viewType,
        isDefault: true,
        status: ViewStatus.ACTIVE,
      },
    });
  }

  async getPublicViews(): Promise<TerminalView[]> {
    return this.terminalViewRepository.find({
      where: { 
        isPublic: true,
        status: ViewStatus.ACTIVE,
      },
      order: { usageCount: 'DESC' },
    });
  }

  async getUserViews(userId: string): Promise<TerminalView[]> {
    return this.terminalViewRepository.find({
      where: [
        { createdBy: userId },
        { allowedUsers: userId },
      ],
      order: { lastUsedAt: 'DESC' },
    });
  }

  async recordViewUsage(id: string): Promise<TerminalView> {
    const view = await this.getTerminalViewById(id);
    
    return this.updateTerminalView(id, {
      lastUsedAt: new Date(),
      usageCount: view.usageCount + 1,
    });
  }

  // Terminal Objects Methods
  async createTerminalObject(createObjectDto: CreateTerminalObjectDto): Promise<TerminalObject> {
    this.logger.log(`Creating terminal object: ${createObjectDto.objectName}`);

    // Calculate bounding box if not provided
    if (!createObjectDto.boundingBox) {
      createObjectDto.boundingBox = this.calculateBoundingBox(
        createObjectDto.position,
        createObjectDto.dimensions
      );
    }

    const object = this.terminalObjectRepository.create({
      ...createObjectDto,
      status: createObjectDto.status || ObjectStatus.ACTIVE,
    });

    const savedObject = await this.terminalObjectRepository.save(object);

    this.eventEmitter.emit('terminal-object.created', {
      objectId: savedObject.id,
      objectName: savedObject.objectName,
      objectType: savedObject.objectType,
      entityType: savedObject.entityType,
      entityId: savedObject.entityId,
    });

    this.logger.log(`Terminal object created: ${savedObject.id}`);
    return savedObject;
  }

  async getAllTerminalObjects(): Promise<TerminalObject[]> {
    return this.terminalObjectRepository.find({
      where: { status: ObjectStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async getTerminalObjectById(id: string): Promise<TerminalObject> {
    const object = await this.terminalObjectRepository.findOne({
      where: { id },
    });

    if (!object) {
      throw new NotFoundException(`Terminal object with ID ${id} not found`);
    }

    return object;
  }

  async updateTerminalObject(id: string, updateObjectDto: UpdateTerminalObjectDto): Promise<TerminalObject> {
    const object = await this.getTerminalObjectById(id);

    // Recalculate bounding box if position or dimensions changed
    if (updateObjectDto.position || updateObjectDto.dimensions) {
      const position = updateObjectDto.position || object.position;
      const dimensions = updateObjectDto.dimensions || object.dimensions;
      updateObjectDto.boundingBox = this.calculateBoundingBox(position, dimensions);
    }

    Object.assign(object, updateObjectDto);
    const updatedObject = await this.terminalObjectRepository.save(object);

    this.eventEmitter.emit('terminal-object.updated', {
      objectId: updatedObject.id,
      objectName: updatedObject.objectName,
      changes: updateObjectDto,
    });

    this.logger.log(`Terminal object updated: ${updatedObject.id}`);
    return updatedObject;
  }

  async deleteTerminalObject(id: string): Promise<void> {
    const object = await this.getTerminalObjectById(id);

    // Remove from parent's children list
    if (object.parentObjectId) {
      const parent = await this.getTerminalObjectById(object.parentObjectId);
      const updatedChildren = (parent.childObjectIds || []).filter(childId => childId !== id);
      await this.updateTerminalObject(parent.id, { childObjectIds: updatedChildren });
    }

    // Update children to remove parent reference
    if (object.childObjectIds && object.childObjectIds.length > 0) {
      for (const childId of object.childObjectIds) {
        try {
          await this.updateTerminalObject(childId, { parentObjectId: null });
        } catch (error) {
          this.logger.warn(`Failed to update child object ${childId}: ${error.message}`);
        }
      }
    }

    await this.terminalObjectRepository.remove(object);

    this.eventEmitter.emit('terminal-object.deleted', {
      objectId: object.id,
      objectName: object.objectName,
    });

    this.logger.log(`Terminal object deleted: ${object.id}`);
  }

  async getObjectsByType(objectType: ObjectType): Promise<TerminalObject[]> {
    return this.terminalObjectRepository.find({
      where: { 
        objectType,
        status: ObjectStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getObjectsByEntity(entityType: string, entityId: string): Promise<TerminalObject[]> {
    return this.terminalObjectRepository.find({
      where: { 
        entityType,
        entityId,
        status: ObjectStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getVisibleObjects(): Promise<TerminalObject[]> {
    return this.terminalObjectRepository.find({
      where: { 
        isVisible: true,
        status: ObjectStatus.ACTIVE,
      },
      order: { renderMetadata: 'ASC' }, // Render order
    });
  }

  async getObjectsInBounds(bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ?: number;
    maxZ?: number;
  }): Promise<TerminalObject[]> {
    const query = this.terminalObjectRepository.createQueryBuilder('object')
      .where('object.status = :status', { status: ObjectStatus.ACTIVE })
      .andWhere('object.position->>\'x\' BETWEEN :minX AND :maxX', { 
        minX: bounds.minX, 
        maxX: bounds.maxX 
      })
      .andWhere('object.position->>\'y\' BETWEEN :minY AND :maxY', { 
        minY: bounds.minY, 
        maxY: bounds.maxY 
      });

    if (bounds.minZ !== undefined && bounds.maxZ !== undefined) {
      query.andWhere('object.position->>\'z\' BETWEEN :minZ AND :maxZ', { 
        minZ: bounds.minZ, 
        maxZ: bounds.maxZ 
      });
    }

    return query.getMany();
  }

  async updateObjectPosition(id: string, position: { x: number; y: number; z: number }): Promise<TerminalObject> {
    const object = await this.getTerminalObjectById(id);

    if (object.isStatic) {
      throw new BadRequestException('Cannot move static object');
    }

    const updatedObject = await this.updateTerminalObject(id, { 
      position,
      lastRenderedAt: new Date(),
    });

    this.eventEmitter.emit('terminal-object.moved', {
      objectId: updatedObject.id,
      objectName: updatedObject.objectName,
      oldPosition: object.position,
      newPosition: position,
    });

    return updatedObject;
  }

  async updateObjectVisibility(id: string, isVisible: boolean): Promise<TerminalObject> {
    const updatedObject = await this.updateTerminalObject(id, { 
      isVisible,
      lastRenderedAt: new Date(),
    });

    this.eventEmitter.emit('terminal-object.visibility-changed', {
      objectId: updatedObject.id,
      objectName: updatedObject.objectName,
      isVisible,
    });

    return updatedObject;
  }

  async setObjectParent(childId: string, parentId: string | null): Promise<TerminalObject> {
    const child = await this.getTerminalObjectById(childId);

    // Remove from old parent
    if (child.parentObjectId) {
      const oldParent = await this.getTerminalObjectById(child.parentObjectId);
      const updatedChildren = (oldParent.childObjectIds || []).filter(id => id !== childId);
      await this.updateTerminalObject(oldParent.id, { childObjectIds: updatedChildren });
    }

    // Add to new parent
    if (parentId) {
      const newParent = await this.getTerminalObjectById(parentId);
      const updatedChildren = [...(newParent.childObjectIds || []), childId];
      await this.updateTerminalObject(parentId, { childObjectIds: updatedChildren });
    }

    return this.updateTerminalObject(childId, { parentObjectId: parentId });
  }

  async searchObjects(filters: DigitalTwinSearchFilters): Promise<TerminalObject[]> {
    const query = this.terminalObjectRepository.createQueryBuilder('object');

    if (filters.objectType) {
      query.andWhere('object.objectType = :objectType', { objectType: filters.objectType });
    }

    if (filters.status) {
      query.andWhere('object.status = :status', { status: filters.status });
    }

    if (filters.renderMode) {
      query.andWhere('object.renderMode = :renderMode', { renderMode: filters.renderMode });
    }

    if (filters.entityType) {
      query.andWhere('object.entityType = :entityType', { entityType: filters.entityType });
    }

    if (filters.entityId) {
      query.andWhere('object.entityId = :entityId', { entityId: filters.entityId });
    }

    if (filters.isVisible !== undefined) {
      query.andWhere('object.isVisible = :isVisible', { isVisible: filters.isVisible });
    }

    if (filters.isInteractive !== undefined) {
      query.andWhere('object.isInteractive = :isInteractive', { isInteractive: filters.isInteractive });
    }

    if (filters.hasAnimations !== undefined) {
      query.andWhere('object.animationData->>\'hasAnimations\' = :hasAnimations', { 
        hasAnimations: filters.hasAnimations.toString() 
      });
    }

    if (filters.hasPhysics !== undefined) {
      query.andWhere('object.physicsData->>\'hasPhysics\' = :hasPhysics', { 
        hasPhysics: filters.hasPhysics.toString() 
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      query.andWhere('object.tags && :tags', { tags: filters.tags });
    }

    if (filters.searchText) {
      query.andWhere(`(
        object.objectName ILIKE :searchText
        OR object.description ILIKE :searchText
      )`, { searchText: `%${filters.searchText}%` });
    }

    query.orderBy('object.createdAt', 'DESC');

    return query.getMany();
  }

  // Utility Methods
  private async unsetDefaultViews(viewType: ViewType): Promise<void> {
    await this.terminalViewRepository.update(
      { viewType, isDefault: true },
      { isDefault: false }
    );
  }

  private calculateBoundingBox(position: { x: number; y: number; z: number }, dimensions: any): any {
    const halfWidth = dimensions.width / 2;
    const halfHeight = dimensions.height / 2;
    const halfDepth = dimensions.depth / 2;

    return {
      min: {
        x: position.x - halfWidth,
        y: position.y - halfHeight,
        z: position.z - halfDepth,
      },
      max: {
        x: position.x + halfWidth,
        y: position.y + halfHeight,
        z: position.z + halfDepth,
      },
      center: position,
      size: {
        x: dimensions.width,
        y: dimensions.height,
        z: dimensions.depth,
      },
    };
  }

  async getDigitalTwinStatistics() {
    const [
      totalViews,
      totalObjects,
      viewsByType,
      objectsByType,
      renderingStats,
    ] = await Promise.all([
      this.terminalViewRepository.count({ where: { status: ViewStatus.ACTIVE } }),
      this.terminalObjectRepository.count({ where: { status: ObjectStatus.ACTIVE } }),
      this.terminalViewRepository.query(`
        SELECT view_type, COUNT(*) as count
        FROM digital_twin.terminal_views
        WHERE status = 'active'
        GROUP BY view_type
        ORDER BY count DESC
      `),
      this.terminalObjectRepository.query(`
        SELECT object_type, COUNT(*) as count
        FROM digital_twin.terminal_objects
        WHERE status = 'active'
        GROUP BY object_type
        ORDER BY count DESC
      `),
      this.terminalObjectRepository.query(`
        SELECT 
          COUNT(CASE WHEN is_visible = true THEN 1 END) as visible_objects,
          COUNT(CASE WHEN animation_data->>'hasAnimations' = 'true' THEN 1 END) as animated_objects,
          COUNT(CASE WHEN physics_data->>'hasPhysics' = 'true' THEN 1 END) as physics_objects,
          COUNT(CASE WHEN is_interactive = true THEN 1 END) as interactive_objects
        FROM digital_twin.terminal_objects
        WHERE status = 'active'
      `),
    ]);

    return {
      totals: {
        totalViews,
        totalObjects,
        visibleObjects: parseInt(renderingStats[0].visible_objects),
        animatedObjects: parseInt(renderingStats[0].animated_objects),
        physicsObjects: parseInt(renderingStats[0].physics_objects),
        interactiveObjects: parseInt(renderingStats[0].interactive_objects),
      },
      breakdown: {
        viewsByType,
        objectsByType,
      },
    };
  }
}
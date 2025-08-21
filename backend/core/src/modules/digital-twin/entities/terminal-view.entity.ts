import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum ViewType {
  OVERVIEW = 'overview',
  YARD_SECTION = 'yard_section',
  GATE_AREA = 'gate_area',
  EQUIPMENT_ZONE = 'equipment_zone',
  BERTH_VIEW = 'berth_view',
  CUSTOM = 'custom',
}

export enum ViewStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export enum ViewMode {
  REAL_TIME = 'real_time',
  HISTORICAL = 'historical',
  SIMULATION = 'simulation',
  PLANNING = 'planning',
}

@Entity('terminal_views', { schema: 'digital_twin' })
@Index(['viewType'])
@Index(['status'])
@Index(['viewMode'])
@Index(['createdBy'])
@Index(['isDefault'])
export class TerminalView {
  @ApiProperty({ description: 'Уникальный идентификатор вида' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Название вида' })
  @Column({ name: 'view_name' })
  viewName: string;

  @ApiProperty({ description: 'Описание вида' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Тип вида', enum: ViewType })
  @Column({
    name: 'view_type',
    type: 'enum',
    enum: ViewType,
  })
  viewType: ViewType;

  @ApiProperty({ description: 'Статус вида', enum: ViewStatus })
  @Column({
    type: 'enum',
    enum: ViewStatus,
    default: ViewStatus.ACTIVE,
  })
  status: ViewStatus;

  @ApiProperty({ description: 'Режим просмотра', enum: ViewMode })
  @Column({
    name: 'view_mode',
    type: 'enum',
    enum: ViewMode,
    default: ViewMode.REAL_TIME,
  })
  viewMode: ViewMode;

  @ApiProperty({ description: 'Является видом по умолчанию' })
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @ApiProperty({ description: 'Общедоступный вид' })
  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @ApiProperty({ description: 'Настройки камеры' })
  @Column({ name: 'camera_settings', type: 'jsonb' })
  cameraSettings: {
    position: {
      x: number;
      y: number;
      z: number;
    };
    target: {
      x: number;
      y: number;
      z: number;
    };
    rotation: {
      x: number;
      y: number;
      z: number;
    };
    fov: number; // field of view
    near: number;
    far: number;
    zoom: number;
    cameraType: 'perspective' | 'orthographic';
    controls: {
      enableRotate: boolean;
      enableZoom: boolean;
      enablePan: boolean;
      autoRotate: boolean;
      autoRotateSpeed: number;
      minDistance: number;
      maxDistance: number;
      minPolarAngle: number;
      maxPolarAngle: number;
    };
  };

  @ApiProperty({ description: 'Границы отображения' })
  @Column({ name: 'view_boundaries', type: 'jsonb', nullable: true })
  viewBoundaries: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ?: number;
    maxZ?: number;
    center: {
      x: number;
      y: number;
      z: number;
    };
    boundingBox: {
      width: number;
      height: number;
      depth: number;
    };
  };

  @ApiProperty({ description: 'Настройки освещения' })
  @Column({ name: 'lighting_settings', type: 'jsonb', nullable: true })
  lightingSettings: {
    ambientLight: {
      enabled: boolean;
      color: string;
      intensity: number;
    };
    directionalLight: {
      enabled: boolean;
      color: string;
      intensity: number;
      position: {
        x: number;
        y: number;
        z: number;
      };
      castShadows: boolean;
    };
    pointLights?: Array<{
      id: string;
      enabled: boolean;
      color: string;
      intensity: number;
      position: {
        x: number;
        y: number;
        z: number;
      };
      distance: number;
      decay: number;
    }>;
    spotLights?: Array<{
      id: string;
      enabled: boolean;
      color: string;
      intensity: number;
      position: {
        x: number;
        y: number;
        z: number;
      };
      target: {
        x: number;
        y: number;
        z: number;
      };
      angle: number;
      penumbra: number;
      distance: number;
      decay: number;
    }>;
    environmentMap?: {
      enabled: boolean;
      url?: string;
      intensity: number;
    };
  };

  @ApiProperty({ description: 'Слои отображения' })
  @Column({ name: 'display_layers', type: 'jsonb' })
  displayLayers: {
    terrain: {
      visible: boolean;
      opacity: number;
      wireframe: boolean;
      color?: string;
    };
    buildings: {
      visible: boolean;
      opacity: number;
      showLabels: boolean;
      detailLevel: 'low' | 'medium' | 'high';
    };
    infrastructure: {
      visible: boolean;
      opacity: number;
      showRoads: boolean;
      showRailways: boolean;
      showUtilities: boolean;
    };
    containers: {
      visible: boolean;
      opacity: number;
      showLabels: boolean;
      colorCoding: 'status' | 'type' | 'client' | 'age' | 'none';
      detailLevel: 'low' | 'medium' | 'high';
      stackingView: boolean;
    };
    equipment: {
      visible: boolean;
      opacity: number;
      showLabels: boolean;
      showPaths: boolean;
      animateMovement: boolean;
      detailLevel: 'low' | 'medium' | 'high';
    };
    vehicles: {
      visible: boolean;
      opacity: number;
      showLabels: boolean;
      showRoutes: boolean;
      animateMovement: boolean;
    };
    personnel: {
      visible: boolean;
      opacity: number;
      showLabels: boolean;
      showPaths: boolean;
      privacyMode: boolean;
    };
    measurements: {
      visible: boolean;
      showDistances: boolean;
      showAreas: boolean;
      showVolumes: boolean;
      units: 'metric' | 'imperial';
    };
    weather: {
      visible: boolean;
      showWindDirection: boolean;
      showPrecipitation: boolean;
      animateEffects: boolean;
    };
    security: {
      visible: boolean;
      showCameras: boolean;
      showSensors: boolean;
      showZones: boolean;
      showAlerts: boolean;
    };
  };

  @ApiProperty({ description: 'Настройки фильтрации' })
  @Column({ name: 'filter_settings', type: 'jsonb', nullable: true })
  filterSettings: {
    timeRange?: {
      startTime: Date;
      endTime: Date;
      realTime: boolean;
    };
    containerFilters?: {
      statuses?: string[];
      types?: string[];
      clients?: string[];
      sizes?: string[];
      weightRange?: {
        min: number;
        max: number;
      };
    };
    equipmentFilters?: {
      types?: string[];
      statuses?: string[];
      zones?: string[];
    };
    spatialFilters?: {
      zones?: string[];
      areas?: Array<{
        name: string;
        polygon: Array<{
          x: number;
          y: number;
        }>;
      }>;
    };
  };

  @ApiProperty({ description: 'Настройки анимации' })
  @Column({ name: 'animation_settings', type: 'jsonb', nullable: true })
  animationSettings: {
    enableAnimations: boolean;
    animationSpeed: number; // 0.1 to 5.0
    smoothTransitions: boolean;
    particleEffects: boolean;
    trailEffects: boolean;
    containerMovements: {
      enabled: boolean;
      showPath: boolean;
      pathDuration: number;
      easingType: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    };
    equipmentMovements: {
      enabled: boolean;
      showPath: boolean;
      pathDuration: number;
      realisticPhysics: boolean;
    };
    weatherEffects: {
      enabled: boolean;
      rainIntensity: number;
      windStrength: number;
      cloudMovement: boolean;
    };
    timeOfDaySimulation: {
      enabled: boolean;
      speed: number;
      startTime: string; // HH:MM format
    };
  };

  @ApiProperty({ description: 'Интерактивные настройки' })
  @Column({ name: 'interaction_settings', type: 'jsonb', nullable: true })
  interactionSettings: {
    selectionMode: 'single' | 'multiple' | 'none';
    hoverEffects: boolean;
    clickActions: {
      containers: 'select' | 'info' | 'move' | 'none';
      equipment: 'select' | 'info' | 'control' | 'none';
      areas: 'select' | 'info' | 'none';
    };
    contextMenus: boolean;
    measurementTools: boolean;
    drawingTools: boolean;
    annotationTools: boolean;
    cameraBookmarks: boolean;
    viewSynchronization: boolean;
  };

  @ApiProperty({ description: 'Настройки производительности' })
  @Column({ name: 'performance_settings', type: 'jsonb', nullable: true })
  performanceSettings: {
    renderQuality: 'low' | 'medium' | 'high' | 'ultra';
    maxFrameRate: number;
    lodLevels: {
      containers: number;
      equipment: number;
      buildings: number;
    };
    cullingDistance: number;
    shadowQuality: 'disabled' | 'low' | 'medium' | 'high';
    antiAliasing: 'none' | 'fxaa' | 'msaa' | 'smaa';
    postProcessing: {
      enabled: boolean;
      bloom: boolean;
      ssao: boolean;
      ssr: boolean;
    };
    instancing: {
      enabled: boolean;
      maxInstances: number;
    };
  };

  @ApiProperty({ description: 'Настройки уведомлений' })
  @Column({ name: 'notification_settings', type: 'jsonb', nullable: true })
  notificationSettings: {
    realTimeAlerts: boolean;
    soundEffects: boolean;
    visualIndicators: boolean;
    alertTypes: {
      emergencies: boolean;
      equipmentFailures: boolean;
      securityBreach: boolean;
      weatherWarnings: boolean;
      operationalUpdates: boolean;
    };
    notificationPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    autoHideDelay: number;
  };

  @ApiProperty({ description: 'Создатель вида' })
  @Column({ name: 'created_by' })
  createdBy: string;

  @ApiProperty({ description: 'Имя создателя' })
  @Column({ name: 'created_by_name' })
  createdByName: string;

  @ApiProperty({ description: 'Разрешенные пользователи' })
  @Column({ name: 'allowed_users', type: 'simple-array', nullable: true })
  allowedUsers: string[];

  @ApiProperty({ description: 'Разрешенные роли' })
  @Column({ name: 'allowed_roles', type: 'simple-array', nullable: true })
  allowedRoles: string[];

  @ApiProperty({ description: 'Теги для категоризации' })
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @ApiProperty({ description: 'Дополнительные метаданные' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Дата создания' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: 'Дата последнего использования' })
  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt: Date;

  @ApiProperty({ description: 'Количество использований' })
  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  // Вычисляемые поля
  get isActive(): boolean {
    return this.status === ViewStatus.ACTIVE;
  }

  get isCustom(): boolean {
    return this.viewType === ViewType.CUSTOM;
  }

  get hasAdvancedFeatures(): boolean {
    return this.animationSettings?.enableAnimations ||
           this.performanceSettings?.renderQuality === 'ultra' ||
           this.lightingSettings?.environmentMap?.enabled;
  }

  get isPerformanceOptimized(): boolean {
    return this.performanceSettings?.renderQuality === 'low' &&
           this.performanceSettings?.lodLevels?.containers > 2;
  }

  get supportsInteraction(): boolean {
    return this.interactionSettings?.selectionMode !== 'none' &&
           (this.interactionSettings?.clickActions?.containers !== 'none' ||
            this.interactionSettings?.clickActions?.equipment !== 'none');
  }

  get hasTimeFiltering(): boolean {
    return !!this.filterSettings?.timeRange;
  }

  get isRealTimeView(): boolean {
    return this.viewMode === ViewMode.REAL_TIME && 
           this.filterSettings?.timeRange?.realTime !== false;
  }

  get viewConfigurationHash(): string {
    const configStr = JSON.stringify({
      camera: this.cameraSettings,
      layers: this.displayLayers,
      filters: this.filterSettings,
      animations: this.animationSettings,
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < configStr.length; i++) {
      const char = configStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  get estimatedRenderComplexity(): 'low' | 'medium' | 'high' | 'ultra' {
    let complexity = 0;
    
    // Layer complexity
    const visibleLayers = Object.values(this.displayLayers).filter(layer => layer.visible).length;
    complexity += visibleLayers * 10;
    
    // Animation complexity
    if (this.animationSettings?.enableAnimations) complexity += 30;
    if (this.animationSettings?.particleEffects) complexity += 20;
    if (this.animationSettings?.weatherEffects?.enabled) complexity += 15;
    
    // Performance settings
    const quality = this.performanceSettings?.renderQuality;
    if (quality === 'ultra') complexity += 50;
    else if (quality === 'high') complexity += 30;
    else if (quality === 'medium') complexity += 15;
    
    // Lighting complexity
    const pointLights = this.lightingSettings?.pointLights?.length || 0;
    const spotLights = this.lightingSettings?.spotLights?.length || 0;
    complexity += (pointLights + spotLights) * 5;
    
    if (complexity >= 150) return 'ultra';
    if (complexity >= 100) return 'high';
    if (complexity >= 50) return 'medium';
    return 'low';
  }

  get cameraDistance(): number {
    const pos = this.cameraSettings.position;
    const target = this.cameraSettings.target;
    
    return Math.sqrt(
      Math.pow(pos.x - target.x, 2) +
      Math.pow(pos.y - target.y, 2) +
      Math.pow(pos.z - target.z, 2)
    );
  }

  get viewArea(): number {
    if (!this.viewBoundaries) return 0;
    
    return (this.viewBoundaries.maxX - this.viewBoundaries.minX) *
           (this.viewBoundaries.maxY - this.viewBoundaries.minY);
  }

  get enabledLayerCount(): number {
    return Object.values(this.displayLayers).filter(layer => layer.visible).length;
  }

  get hasCustomLighting(): boolean {
    return (this.lightingSettings?.pointLights?.length > 0) ||
           (this.lightingSettings?.spotLights?.length > 0) ||
           this.lightingSettings?.environmentMap?.enabled;
  }

  get isOptimizedForMobile(): boolean {
    return this.performanceSettings?.renderQuality === 'low' &&
           !this.animationSettings?.enableAnimations &&
           !this.performanceSettings?.postProcessing?.enabled;
  }
}
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum ObjectType {
  CONTAINER = 'container',
  EQUIPMENT = 'equipment',
  BUILDING = 'building',
  INFRASTRUCTURE = 'infrastructure',
  VEHICLE = 'vehicle',
  PERSON = 'person',
  ZONE = 'zone',
  SENSOR = 'sensor',
  LIGHT = 'light',
  DECORATION = 'decoration',
}

export enum ObjectStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  ERROR = 'error',
  HIDDEN = 'hidden',
}

export enum RenderMode {
  MESH = 'mesh',
  WIREFRAME = 'wireframe',
  POINTS = 'points',
  INSTANCED = 'instanced',
  BILLBOARD = 'billboard',
}

@Entity('terminal_objects', { schema: 'digital_twin' })
@Index(['objectType'])
@Index(['status'])
@Index(['renderMode'])
@Index(['parentObjectId'])
@Index(['entityType', 'entityId'])
@Index(['isVisible'])
export class TerminalObject {
  @ApiProperty({ description: 'Уникальный идентификатор 3D объекта' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Название объекта' })
  @Column({ name: 'object_name' })
  objectName: string;

  @ApiProperty({ description: 'Описание объекта' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Тип объекта', enum: ObjectType })
  @Column({
    name: 'object_type',
    type: 'enum',
    enum: ObjectType,
  })
  objectType: ObjectType;

  @ApiProperty({ description: 'Статус объекта', enum: ObjectStatus })
  @Column({
    type: 'enum',
    enum: ObjectStatus,
    default: ObjectStatus.ACTIVE,
  })
  status: ObjectStatus;

  @ApiProperty({ description: 'Режим рендеринга', enum: RenderMode })
  @Column({
    name: 'render_mode',
    type: 'enum',
    enum: RenderMode,
    default: RenderMode.MESH,
  })
  renderMode: RenderMode;

  @ApiProperty({ description: 'Видимость объекта' })
  @Column({ name: 'is_visible', default: true })
  isVisible: boolean;

  @ApiProperty({ description: 'Интерактивный объект' })
  @Column({ name: 'is_interactive', default: true })
  isInteractive: boolean;

  @ApiProperty({ description: 'Статический объект (не движется)' })
  @Column({ name: 'is_static', default: false })
  isStatic: boolean;

  @ApiProperty({ description: 'Позиция объекта в 3D пространстве' })
  @Column({ type: 'jsonb' })
  position: {
    x: number;
    y: number;
    z: number;
  };

  @ApiProperty({ description: 'Поворот объекта' })
  @Column({ type: 'jsonb' })
  rotation: {
    x: number;
    y: number;
    z: number;
    order?: 'XYZ' | 'XZY' | 'YXZ' | 'YZX' | 'ZXY' | 'ZYX';
  };

  @ApiProperty({ description: 'Масштаб объекта' })
  @Column({ type: 'jsonb' })
  scale: {
    x: number;
    y: number;
    z: number;
  };

  @ApiProperty({ description: 'Размеры объекта' })
  @Column({ type: 'jsonb' })
  dimensions: {
    width: number;
    height: number;
    depth: number;
    radius?: number; // for cylindrical objects
    length?: number; // for elongated objects
  };

  @ApiProperty({ description: 'Ограничивающий параллелепипед' })
  @Column({ name: 'bounding_box', type: 'jsonb' })
  boundingBox: {
    min: {
      x: number;
      y: number;
      z: number;
    };
    max: {
      x: number;
      y: number;
      z: number;
    };
    center: {
      x: number;
      y: number;
      z: number;
    };
    size: {
      x: number;
      y: number;
      z: number;
    };
  };

  @ApiProperty({ description: 'Геометрические данные' })
  @Column({ name: 'geometry_data', type: 'jsonb' })
  geometryData: {
    type: 'box' | 'sphere' | 'cylinder' | 'plane' | 'custom';
    primitiveParams?: {
      // For box
      width?: number;
      height?: number;
      depth?: number;
      
      // For sphere
      radius?: number;
      widthSegments?: number;
      heightSegments?: number;
      
      // For cylinder
      radiusTop?: number;
      radiusBottom?: number;
      cylinderHeight?: number;
      radialSegments?: number;
      
      // For plane
      planeWidth?: number;
      planeHeight?: number;
    };
    customGeometry?: {
      vertices: number[];
      indices: number[];
      normals: number[];
      uvs: number[];
    };
    modelUrl?: string; // URL to 3D model file
    modelFormat?: 'gltf' | 'glb' | 'fbx' | 'obj' | 'dae' | 'ply';
    modelScale?: number;
    modelRotation?: {
      x: number;
      y: number;
      z: number;
    };
  };

  @ApiProperty({ description: 'Материалы и текстуры' })
  @Column({ name: 'material_data', type: 'jsonb' })
  materialData: {
    type: 'basic' | 'standard' | 'physical' | 'lambert' | 'phong' | 'toon' | 'custom';
    properties: {
      color?: string;
      opacity?: number;
      transparent?: boolean;
      wireframe?: boolean;
      metalness?: number;
      roughness?: number;
      emissive?: string;
      emissiveIntensity?: number;
      specular?: string;
      shininess?: number;
      reflectivity?: number;
      refractionRatio?: number;
      clearcoat?: number;
      clearcoatRoughness?: number;
    };
    textures?: {
      diffuse?: {
        url: string;
        repeat?: { x: number; y: number };
        offset?: { x: number; y: number };
        rotation?: number;
      };
      normal?: {
        url: string;
        scale?: number;
      };
      roughness?: {
        url: string;
      };
      metalness?: {
        url: string;
      };
      environment?: {
        url: string;
      };
      emissive?: {
        url: string;
      };
      displacement?: {
        url: string;
        scale?: number;
      };
      alpha?: {
        url: string;
      };
    };
    shaderUniforms?: Record<string, any>;
  };

  @ApiProperty({ description: 'Настройки анимации' })
  @Column({ name: 'animation_data', type: 'jsonb', nullable: true })
  animationData: {
    hasAnimations: boolean;
    animations?: Array<{
      name: string;
      type: 'position' | 'rotation' | 'scale' | 'morph' | 'custom';
      duration: number;
      loop: boolean;
      autoplay: boolean;
      delay?: number;
      easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
      keyframes?: Array<{
        time: number;
        value: any;
        interpolation?: 'linear' | 'step' | 'cubic';
      }>;
    }>;
    currentAnimation?: string;
    animationSpeed?: number;
    blendMode?: 'normal' | 'additive';
  };

  @ApiProperty({ description: 'Физические свойства' })
  @Column({ name: 'physics_data', type: 'jsonb', nullable: true })
  physicsData: {
    hasPhysics: boolean;
    bodyType?: 'static' | 'dynamic' | 'kinematic';
    mass?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
    collisionShape?: 'box' | 'sphere' | 'cylinder' | 'mesh' | 'compound';
    collisionGroups?: string[];
    collisionMask?: string[];
    constraints?: Array<{
      type: 'hinge' | 'slider' | 'ball' | 'fixed';
      targetObjectId?: string;
      limits?: {
        min?: number;
        max?: number;
      };
    }>;
  };

  @ApiProperty({ description: 'Настройки освещения' })
  @Column({ name: 'lighting_data', type: 'jsonb', nullable: true })
  lightingData: {
    castShadows: boolean;
    receiveShadows: boolean;
    lightType?: 'ambient' | 'directional' | 'point' | 'spot' | 'hemisphere';
    lightProperties?: {
      color: string;
      intensity: number;
      distance?: number;
      angle?: number;
      penumbra?: number;
      decay?: number;
      target?: {
        x: number;
        y: number;
        z: number;
      };
    };
    shadowProperties?: {
      mapSize: number;
      camera: {
        near: number;
        far: number;
        left?: number;
        right?: number;
        top?: number;
        bottom?: number;
        fov?: number;
      };
      bias: number;
      radius: number;
    };
  };

  @ApiProperty({ description: 'Данные о связанной сущности' })
  @Column({ name: 'entity_type', nullable: true })
  entityType: string;

  @ApiProperty({ description: 'ID связанной сущности' })
  @Column({ name: 'entity_id', nullable: true })
  entityId: string;

  @ApiProperty({ description: 'ID родительского объекта' })
  @Column({ name: 'parent_object_id', nullable: true })
  parentObjectId: string;

  @ApiProperty({ description: 'Дочерние объекты' })
  @Column({ name: 'child_object_ids', type: 'simple-array', nullable: true })
  childObjectIds: string[];

  @ApiProperty({ description: 'Уровень детализации' })
  @Column({ name: 'lod_levels', type: 'jsonb', nullable: true })
  lodLevels: Array<{
    distance: number;
    geometryUrl?: string;
    vertexCount?: number;
    triangleCount?: number;
    quality: 'low' | 'medium' | 'high' | 'ultra';
  }>;

  @ApiProperty({ description: 'Метаданные для рендеринга' })
  @Column({ name: 'render_metadata', type: 'jsonb', nullable: true })
  renderMetadata: {
    renderOrder?: number;
    frustumCulled?: boolean;
    matrixAutoUpdate?: boolean;
    visible?: boolean;
    userData?: Record<string, any>;
    layers?: number;
    renderPriority?: 'background' | 'geometry' | 'transparent' | 'overlay';
    instancingData?: {
      isInstanced: boolean;
      maxInstances?: number;
      instanceMatrix?: number[];
      instanceColor?: number[];
    };
  };

  @ApiProperty({ description: 'Настройки интерактивности' })
  @Column({ name: 'interaction_data', type: 'jsonb', nullable: true })
  interactionData: {
    clickable: boolean;
    hoverable: boolean;
    selectable: boolean;
    draggable: boolean;
    contextMenu: boolean;
    tooltipText?: string;
    clickActions?: Array<{
      action: 'select' | 'info' | 'move' | 'rotate' | 'scale' | 'custom';
      parameters?: Record<string, any>;
    }>;
    hoverEffects?: {
      highlightColor?: string;
      outlineColor?: string;
      scaleMultiplier?: number;
      emissiveIntensity?: number;
    };
    selectionEffects?: {
      outlineColor?: string;
      outlineWidth?: number;
      glowEffect?: boolean;
      glowColor?: string;
    };
  };

  @ApiProperty({ description: 'Данные производительности' })
  @Column({ name: 'performance_data', type: 'jsonb', nullable: true })
  performanceData: {
    renderCost: 'low' | 'medium' | 'high' | 'ultra';
    vertexCount: number;
    triangleCount: number;
    textureMemory: number; // in MB
    lastFrameTime?: number;
    averageFrameTime?: number;
    cullingDistance?: number;
    optimizationHints?: string[];
  };

  @ApiProperty({ description: 'Теги для фильтрации' })
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

  @ApiProperty({ description: 'Дата последнего рендеринга' })
  @Column({ name: 'last_rendered_at', nullable: true })
  lastRenderedAt: Date;

  // Вычисляемые поля
  get isActive(): boolean {
    return this.status === ObjectStatus.ACTIVE && this.isVisible;
  }

  get isContainer(): boolean {
    return this.objectType === ObjectType.CONTAINER;
  }

  get isEquipment(): boolean {
    return this.objectType === ObjectType.EQUIPMENT;
  }

  get isBuilding(): boolean {
    return this.objectType === ObjectType.BUILDING;
  }

  get hasPhysics(): boolean {
    return this.physicsData?.hasPhysics || false;
  }

  get hasAnimations(): boolean {
    return this.animationData?.hasAnimations || false;
  }

  get isInstanced(): boolean {
    return this.renderMode === RenderMode.INSTANCED || 
           this.renderMetadata?.instancingData?.isInstanced || false;
  }

  get volume(): number {
    const dim = this.dimensions;
    if (dim.radius) {
      // Cylindrical volume
      return Math.PI * Math.pow(dim.radius, 2) * dim.height;
    }
    return dim.width * dim.height * dim.depth;
  }

  get surfaceArea(): number {
    const dim = this.dimensions;
    if (dim.radius) {
      // Cylindrical surface area
      return 2 * Math.PI * dim.radius * (dim.radius + dim.height);
    }
    return 2 * (dim.width * dim.height + dim.width * dim.depth + dim.height * dim.depth);
  }

  get distanceFromOrigin(): number {
    const pos = this.position;
    return Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
  }

  get boundingBoxVolume(): number {
    const size = this.boundingBox.size;
    return size.x * size.y * size.z;
  }

  get renderComplexity(): 'low' | 'medium' | 'high' | 'ultra' {
    if (this.performanceData?.renderCost) {
      return this.performanceData.renderCost;
    }

    const triangles = this.performanceData?.triangleCount || 0;
    const hasTextures = Object.keys(this.materialData.textures || {}).length > 0;
    const hasAnimations = this.hasAnimations;
    const hasPhysics = this.hasPhysics;

    let complexity = 0;
    if (triangles > 10000) complexity += 3;
    else if (triangles > 1000) complexity += 2;
    else if (triangles > 100) complexity += 1;

    if (hasTextures) complexity += 1;
    if (hasAnimations) complexity += 2;
    if (hasPhysics) complexity += 1;

    if (complexity >= 6) return 'ultra';
    if (complexity >= 4) return 'high';
    if (complexity >= 2) return 'medium';
    return 'low';
  }

  get hasCustomGeometry(): boolean {
    return this.geometryData.type === 'custom' && !!this.geometryData.customGeometry;
  }

  get hasExternalModel(): boolean {
    return !!this.geometryData.modelUrl;
  }

  get isLightSource(): boolean {
    return this.lightingData?.lightType !== undefined;
  }

  get canCastShadows(): boolean {
    return this.lightingData?.castShadows || false;
  }

  get canReceiveShadows(): boolean {
    return this.lightingData?.receiveShadows || false;
  }

  get hasLodLevels(): boolean {
    return (this.lodLevels?.length || 0) > 1;
  }

  get isOptimizedForPerformance(): boolean {
    return this.performanceData?.renderCost === 'low' || 
           (this.performanceData?.triangleCount || 0) < 1000;
  }

  get supportedInteractions(): string[] {
    const interactions = [];
    if (this.interactionData?.clickable) interactions.push('click');
    if (this.interactionData?.hoverable) interactions.push('hover');
    if (this.interactionData?.selectable) interactions.push('select');
    if (this.interactionData?.draggable) interactions.push('drag');
    if (this.interactionData?.contextMenu) interactions.push('context-menu');
    return interactions;
  }
}
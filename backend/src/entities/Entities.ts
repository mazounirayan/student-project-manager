import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, OneToOne, ManyToMany,
  JoinTable, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

export type Role = 'teacher' | 'student';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ select: false })
  password!: string;

  /** Empreinte SHA-256 du jeton de réinitialisation (jamais le jeton lui-même). */
  @Column({ type: 'varchar', nullable: true, select: false })
  resetToken?: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  resetTokenExpiry?: Date | null;

  @Column({ type: 'enum', enum: ['teacher', 'student'] })
  role!: Role;

  @Column({ type: 'varchar', nullable: true })
  googleId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  microsoftId?: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Promotion, promotion => promotion.teacher)
  teacherPromotions!: Promotion[];

  @ManyToMany(() => Promotion, promotion => promotion.students)
  studentPromotions!: Promotion[];

  @OneToMany(() => Project, project => project.teacher)
  teacherProjects!: Project[];

  @ManyToMany(() => Group, group => group.members)
  groups!: Group[];

  toJSON() {
    const { password, resetToken, resetTokenExpiry, googleId, microsoftId, ...publicUser } = this;
    return publicUser;
  }
}

@Entity()
export class Promotion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'year' })
  year!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, user => user.teacherPromotions)
  teacher!: User;

  @ManyToMany(() => User, user => user.studentPromotions)
  @JoinTable()
  students!: User[];

  @OneToMany(() => Project, project => project.promotion)
  projects!: Project[];
}

@Entity()
export class Project {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: ['draft', 'visible'], default: 'draft' })
  status!: 'draft' | 'visible';

  @Column({ type: 'int', nullable: true })
  minGroupSize?: number | null;

  @Column({ type: 'int', nullable: true })
  maxGroupSize?: number | null;

  @Column({ type: 'enum', enum: ['manual', 'random', 'free'], nullable: true })
  groupFormationRule?: 'manual' | 'random' | 'free' | null;

  @Column({ type: 'datetime', nullable: true })
  groupFormationDeadline?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'int', nullable: true })
  promotionId!: number | null;

  @ManyToOne(() => User, user => user.teacherProjects)
  teacher!: User;

  @ManyToOne(() => Promotion, promotion => promotion.projects, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'promotionId' })
  promotion!: Promotion;

  @OneToMany(() => Group, group => group.project)
  groups!: Group[];

  @OneToMany(() => Deliverable, deliverable => deliverable.project)
  deliverables!: Deliverable[];

  @OneToMany(() => Report, report => report.project)
  reports!: Report[];

  @OneToMany(() => Defense, defense => defense.project)
  defenses!: Defense[];

  @OneToMany(() => GradingGrid, grid => grid.project)
  gradingGrids!: GradingGrid[];
}

@Entity()
export class Group {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Project, project => project.groups, { onDelete: 'CASCADE' })
  project!: Project;

  @ManyToMany(() => User, user => user.groups)
  @JoinTable()
  members!: User[];

  @OneToMany(() => DeliverableSubmission, submission => submission.group)
  deliverableSubmissions!: DeliverableSubmission[];

  @OneToMany(() => Report, report => report.group)
  reports!: Report[];

  @OneToMany(() => Defense, defense => defense.group)
  defenses!: Defense[];

  @OneToMany(() => Grade, grade => grade.group)
  grades!: Grade[];
}

@Entity()
export class Deliverable {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: ['archive', 'git_link'] })
  type!: 'archive' | 'git_link';

  @Column({ type: 'datetime' })
  deadline!: Date;

  @Column({ default: false })
  allowLateSubmission!: boolean;

  @Column({ type: 'int', default: 0 })
  penaltyPerHour!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Project, project => project.deliverables, { onDelete: 'CASCADE' })
  project!: Project;

  @OneToMany(() => DeliverableRule, rule => rule.deliverable)
  validationRules!: DeliverableRule[];

  @OneToMany(() => DeliverableSubmission, submission => submission.deliverable)
  submissions!: DeliverableSubmission[];
}

export type RuleType = 'max_size' | 'file_presence' | 'folder_structure' | 'file_content';

@Entity()
export class DeliverableRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: ['max_size', 'file_presence', 'folder_structure', 'file_content'] })
  type!: RuleType;

  /** Paramètres de la règle, sérialisés en JSON. */
  @Column({ type: 'text' })
  configuration!: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @ManyToOne(() => Deliverable, deliverable => deliverable.validationRules, { onDelete: 'CASCADE' })
  deliverable!: Deliverable;
}

export interface RuleResult {
  type: RuleType;
  configuration: string;
  passed: boolean;
  message: string;
}

export interface SimilarityMatch {
  submissionId: number;
  finalScore: number;
  textScore: number;
  details: string;
}

@Entity()
@Unique(['deliverable', 'group'])
export class DeliverableSubmission {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Chemin serveur du fichier : ne doit jamais être exposé dans une réponse API. */
  @Column({ type: 'varchar', nullable: true })
  filePath?: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileName?: string | null;

  @Column({ type: 'int', nullable: true })
  fileSize?: number | null;

  @Column({ type: 'varchar', nullable: true })
  gitUrl?: string | null;

  @Column({ type: 'datetime' })
  submittedAt!: Date;

  @Column({ default: false })
  isLate!: boolean;

  @Column({ type: 'int', default: 0 })
  penalty!: number;

  @Column({ type: 'json', nullable: true })
  validationResults?: RuleResult[] | null;

  /** Score de similarité maximal (0 à 1) avec les autres soumissions du livrable. */
  @Column({ type: 'float', nullable: true })
  similarityScore?: number | null;

  @Column({ type: 'json', nullable: true })
  similarityMatches?: SimilarityMatch[] | null;

  @ManyToOne(() => Deliverable, deliverable => deliverable.submissions, { onDelete: 'CASCADE' })
  deliverable!: Deliverable;

  @ManyToOne(() => Group, group => group.deliverableSubmissions, { onDelete: 'CASCADE' })
  group!: Group;
}

@Entity()
export class ReportConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn()
  project!: Project;

  @Column({ default: false })
  isEnabled!: boolean;

  @Column({ type: 'enum', enum: ['markdown', 'html'], default: 'markdown' })
  format!: 'markdown' | 'html';

  @Column({ type: 'datetime', nullable: true })
  deadline?: Date | null;

  @Column({ type: 'text', nullable: true })
  instructions?: string | null;

  @OneToMany(() => ReportSectionConfig, section => section.config, { cascade: true })
  sections!: ReportSectionConfig[];
}

@Entity()
export class ReportSectionConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ default: false })
  required!: boolean;

  @Column({ type: 'int', nullable: true })
  wordLimit?: number | null;

  @Column({ type: 'int' })
  orderIndex!: number;

  @ManyToOne(() => ReportConfig, config => config.sections, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  config!: ReportConfig;
}

@Entity()
@Unique(['project', 'group'])
export class Report {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: ['draft', 'submitted'], default: 'draft' })
  status!: 'draft' | 'submitted';

  @Column({ type: 'datetime', nullable: true })
  submittedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Project, project => project.reports, { onDelete: 'CASCADE' })
  project!: Project;

  @ManyToOne(() => Group, group => group.reports, { onDelete: 'CASCADE' })
  group!: Group;

  @OneToMany(() => ReportSection, section => section.report)
  sections!: ReportSection[];
}

@Entity()
@Unique(['report', 'sectionConfig'])
export class ReportSection {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'mediumtext' })
  content!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Report, report => report.sections, { onDelete: 'CASCADE' })
  report!: Report;

  @ManyToOne(() => ReportSectionConfig, { onDelete: 'CASCADE' })
  sectionConfig!: ReportSectionConfig;
}

@Entity()
export class Defense {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'datetime' })
  startTime!: Date;

  @Column({ type: 'datetime' })
  endTime!: Date;

  @Column({ type: 'int' })
  orderIndex!: number;

  @Column({ type: 'text', nullable: true })
  location?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Project, project => project.defenses, { onDelete: 'CASCADE' })
  project!: Project;

  @ManyToOne(() => Group, group => group.defenses, { onDelete: 'CASCADE' })
  group!: Group;
}

export type GridType = 'deliverable' | 'report' | 'defense';
export type GradeStatus = 'draft' | 'submitted' | 'validated';

@Entity()
export class GradingGrid {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: ['deliverable', 'report', 'defense'] })
  type!: GridType;

  @Column({ type: 'float', default: 1.0 })
  weight!: number;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** Livrable évalué par la grille (grilles de type « deliverable »). */
  @Column({ type: 'int', nullable: true })
  deliverableId?: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Project, project => project.gradingGrids, { onDelete: 'CASCADE' })
  project!: Project;

  @OneToMany(() => GradingCriterion, criterion => criterion.gradingGrid)
  criteria!: GradingCriterion[];

  @OneToMany(() => Grade, grade => grade.gradingGrid)
  grades!: Grade[];
}

@Entity()
export class GradingCriterion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'float' })
  maxScore!: number;

  @Column({ type: 'float', default: 1.0 })
  weight!: number;

  @Column({ type: 'enum', enum: ['group', 'individual'], default: 'group' })
  type!: 'group' | 'individual';

  @Column({ default: false })
  hasComments!: boolean;

  @ManyToOne(() => GradingGrid, grid => grid.criteria, { onDelete: 'CASCADE' })
  gradingGrid!: GradingGrid;

  @OneToMany(() => CriterionGrade, criterionGrade => criterionGrade.criterion)
  criterionGrades!: CriterionGrade[];
}

/** Note d'un groupe pour une grille. Seules les notes « validated » sont visibles des étudiants. */
@Entity()
@Unique(['gradingGrid', 'group'])
export class Grade {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Note sur 20, calculée côté serveur. */
  @Column({ type: 'float', nullable: true })
  totalScore?: number | null;

  @Column({ type: 'text', nullable: true })
  globalComments?: string | null;

  @Column({ type: 'enum', enum: ['draft', 'submitted', 'validated'], default: 'draft' })
  status!: GradeStatus;

  @Column({ type: 'datetime', nullable: true })
  validatedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => GradingGrid, grid => grid.grades, { onDelete: 'CASCADE' })
  gradingGrid!: GradingGrid;

  @ManyToOne(() => Group, group => group.grades, { onDelete: 'CASCADE' })
  group!: Group;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  gradedBy?: User | null;

  @OneToMany(() => CriterionGrade, criterionGrade => criterionGrade.grade, { cascade: true })
  criterionGrades!: CriterionGrade[];
}

@Entity()
export class CriterionGrade {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'float' })
  score!: number;

  @Column({ type: 'text', nullable: true })
  comments?: string | null;

  @ManyToOne(() => Grade, grade => grade.criterionGrades, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  grade!: Grade;

  @ManyToOne(() => GradingCriterion, criterion => criterion.criterionGrades, { onDelete: 'CASCADE' })
  criterion!: GradingCriterion;
}

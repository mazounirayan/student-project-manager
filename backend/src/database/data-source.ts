import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import {
  CriterionGrade, Defense, Deliverable, DeliverableRule, DeliverableSubmission, Grade, GradingCriterion,
  GradingGrid, Group, Project, Promotion, Report, ReportConfig, ReportSection, ReportSectionConfig, User,
} from '../entities/Entities';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'projectacademy',
  synchronize: process.env.DB_SYNCHRONIZE === 'true' && process.env.NODE_ENV !== 'production',
  logging: process.env.DB_LOGGING === 'true',
  entities: [
    User, Promotion, Project, Group, Deliverable, DeliverableRule, DeliverableSubmission,
    ReportConfig, ReportSectionConfig, Report, ReportSection, Defense,
    GradingGrid, GradingCriterion, Grade, CriterionGrade,
  ],
});
